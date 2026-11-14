import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { EAST_ENGLISH_COPY } from '../src/features/marketing/east-english/content.ts'
import { EAST_ENGLISH_OG_IMAGE } from '../src/features/marketing/east-english/head.ts'
import { ogImagePath } from '../src/features/seo/metadata.ts'
import { ogImageTitle } from '../src/features/seo/og-title.ts'
import { publicPages } from '../src/features/seo/pages.ts'
import { defaultShareCardLayout } from '../src/features/share-cards/layout.tsx'
import { defaultShareCardSite, resolveShareCardSite } from '../src/features/share-cards/site.ts'
import { resolveShareCardTheme } from '../src/features/share-cards/theme.ts'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH } from '../src/features/site/site.ts'
import { numerologySeoPages } from '../src/features/tools/numerology/routes.ts'
import { tarotMeaningSeoPages } from '../src/features/tools/tarot/meaning-routes.ts'
import { createNodeShareCardRenderer } from '../src/node/share-card-renderer.ts'
import { templateConfig } from '../src/server/template-config.ts'

const root = new URL('..', import.meta.url)
// 与运行时分享卡片共用字体目录与渲染核心；构建期逐页串行渲染，不触及并发上限。
const renderer = createNodeShareCardRenderer(
  fileURLToPath(new URL('../public/fonts/share-card', import.meta.url)),
)

function pages() {
  // content-collections 输出是 JSON 数组的默认导出；每次读取避免 dev 热更新沿用 ESM 缓存。
  const read = <T>(name: string): T =>
    JSON.parse(
      readFileSync(new URL(`.content-collections/generated/${name}.js`, root), 'utf8')
        .replace(/^\s*export default\s*/, '')
        .trim()
        .replace(/;$/, ''),
    ) as T
  type Content = Parameters<typeof publicPages>[0]
  return publicPages({
    posts: read<Content['posts']>('allPosts'),
    legal: read<Content['legal']>('allLegalPages'),
    docs: read<Content['docs']>('allDocs'),
    toolPages: [
      ...numerologySeoPages(read<Parameters<typeof numerologySeoPages>[0]>('allNumerologies')),
      ...tarotMeaningSeoPages(read<Parameters<typeof tarotMeaningSeoPages>[0]>('allTarots')),
    ],
  })
}

/**
 * 设计稿 `default` 变体。站点按 app.url 的域名与页面的 locale / pathname 解析
 * （features/share-cards/share-cards.sites.ts：东方站语言用东方站品牌、域名与配色；
 * 构建期没有请求 host，静态图按路径输出，各站点共用同一路径的图片）。
 */
export function renderOgImage(
  title: string,
  page: { locale?: string; path?: string } = {},
): Promise<Uint8Array> {
  const { site, themeOverride } = resolveShareCardSite({
    host: defaultShareCardSite().host,
    locale: page.locale,
    pathname: page.path,
  })
  return renderer.render(
    defaultShareCardLayout(title, resolveShareCardTheme('light', themeOverride), site),
  )
}

/** 东方站英文入口页（D5）：语言 en 归西方站，站点解析按路径识别为东方站 */
function renderEastEnglishOgImage(): Promise<Uint8Array> {
  return renderOgImage(EAST_ENGLISH_COPY.title, {
    locale: EAST_ENGLISH_LOCALE,
    path: EAST_ENGLISH_PATH,
  })
}

/** WASM 与完整字体只在 Node 构建阶段使用，PNG 作为客户端静态资源输出。 */
export function ogImages(): Plugin {
  return {
    name: 'saas:og-images',
    enforce: 'pre',
    applyToEnvironment: (environment) => environment.name === 'client',
    async generateBundle() {
      for (const page of pages()) {
        this.emitFile({
          type: 'asset',
          fileName: decodeURIComponent(ogImagePath(page).slice(1)),
          source: await renderOgImage(ogImageTitle(page.title), page),
        })
      }
      if (templateConfig.marketing.enabled && templateConfig.i18n.enabled)
        this.emitFile({
          type: 'asset',
          fileName: EAST_ENGLISH_OG_IMAGE.slice(1),
          source: await renderEastEnglishOgImage(),
        })
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source:
          '/og/*\n  Cache-Control: public, max-age=86400\n  X-Robots-Tag: noindex\n  X-Content-Type-Options: nosniff\n' +
          // 分享卡片字体：文件名不变但内容稳定，长期缓存；不被索引
          '/fonts/share-card/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Robots-Tag: noindex\n  X-Content-Type-Options: nosniff\n',
      })
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        if (!path.startsWith('/og/')) return next()
        try {
          if (path === EAST_ENGLISH_OG_IMAGE) {
            response.setHeader('Content-Type', 'image/png')
            response.end(await renderEastEnglishOgImage())
            return
          }
          const page = pages().find((page) => ogImagePath(page) === path)
          if (!page) {
            response.statusCode = 404
            response.end('Not Found')
            return
          }
          response.setHeader('Content-Type', 'image/png')
          response.end(await renderOgImage(ogImageTitle(page.title), page))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
