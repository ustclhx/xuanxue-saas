import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'
import { getWesternZodiacPage, type WesternZodiacPageData } from './page.functions.ts'
import { ChartPage, HubPage, PairPage, SignPage } from './pages.tsx'

/** 西方内容分发（features/west-content/route-data.ts）的星座集合入口：本模块随星座页按需加载 */
export async function load(route: WestContentRoute): Promise<WestContentPayload | null> {
  if (route.locale !== 'en') return null
  return getWesternZodiacPage({ data: { id: route.id } })
}

export function Page({ data }: { data: WestContentData }) {
  const page = data.content as WesternZodiacPageData
  switch (page.kind) {
    case 'hub':
      return <HubPage page={page} />
    case 'chart':
      return <ChartPage page={page} />
    case 'sign':
      return <SignPage page={page} />
    default:
      return <PairPage page={page} />
  }
}
