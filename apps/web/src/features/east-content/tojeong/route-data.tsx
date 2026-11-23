import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import { getTojeongPage, type TojeongPageData } from './page.functions.ts'
import { hasTojeongShareQuery, TOJEONG_LOCALE } from './paths.ts'
import { TojeongToolPage } from './tool-page.tsx'

/**
 * 토정비결集合的 loader 与页面（东方内容分发，features/east-content/route-data.ts）。
 * 查询参数来自 `$slug` 的 loaderDeps：带分享参数时 head 为 noindex, follow。
 */
export async function load(
  route: EastContentRoute,
  _date: unknown,
  search: Readonly<Record<string, unknown>> = {},
): Promise<EastContentPayload | null> {
  if (route.locale !== TOJEONG_LOCALE || route.id !== 'tool') return null
  return getTojeongPage({ data: { share: hasTojeongShareQuery(search) } })
}

export function Page({ data }: { data: EastContentData }) {
  return (
    <MarketingShell>
      <TojeongToolPage page={data.content as TojeongPageData} />
    </MarketingShell>
  )
}
