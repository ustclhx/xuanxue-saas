import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { Suspense } from 'react'
import { eastContentRouteOf } from '../features/east-content/routes.ts'
import { eastEnContentRouteOf } from '../features/east-en/paths.ts'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches } from '../features/seo/metadata.ts'
import { siteOfLocale } from '../features/site/site.ts'
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
import { TOOL_ROUTES } from '../features/tools/registry.ts'
import { westContentRouteOf } from '../features/west-content/routes.ts'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

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
const EastContentPage = lazyRouteComponent(
  () => import('../features/east-content/route-data.ts'),
  'EastContentPage',
)
const WestContentPage = lazyRouteComponent(
  () => import('../features/west-content/route-data.ts'),
  'WestContentPage',
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
  // 黄历等工具的查询参数变化时，客户端重新读取页面数据与 head。
  loaderDeps: ({ search }) => ({ ...search, date: 'date' in search ? search.date : undefined }),
  loader: async ({ params, deps, parentMatchPromise }) => {
    const locale = getLocale()
    const path = `/${params.slug}`
    const site =
      locale === 'en'
        ? (await parentMatchPromise).loaderData?.site.id
        : siteOfLocale(locale, templateConfig)

    if (site === 'west') {
      const numerology = numerologySlugPage(locale, params.slug)
      if (numerology) {
        const [content] = await Promise.all([
          numerologySlugContent(numerology),
          NumerologySlugPage.preload?.(),
        ])
        return { numerology: { ...numerology, content } }
      }
      const route = westContentRouteOf(locale, path)
      if (!route) throw notFound()
      const [{ loadWestContent }] = await Promise.all([
        import('../features/west-content/route-data.ts'),
        WestContentPage.preload?.(),
      ])
      return { westContent: await loadWestContent(route, deps) }
    }

    if (site !== 'east') throw notFound()
    const id = easternPageOf(locale, params.slug)
    // 合盘地址随本组预留，正式发布语言以工具注册表为准。
    if (id === 'gunghap' && !TOOL_ROUTES.find((tool) => tool.id === 'saju-gunghap')?.paths[locale])
      throw notFound()
    if (id) {
      await pageComponent(id, locale).preload?.()
      if (locale === 'en' && (id === 'bazi' || id === 'ziwei')) {
        const { eastEnToolHead, toHead } = await import('../features/east-en/route-data.ts')
        return { easternTool: id, eastEnToolHead: toHead(eastEnToolHead(id)) }
      }
      return { easternTool: id }
    }

    const route = locale === 'en' ? eastEnContentRouteOf(path) : eastContentRouteOf(locale, path)
    if (route) {
      const [{ loadEastContent }] = await Promise.all([
        import('../features/east-content/route-data.ts'),
        EastContentPage.preload?.(),
      ])
      return { eastContent: await loadEastContent(route, deps.date, deps) }
    }
    if (locale === 'en' && (path === '/tarot-spreads' || path === '/tarot-feelings')) {
      const [{ eastEnTarotData }] = await Promise.all([
        import('../features/east-en/route-data.ts'),
        EastEnTarotPage.preload?.(),
      ])
      const tarot = await eastEnTarotData(path)
      if (tarot) return { tarot }
    }
    throw notFound()
  },
  head: ({ params, matches, loaderData }) => {
    if (loaderData?.eastEnToolHead) return loaderData.eastEnToolHead
    if (loaderData?.eastContent) return loaderData.eastContent.head
    if (loaderData?.westContent) return loaderData.westContent.head
    if (loaderData?.tarot) return loaderData.tarot.head
    if (loaderData?.numerology)
      return numerologySlugHead(loaderData.numerology, loaderData.numerology.content, matches)
    const id = loaderData?.easternTool
    if (!id) return {}
    const locale = getLocale()
    const page = {
      site: 'east' as const,
      path: `/${decodeURIComponent(params.slug)}`,
      locale,
      ...easternPageCopy(id),
    }
    return easternToolHead(
      page,
      originFromMatches(matches),
      id === 'bazi' ? baziToolStructuredData(page) : [],
    )
  },
  component: EasternToolRoute,
})

function EasternToolRoute() {
  const data = Route.useLoaderData()
  const { numerology } = data
  if (numerology) return <NumerologySlugPage id={numerology.id} content={numerology.content} />
  if (data.tarot) return <EastEnTarotPage data={data.tarot} />
  if (data.eastContent) return <EastContentPage data={data.eastContent} />
  if (data.westContent) return <WestContentPage data={data.westContent} />
  if (!data.easternTool) return null
  const Page = pageComponent(data.easternTool, getLocale())
  return (
    <MarketingShell>
      <Suspense>
        <Page />
      </Suspense>
    </MarketingShell>
  )
}
