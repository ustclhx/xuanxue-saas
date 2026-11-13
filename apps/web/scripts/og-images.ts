import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { EAST_ENGLISH_COPY } from '../src/features/marketing/east-english/content.ts'
import { EAST_ENGLISH_OG_IMAGE } from '../src/features/marketing/east-english/head.ts'
import { ogImagePath, type SeoPage } from '../src/features/seo/metadata.ts'
import {
  eastEnglishOgImageCard,
  type OgImageCard,
  ogImageCard,
  ogImageCardLayout,
} from '../src/features/seo/og-image-card.ts'
import { publicPages } from '../src/features/seo/pages.ts'
import { numerologySeoPages } from '../src/features/tools/numerology/routes.ts'
import { tarotMeaningSeoPages } from '../src/features/tools/tarot/meaning-routes.ts'
import { createNodeShareCardRenderer } from '../src/node/share-card-renderer.ts'
import { templateConfig } from '../src/server/template-config.ts'

const root = new URL('..', import.meta.url)
// 与运行时分享卡片共用字体目录与渲染核心；构建期逐页串行渲染，不触及并发上限。
// 模板 0.4.0 渲染器只加载 Noto Sans SC：韩文（谚文）显示为方框，待 0.4.1 字体扩展点登记 NotoSansKR。
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

/** 模板默认版式（设计稿 `default` 变体），品牌、域名与配色按页面所属站点（features/seo/og-image-card.ts）。 */
function renderCard(card: OgImageCard): Promise<Uint8Array> {
  return renderer.render(ogImageCardLayout(card))
}

export function renderOgImage(page: Pick<SeoPage, 'title' | 'locale'>): Promise<Uint8Array> {
  return renderCard(ogImageCard(page))
}

function renderEastEnglishOgImage(): Promise<Uint8Array> {
  return renderCard(eastEnglishOgImageCard(EAST_ENGLISH_COPY.title))
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
          source: await renderOgImage(page),
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
          response.end(await renderOgImage(page))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
