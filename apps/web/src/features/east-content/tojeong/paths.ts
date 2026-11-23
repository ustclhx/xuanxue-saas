import { localeText } from '../../i18n/split-messages.ts'
import type { ToolRoute } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'

/**
 * 토정비결工具的地址（openspec content-growth-v2-tools 决策 2、8，第 15 组）：只有 ko 一页。
 * 本文件随注册表进入入口包，只放字面量，不引用运行时模块。
 */
export const TOJEONG_LOCALE = 'ko'
export const TOJEONG_PATH = '/토정비결'

/** 目标年份：默认 2027，可选前后各一年（解读与年份无关，年份只影响三괘的计算） */
export const TOJEONG_DEFAULT_YEAR = 2027
export const TOJEONG_YEARS = [2026, 2027, 2028] as const

/**
 * 分享参数：只带괘 번호与目标年份，不带出生资料（同合盘分享的隐私规则）。
 * 带任一参数的地址 `noindex, follow`、canonical 指向工具页、不进站点地图（决策 8「索引」）。
 */
export const TOJEONG_SHARE_PARAMS = ['gwae', 'year'] as const
export const TOJEONG_QUERY_ROBOTS = 'noindex, follow'

export function hasTojeongShareQuery(
  search: URLSearchParams | Readonly<Record<string, unknown>>,
): boolean {
  return TOJEONG_SHARE_PARAMS.some((key) =>
    search instanceof URLSearchParams ? search.has(key) : search[key] !== undefined,
  )
}

/** 상괘 1–8、중괘 1–6、하괘 1–3 组成的괘 번호（111–863） */
export function isGwaeNumber(value: number): boolean {
  if (!Number.isInteger(value)) return false
  const sang = Math.floor(value / 100)
  const jung = Math.floor(value / 10) % 10
  const ha = value % 10
  return sang >= 1 && sang <= 8 && jung >= 1 && jung <= 6 && ha >= 1 && ha <= 3
}

export const TOJEONG_CONTENT_ROUTES: readonly EastContentRoute[] = [
  { locale: TOJEONG_LOCALE, path: TOJEONG_PATH, collection: 'tojeong', id: 'tool' },
]

/**
 * 注册表条目：年度类工具（全部工具页 `yearly` 组），2027 小标显示到 2027-02-28（同个人年度工具）。
 * 预渲染；分享参数地址的 noindex 由 head 与静态页响应头共同保证（site/static-pages.ts）。
 */
export const TOJEONG_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'tojeong',
    site: 'east',
    directoryGroup: 'yearly',
    freeLabel: 'free_cast',
    badge: { kind: 'year', label: '2027', until: '2027-02-28' },
    paths: { ko: TOJEONG_PATH },
    titles: { ko: '토정비결' },
    // ko 是拆分语言：描述只在 ko 页面加载（add-locales-eu-ja 决策 11）
    descriptions: localeText({
      ko: '음력 생년월일과 목표 연도로 상괘·중괘·하괘를 계산하고 144괘 가운데 해당 괘의 풀이를 보여 드립니다.',
    }),
  },
]
