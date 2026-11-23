import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import { getYearlyPage, type YearlyPageData } from './page.functions.ts'
import { YearlyChildPage, YearlyHubPage } from './pages.tsx'
import { isYearlyLocale } from './paths.ts'

/** 东方内容分发（features/east-content/route-data.ts）的年度生肖集合入口：本模块随年度页按需加载 */
export async function load(route: EastContentRoute): Promise<EastContentPayload | null> {
  if (!isYearlyLocale(route.locale)) return null
  return getYearlyPage({ data: { locale: route.locale, id: route.id } })
}

export function Page({ data }: { data: EastContentData }) {
  const content = data.content as YearlyPageData
  return content.kind === 'hub' ? (
    <YearlyHubPage page={content} />
  ) : (
    <YearlyChildPage page={content} />
  )
}
