import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'
import { type AngelNumberPageData, getAngelNumberPage } from './page.functions.ts'
import { HubPage, NumberPage } from './pages.tsx'

/** 西方内容分发（features/west-content/route-data.ts）的 angel numbers 入口：本模块随枢纽与数字页按需加载 */
export async function load(route: WestContentRoute): Promise<WestContentPayload | null> {
  return getAngelNumberPage({ data: { locale: route.locale, id: route.id } })
}

export function Page({ data }: { data: WestContentData }) {
  const page = data.content as AngelNumberPageData
  return page.kind === 'hub' ? <HubPage page={page} /> : <NumberPage page={page} />
}
