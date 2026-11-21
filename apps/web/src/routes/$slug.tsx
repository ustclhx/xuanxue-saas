import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches } from '../features/seo/metadata.ts'
import { type EasternPageId, easternPageOf } from '../features/tools/bazi/eastern-routes.ts'
import {
  baziToolStructuredData,
  easternPageCopy,
  easternToolHead,
} from '../features/tools/bazi/head.ts'
import {
  numerologySlugContent,
  numerologySlugHead,
  numerologySlugPage,
} from '../features/tools/numerology/slug-route.ts'
import { getLocale } from '../paraglide/runtime.js'

// 东方站排盘入口（openspec add-bazi-saju-chart 决策 7；separate-landing-homepage design.md D1）：
// `/zh-hant/八字排盤`、`/zh-hans/八字排盘`、`/ko/만세력`（主工具页，迁移前在语言首页）、
// `/zh-hant/紫微斗數排盤`、`/zh-hant/命盤查詢`、`/ko/사주궁합`。
// slug ↔ 页面映射在 eastern-routes.ts，未登记的 slug（含其他语言）返回 404。
// 西方站新语言的数字命理单段页面（`/es/numero-de-vida`、`/es/calculadora-numerologia` 等，add-locales-eu-ja 决策 2）
// 也由本路由承接（features/tools/numerology/slug-route.ts），不再每页一个路由文件（首页包预算，决策 11）。

// 各页面组件按 id 懒加载：紫微页不下载八字主页代码，反之亦然。loader 先预载当前页面的组件，
// SSR 与客户端导航都不会挂起；水合时由 Suspense 保留服务端 HTML，组件就绪后再水合（与 routes/index.tsx 相同）。
const BaziHome = lazyRouteComponent(
  () => import('../features/tools/bazi/bazi-home.tsx'),
  'BaziHome',
)
const ManseryeokHome = lazyRouteComponent(
  () => import('../features/tools/bazi/manseryeok-home.tsx'),
  'ManseryeokHome',
)
const ZiweiPage = lazyRouteComponent(
  () => import('../features/tools/bazi/ziwei-page.tsx'),
  'ZiweiPage',
)
const MingpanPage = lazyRouteComponent(
  () => import('../features/tools/bazi/mingpan-page.tsx'),
  'MingpanPage',
)
const GunghapPage = lazyRouteComponent(
  () => import('../features/tools/bazi/gunghap-page.tsx'),
  'GunghapPage',
)
const NumerologySlugPage = lazyRouteComponent(
  () => import('../features/tools/numerology/slug-page.tsx'),
  'NumerologySlugPage',
)

// 东方站根路径英文（openspec add-locales-eu-ja 5b）：`/bazi-calculator`、`/zi-wei-dou-shu`，
// 以及塔罗索引页 `/tarot-spreads`、`/tarot-feelings`（两段地址见 routes/$section/$item.tsx）
const EastEnBaziPage = lazyRouteComponent(
  () => import('../features/east-en/tool-pages.tsx'),
  'EastEnBaziPage',
)
const EastEnZiweiPage = lazyRouteComponent(
  () => import('../features/east-en/tool-pages.tsx'),
  'EastEnZiweiPage',
)
const EastEnTarotPage = lazyRouteComponent(
  () => import('../features/east-en/tarot-pages.tsx'),
  'EastEnTarotPage',
)

/**
 * `bazi` 在韩语渲染만세력组件，在中文与日语渲染八字组件（日语标签来自 messages/ja/bazi.json），
 * 在东方站英文渲染英文计算器
 */
function pageComponent(id: EasternPageId, locale: string) {
  switch (id) {
    case 'bazi':
      return locale === 'en' ? EastEnBaziPage : locale === 'ko' ? ManseryeokHome : BaziHome
    case 'ziwei':
      return locale === 'en' ? EastEnZiweiPage : ZiweiPage
    case 'mingpan':
      return MingpanPage
    case 'gunghap':
      return GunghapPage
  }
}

export const Route = createFileRoute('/$slug')({
  beforeLoad: ({ params }) => {
    const locale = getLocale()
    // en 的未登记 slug 交给 loader：可能是东方站英文的塔罗索引页（features/east-en/route-data.ts）
    if (
      locale !== 'en' &&
      !easternPageOf(locale, params.slug) &&
      !numerologySlugPage(locale, params.slug)
    )
      throw notFound()
  },
  loader: async ({ params }) => {
    const locale = getLocale()
    const west = numerologySlugPage(locale, params.slug)
    if (west) {
      const [content] = await Promise.all([
        numerologySlugContent(west),
        NumerologySlugPage.preload?.(),
      ])
      return { west: { ...west, content } }
    }
    const id = easternPageOf(locale, params.slug)
    if (!id) {
      if (locale !== 'en') throw notFound()
      const [{ eastEnTarotData }] = await Promise.all([
        import('../features/east-en/route-data.ts'),
        EastEnTarotPage.preload?.(),
      ])
      const tarot = await eastEnTarotData(`/${params.slug}`)
      if (!tarot) throw notFound()
      return { west: null, tarot, eastEn: tarot.head }
    }
    await pageComponent(id, locale).preload?.()
    // 东方站英文的 head 数据按需加载（不把英文文案带进入口包，features/east-en/route-data.ts）
    if (locale === 'en' && (id === 'bazi' || id === 'ziwei')) {
      const { eastEnToolHead, toHead } = await import('../features/east-en/route-data.ts')
      return { west: null, eastEn: toHead(eastEnToolHead(id)) }
    }
    return { west: null }
  },
  head: ({ params, matches, loaderData }) => {
    if (loaderData && 'eastEn' in loaderData && loaderData.eastEn) return loaderData.eastEn
    const locale = getLocale()
    if (loaderData?.west)
      return numerologySlugHead(loaderData.west, loaderData.west.content, matches)
    const id = easternPageOf(locale, params.slug)
    if (!id) return {}
    const page = { path: `/${decodeURIComponent(params.slug)}`, locale, ...easternPageCopy(id) }
    return easternToolHead(
      page,
      originFromMatches(matches),
      id === 'bazi' ? baziToolStructuredData(page) : [],
    )
  },
  component: EasternToolRoute,
})

function EasternToolRoute() {
  const { slug } = Route.useParams()
  const data = Route.useLoaderData()
  const { west } = data
  if (west) return <NumerologySlugPage id={west.id} content={west.content} />
  if ('tarot' in data && data.tarot) return <EastEnTarotPage data={data.tarot} />
  const locale = getLocale()
  const id = easternPageOf(locale, slug)
  if (!id) return null
  const Page = pageComponent(id, locale)
  return (
    <MarketingShell>
      <Suspense>
        <Page />
      </Suspense>
    </MarketingShell>
  )
}
