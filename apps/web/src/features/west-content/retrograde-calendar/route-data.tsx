import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'
import { RetrogradePage } from './pages.tsx'
import { RETROGRADE_LOCALE, RETROGRADE_PAGE_ID } from './paths.ts'
import { getRetrogradePage, type RetroPayload } from './retrograde.functions.ts'

/**
 * 西方内容分发（features/west-content/route-data.ts）的逆行日历入口：本模块随页面按需加载，
 * 不引入内容集合与 astronomy-engine（停滞表经 server function 读取）。
 */
export async function load(route: WestContentRoute): Promise<WestContentPayload | null> {
  if (route.locale !== RETROGRADE_LOCALE || route.id !== RETROGRADE_PAGE_ID) return null
  return getRetrogradePage()
}

export function Page({ data }: { data: WestContentData }) {
  return <RetrogradePage payload={data.content as RetroPayload} />
}
