import type { RegisteredToolRoute } from '../../tools/registry.ts'
import type { WestContentRoute } from '../routes.ts'

/**
 * 三巨头计算器与出生星盘的地址（openspec content-growth-v2-tools 决策 2、19，第 23 组）：只有 en。
 * 只放字面量：西方内容路由映射、注册表、站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 */
export const NATAL_LOCALE = 'en'
export const NATAL_PATHS = {
  'rising-sign-calculator': '/rising-sign-calculator',
  'birth-chart': '/birth-chart',
} as const

/** 页面标识即内容集合的 key（content/natal-chart/en/<key>.mdx） */
export type NatalPageId = keyof typeof NATAL_PATHS
export const NATAL_PAGE_IDS = Object.keys(NATAL_PATHS) as NatalPageId[]

export const NATAL_CONTENT_ROUTES: readonly WestContentRoute[] = NATAL_PAGE_IDS.map((id) => ({
  locale: NATAL_LOCALE,
  path: NATAL_PATHS[id],
  collection: 'natal-chart',
  id,
}))

/**
 * 注册表条目：两页都进「全部工具」的占星分组（directoryGroup: astrology）；页头下拉与首页精选由第 6 组的
 * 精选表决定（设计稿 B12、B13 属波次 B 上线后的首页改版，不在本组）。构建期预渲染表单与正文，结果在浏览器计算。
 */
export const NATAL_TOOL_ROUTES: readonly RegisteredToolRoute[] = [
  {
    id: 'rising-sign-calculator',
    site: 'west',
    paths: { en: NATAL_PATHS['rising-sign-calculator'] },
    titles: { en: 'Rising Sign Calculator' },
    descriptions: {
      en: 'Find your Sun, Moon and rising sign from your birth date, time and place, with the time zone and daylight saving time looked up for that date.',
    },
    directoryGroup: 'astrology',
    freeLabel: 'free_calculate',
    badge: { kind: 'new', until: '2027-02-28' },
  },
  {
    id: 'birth-chart',
    site: 'west',
    paths: { en: NATAL_PATHS['birth-chart'] },
    titles: { en: 'Birth Chart Calculator' },
    descriptions: {
      en: 'A free birth chart with the chart wheel, each planet’s sign, degree and house, the house cusps and the aspects between the planets.',
    },
    directoryGroup: 'astrology',
    freeLabel: 'free_chart',
    badge: { kind: 'new', until: '2027-02-28' },
  },
]
