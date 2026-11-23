import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type Plugin, runnerImport } from 'vite'
import { zodiacSeoPages } from '../src/features/east-content/zodiac/seo-pages.ts'
import { tarotFeelingsSeoPages } from '../src/features/east-en/seo-pages.ts'
import { EAST_ENGLISH_COPY } from '../src/features/marketing/east-english/content.ts'
import { EAST_ENGLISH_OG_IMAGE } from '../src/features/marketing/east-english/head.ts'
import { homeTagline } from '../src/features/seo/home-copy.ts'
import { assertSeoPages } from '../src/features/seo/linking.ts'
import { ogImagePath } from '../src/features/seo/metadata.ts'
import { type OgSampleChart, ogSampleChart } from '../src/features/seo/og-sample/pages.ts'
import { ogImageTitle } from '../src/features/seo/og-title.ts'
import { publicPages } from '../src/features/seo/pages.ts'
import { defaultShareCardLayout } from '../src/features/share-cards/layout.tsx'
import { defaultShareCardSite, resolveShareCardSite } from '../src/features/share-cards/site.ts'
import { resolveShareCardTheme } from '../src/features/share-cards/theme.ts'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH, siteOfLocale } from '../src/features/site/site.ts'
import { numerologySeoPages } from '../src/features/tools/numerology/routes.ts'
import {
  tarotLocalizedSeoPages,
  tarotMeaningSeoPages,
} from '../src/features/tools/tarot/meaning-routes.ts'
import { westernZodiacSeoPages } from '../src/features/west-content/zodiac/seo-pages.ts'
import { createNodeShareCardRenderer } from '../src/node/share-card-renderer.ts'
import { templateConfig } from '../src/server/template-config.ts'
import { brandChartColors } from './brand-tokens.ts'

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
      ...tarotLocalizedSeoPages(),
      // 东方站根路径英文的 as feelings 牌页（5b）
      ...tarotFeelingsSeoPages(
        read<Parameters<typeof tarotFeelingsSeoPages>[0]>('allTarotFeelings'),
      ),
      ...zodiacSeoPages(read<Parameters<typeof zodiacSeoPages>[0]>('allZodiacs')),
      ...westernZodiacSeoPages(
        read<Parameters<typeof westernZodiacSeoPages>[0]>('allWesternZodiacs'),
      ),
    ],
    guides: read<NonNullable<Content['guides']>>('allGuides'),
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

type OgSampleModule = typeof import('../src/features/seo/og-sample/render.tsx')
let sampleModule: Promise<OgSampleModule> | undefined

/**
 * 样例模板依赖图形组件与 Paraglide 文案；src/paraglide 由 i18n 插件在构建开始时生成，vite 配置加载时可能还不存在，
 * 因此首次使用时才经 vite 的 runnerImport 加载（独立配置，不再读取 vite.config.ts）。
 */
function loadSampleModule(): Promise<OgSampleModule> {
  sampleModule ??= runnerImport<OgSampleModule>(
    fileURLToPath(new URL('../src/features/seo/og-sample/render.tsx', import.meta.url)),
    { configFile: false, logLevel: 'error' },
  )
    .then((result) => result.module)
    .catch((error: unknown) => {
      sampleModule = undefined
      throw error
    })
  return sampleModule
}

/**
 * 登记页面（首页、八字 / 紫微 / 命盤查詢 / 만세력、Life Path、数字图表）的样例 OG 图（openspec
 * redesign-home-chart-visuals design D6）：标题、站名、虚构样例命盘图形与「示例」角标。
 * 颜色取自 brand.css（两站均取默认主题：浅色），品牌、域名与副标题与默认分享图同一来源。
 */
export async function renderSampleOgImage(
  title: string,
  page: { locale: string; path: string },
  chart: OgSampleChart,
): Promise<Uint8Array> {
  const { site } = resolveShareCardSite({
    host: defaultShareCardSite().host,
    locale: page.locale,
    pathname: page.path,
  })
  const siteId = page.path.startsWith(`${EAST_ENGLISH_PATH}/`)
    ? 'east'
    : (siteOfLocale(page.locale, templateConfig) ?? 'west')
  const tagline = site.tagline ?? homeTagline(page.locale)
  const { ogSampleElement } = await loadSampleModule()
  return renderer.render(
    ogSampleElement({
      chart,
      locale: page.locale as Parameters<OgSampleModule['ogSampleElement']>[0]['locale'],
      title,
      meta: `${site.brand.name} · ${tagline}`,
      brand: site.brand,
      host: site.host,
      colors: brandChartColors(siteId === 'east' ? 'east-light' : 'west-light'),
    }),
  )
}

/** 公开页面的分享图：登记页面用样例模板，其余沿用默认版式 */
export function renderPageOgImage(page: {
  locale: string
  path: string
  title: string
  site?: string | undefined
}) {
  const title = ogImageTitle(page.title)
  const chart = ogSampleChart(page)
  // 东方站根路径英文（5b）：站点按预渲染文件命名空间 `/en/…` 识别为东方站
  const target =
    page.site === 'east' && page.locale === EAST_ENGLISH_LOCALE
      ? { ...page, path: `${EAST_ENGLISH_PATH}${page.path === '/' ? '' : page.path}` }
      : page
  return chart ? renderSampleOgImage(title, target, chart) : renderOgImage(title, target)
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
      const list = pages()
      // 页面层级与主词的静态校验（openspec seo-internal-linking 1.5）：两种构建目标都经过这里，失败时中止构建
      try {
        assertSeoPages(list, (message) => this.warn(message))
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error))
      }
      for (const page of list) {
        this.emitFile({
          type: 'asset',
          fileName: decodeURIComponent(ogImagePath(page).slice(1)),
          source: await renderPageOgImage(page),
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
        const raw = new URL(request.url ?? '/', 'http://localhost').pathname
        if (!raw.startsWith('/og/')) return next()
        try {
          // 中文 / 韩文路径的分享图（如 /og/zh-hant/八字排盤.png）在请求中是百分号编码
          const path = decodeURIComponent(raw)
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
          response.end(await renderPageOgImage(page))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
