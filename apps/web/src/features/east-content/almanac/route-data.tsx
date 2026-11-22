import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import { type AlmanacPayload, getAlmanacPage } from './almanac.functions.ts'
import { almanacHead } from './head.ts'
import { AlmanacMonthPage } from './month-page.tsx'
import { AlmanacToolPage } from './tool-page.tsx'

/**
 * 黄历集合的 loader 与页面（东方内容分发，features/east-content/route-data.ts）。
 * 工具页的日期来自 `$slug` 路由的 loaderDeps（`?date=`）；月份页不读查询参数。
 * 查询参数可能被路由解析成数字（`?date=2026`），一律转成字符串交给服务端校验。
 */
export async function load(
  route: EastContentRoute,
  date: unknown,
): Promise<EastContentPayload | null> {
  const query =
    route.id === 'tool' && date !== undefined && date !== null ? String(date) : undefined
  const payload = await getAlmanacPage({ data: { id: route.id, date: query } })
  return { head: almanacHead(payload), content: payload }
}

export function Page({ data }: { data: EastContentData }) {
  const payload = data.content as AlmanacPayload
  return (
    <MarketingShell>
      {payload.kind === 'tool' ? (
        <AlmanacToolPage payload={payload} />
      ) : (
        <AlmanacMonthPage key={payload.month} payload={payload} />
      )}
    </MarketingShell>
  )
}
