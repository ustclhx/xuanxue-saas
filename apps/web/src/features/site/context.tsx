import type { SiteId } from '@xuanxue/config'
import { createContext, useContext } from 'react'

/**
 * 当前站点（根布局按请求 Host 解析后提供）。工具页外壳与埋点通过它区分东方站 / 西方站，
 * 不直接依赖路由，便于组件单独渲染测试；未包裹时按西方站处理（与未登记 Host 一致）。
 */
export const SiteContext = createContext<SiteId>('west')

export function useSiteId(): SiteId {
  return useContext(SiteContext)
}
