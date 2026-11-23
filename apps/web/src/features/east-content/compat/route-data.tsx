import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import { type CompatPageData, getCompatPage } from './page.functions.ts'
import { CompatPage } from './pages.tsx'

/**
 * 合盘集合的 loader 与页面（东方内容分发，features/east-content/route-data.ts）：
 * `compat` 是工具页正文（id `tool`），`compat-scenario` 目录复用本模块渲染 5 个场景页。
 */
export async function load(route: EastContentRoute): Promise<EastContentPayload | null> {
  const page = route.collection === 'compat' ? 'index' : route.id
  return getCompatPage({ data: { locale: route.locale, page } })
}

export function Page({ data }: { data: EastContentData }) {
  return <CompatPage page={data.content as CompatPageData} />
}
