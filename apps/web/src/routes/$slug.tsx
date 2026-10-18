import { createFileRoute, notFound } from '@tanstack/react-router'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches } from '../features/seo/metadata.ts'
import { easternPageOf } from '../features/tools/bazi/eastern-routes.ts'
import { GunghapPage } from '../features/tools/bazi/gunghap-page.tsx'
import { easternPageCopy, easternToolHead } from '../features/tools/bazi/head.ts'
import { MingpanPage } from '../features/tools/bazi/mingpan-page.tsx'
import { ZiweiPage } from '../features/tools/bazi/ziwei-page.tsx'
import { getLocale } from '../paraglide/runtime.js'

// 东方站排盘入口（openspec add-bazi-saju-chart 决策 7）：`/zh-hant/紫微斗數排盤`、`/zh-hant/命盤查詢`、
// `/ko/사주궁합`。slug ↔ 页面映射在 eastern-routes.ts，未登记的 slug（含其他语言）返回 404。
export const Route = createFileRoute('/$slug')({
  beforeLoad: ({ params }) => {
    if (!easternPageOf(getLocale(), params.slug)) throw notFound()
  },
  head: ({ params, matches }) => {
    const locale = getLocale()
    const id = easternPageOf(locale, params.slug)
    if (!id) return {}
    return easternToolHead(
      { path: `/${decodeURIComponent(params.slug)}`, locale, ...easternPageCopy(id) },
      originFromMatches(matches),
    )
  },
  component: EasternToolRoute,
})

function EasternToolRoute() {
  const { slug } = Route.useParams()
  const id = easternPageOf(getLocale(), slug)
  return (
    <MarketingShell>
      {id === 'ziwei' ? <ZiweiPage /> : id === 'mingpan' ? <MingpanPage /> : <GunghapPage />}
    </MarketingShell>
  )
}
