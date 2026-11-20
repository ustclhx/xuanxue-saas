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
import { getLocale } from '../paraglide/runtime.js'

// 东方站排盘入口（openspec add-bazi-saju-chart 决策 7；separate-landing-homepage design.md D1）：
// `/zh-hant/八字排盤`、`/zh-hans/八字排盘`、`/ko/만세력`（主工具页，迁移前在语言首页）、
// `/zh-hant/紫微斗數排盤`、`/zh-hant/命盤查詢`、`/ko/사주궁합`。
// slug ↔ 页面映射在 eastern-routes.ts，未登记的 slug（含其他语言）返回 404。

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

/** `bazi` 在韩语渲染만세력组件，在中文与日语渲染八字组件（日语标签来自 messages/ja/bazi.json） */
function pageComponent(id: EasternPageId, locale: string) {
  switch (id) {
    case 'bazi':
      return locale === 'ko' ? ManseryeokHome : BaziHome
    case 'ziwei':
      return ZiweiPage
    case 'mingpan':
      return MingpanPage
    case 'gunghap':
      return GunghapPage
  }
}

export const Route = createFileRoute('/$slug')({
  beforeLoad: ({ params }) => {
    if (!easternPageOf(getLocale(), params.slug)) throw notFound()
  },
  loader: async ({ params }) => {
    const locale = getLocale()
    const id = easternPageOf(locale, params.slug)
    if (id) await pageComponent(id, locale).preload?.()
  },
  head: ({ params, matches }) => {
    const locale = getLocale()
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
