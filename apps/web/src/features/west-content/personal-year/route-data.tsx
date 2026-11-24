import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'
import { getPersonalYearPage, type PersonalYearPayload } from './page.functions.ts'
import { CalculatorPage, NumberPage } from './pages.tsx'
import { isPersonalYearLocale } from './paths.ts'

/** 西方内容分发（features/west-content/route-data.ts）的 personal year 集合入口：本模块随这些页按需加载 */
export async function load(route: WestContentRoute): Promise<WestContentPayload | null> {
  if (!isPersonalYearLocale(route.locale)) return null
  return getPersonalYearPage({ data: { locale: route.locale, id: route.id } })
}

export function Page({ data }: { data: WestContentData }) {
  const payload = data.content as PersonalYearPayload
  return payload.kind === 'calculator' ? (
    <CalculatorPage payload={payload} />
  ) : (
    <NumberPage key={payload.path} payload={payload} />
  )
}
