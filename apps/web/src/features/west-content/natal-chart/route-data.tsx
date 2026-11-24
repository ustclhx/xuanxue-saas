import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'
import { getNatalPage, type NatalPayload } from './natal.functions.ts'
import { NatalPage } from './pages.tsx'
import { NATAL_LOCALE, NATAL_PAGE_IDS, type NatalPageId } from './paths.ts'

/**
 * 西方内容分发（features/west-content/route-data.ts）的星盘集合入口：本模块随两页按需加载。
 * 星历引擎（astronomy-engine）与地名切片在访客提交表单后才动态加载，不进入首屏与首页包。
 */
export async function load(route: WestContentRoute): Promise<WestContentPayload | null> {
  if (route.locale !== NATAL_LOCALE || !NATAL_PAGE_IDS.includes(route.id as NatalPageId))
    return null
  return getNatalPage({ data: { id: route.id as NatalPageId } })
}

export function Page({ data }: { data: WestContentData }) {
  const payload = data.content as NatalPayload
  return <NatalPage key={payload.id} payload={payload} />
}
