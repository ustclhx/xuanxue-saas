import type { RegisteredToolRoute } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'

/**
 * 2027 太歲页的地址（openspec content-growth-v2-tools 决策 2、10，第 18 组）：只有 zh-hant `/2027太歲`。
 * zh-Hans「太岁」「犯太岁」归第 2 阶段太岁概念页（决策 13），这里不建简中对应页。
 * 只放字面量：路由映射、注册表与站点地图都从这里读取，不得引用运行时模块。
 */
export const TAI_SUI_YEAR_LOCALE = 'zh-Hant'
export const TAI_SUI_YEARS = [2027] as const
export type TaiSuiYear = (typeof TAI_SUI_YEARS)[number]

export const taiSuiYearPath = (year: number): `/${string}` => `/${year}太歲`

export const TAI_SUI_YEAR_CONTENT_ROUTES: readonly EastContentRoute[] = TAI_SUI_YEARS.map(
  (year) => ({
    locale: TAI_SUI_YEAR_LOCALE,
    path: taiSuiYearPath(year),
    collection: 'tai-sui-year',
    id: String(year),
  }),
)

/**
 * 注册表条目：构建期预渲染（内容不随日期变化），不进页头导航；全部工具页列在「年运」分组，
 * 「2027」小标显示到 2027-02-28（同个人年度工具，决策 5）。
 */
export const TAI_SUI_YEAR_TOOL_ROUTES: readonly RegisteredToolRoute[] = TAI_SUI_YEARS.map(
  (year) => ({
    id: `tai-sui-${year}`,
    site: 'east',
    nav: false,
    directoryGroup: 'yearly',
    freeLabel: 'free_lookup',
    badge: { kind: 'year', label: String(year), until: `${year}-02-28` },
    paths: { [TAI_SUI_YEAR_LOCALE]: taiSuiYearPath(year) },
    titles: { [TAI_SUI_YEAR_LOCALE]: `${year}太歲` },
    descriptions: {
      [TAI_SUI_YEAR_LOCALE]: `${year}丁未年值、沖、刑、害、破太歲的生肖與出生年份對照，附安太歲的民俗由來。`,
    },
  }),
)
