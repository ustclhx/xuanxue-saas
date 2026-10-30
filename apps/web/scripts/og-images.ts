import { readFileSync } from 'node:fs'
import { CustomFont, ImageResponse } from 'cf-workers-og/node'
import { createElement } from 'react'
import type { Plugin } from 'vite'
import { EAST_ENGLISH_COPY } from '../src/features/marketing/east-english/content.ts'
import { EAST_ENGLISH_OG_IMAGE } from '../src/features/marketing/east-english/head.ts'
import { ogImagePath, pageBrand, type SeoPage } from '../src/features/seo/metadata.ts'
import { OgCard } from '../src/features/seo/og-card.ts'
import { publicPages } from '../src/features/seo/pages.ts'
import { siteOfLocale } from '../src/features/site/site.ts'
import { numerologySeoPages } from '../src/features/tools/numerology/routes.ts'
import { tarotMeaningSeoPages } from '../src/features/tools/tarot/meaning-routes.ts'
import { templateConfig } from '../src/server/template-config.ts'

const root = new URL('..', import.meta.url)
const font = new CustomFont(
  'Noto Sans SC',
  readFileSync(new URL('./seo/NotoSansSC-Regular.otf', import.meta.url)),
  { weight: 400 },
)

const koreanFont = new CustomFont(
  'Noto Sans KR',
  readFileSync(new URL('./seo/NotoSansKR-Regular.otf', import.meta.url)),
  { weight: 400 },
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

/** 卡片底部显示页面所属站点的规范域名 */
function pageHost(page: Pick<SeoPage, 'locale'>): string {
  const site = siteOfLocale(page.locale, templateConfig) ?? 'west'
  return templateConfig.sites[site].hosts[0] ?? new URL(templateConfig.app.url).hostname
}

/** 东方站英文入口页（D5）：语言 en 归西方站，品牌与域名按东方站单独给出 */
const eastEnglishCard = {
  title: EAST_ENGLISH_COPY.title,
  brand: templateConfig.sites.east.brand.name,
  host: templateConfig.sites.east.hosts[0] ?? new URL(templateConfig.app.url).hostname,
}

export async function renderOgImage(
  page: Pick<SeoPage, 'title' | 'locale'>,
  override?: { brand: string; host: string },
): Promise<Uint8Array> {
  const card = { title: page.title, brand: pageBrand(page), host: pageHost(page), ...override }
  const response = await ImageResponse.create(createElement(OgCard, card), {
    width: 1200,
    height: 630,
    fonts: [font, koreanFont],
  })
  return new Uint8Array(await response.arrayBuffer())
}

function renderEastEnglishOgImage(): Promise<Uint8Array> {
  return renderOgImage({ title: eastEnglishCard.title, locale: 'en' }, eastEnglishCard)
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
          '/og/*\n  Cache-Control: public, max-age=86400\n  X-Robots-Tag: noindex\n  X-Content-Type-Options: nosniff\n',
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
