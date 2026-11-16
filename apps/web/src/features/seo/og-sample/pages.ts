import { TOOL_ROUTES, type ToolRoute } from '../../tools/registry.ts'

// 样例 OG 图的登记页面（openspec redesign-home-chart-visuals design D6、tasks 8.1 / 8.2）：
// 首页（东方站八字 / 만세력、西方站 Life Path）、紫微、命盤查詢与数字图表页使用带样例命盘图形的分享图，
// 其余公开页面沿用默认版式。按工具注册表的 id 登记，路径与语言随注册表变化，不在这里重复写路径。
// 本模块只含数据，构建脚本（vite 配置加载阶段）可直接导入，不能引用 Paraglide 文案或图形组件。

/** 样例图形种类，对应 charts/ 中的图形组件 */
export type OgSampleChart = 'pillars' | 'ziwei' | 'life-path' | 'digit-grid'

/** 工具 id → 样例图形；只有这里登记的工具页使用样例模板 */
export const OG_SAMPLE_TOOLS: Readonly<Record<string, OgSampleChart>> = {
  // 东方站繁简首页八字排盤与韩语首页만세력（同一条注册记录）
  bazi: 'pillars',
  mingpan: 'pillars',
  ziwei: 'ziwei',
  // 西方站首页
  'life-path': 'life-path',
  'numerology-chart': 'digit-grid',
}

const normalize = (path: string) => {
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    // 非法转义按原样比较
  }
  return decoded.replace(/\/+$/, '') || '/'
}

/** 页面使用的样例图形；未登记的页面返回 undefined（沿用默认分享图） */
export function ogSampleChart(
  page: { readonly locale: string; readonly path: string },
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): OgSampleChart | undefined {
  const path = normalize(page.path)
  for (const route of routes) {
    const chart = OG_SAMPLE_TOOLS[route.id]
    const routePath = route.paths[page.locale]
    if (chart && routePath !== undefined && normalize(routePath) === path) return chart
  }
  return undefined
}
