import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import { getTaiSuiYearPage, type TaiSuiYearPageData } from './page.functions.ts'
import { TaiSuiYearPage } from './page.tsx'
import { TAI_SUI_YEAR_LOCALE } from './paths.ts'

/** 东方内容分发（features/east-content/route-data.ts）的年度太歲集合入口：本模块随页面按需加载 */
export async function load(route: EastContentRoute): Promise<EastContentPayload | null> {
  if (route.locale !== TAI_SUI_YEAR_LOCALE) return null
  return getTaiSuiYearPage({ data: { year: Number(route.id) } })
}

export function Page({ data }: { data: EastContentData }) {
  return <TaiSuiYearPage page={data.content as TaiSuiYearPageData} />
}
