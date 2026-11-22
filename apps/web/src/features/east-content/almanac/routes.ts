import type { ToolRoute } from '../../tools/registry.ts'
import { ALMANAC_MONTHS, ALMANAC_TOOL_PATH, almanacMonthPath } from './paths.ts'

/** 各月的两个节气（公历月内先交「节」、后交「中气」），注册表描述与月份页说明共用 */
export const MONTH_TERM_NAMES: Readonly<Record<number, readonly [string, string]>> = {
  1: ['小寒', '大寒'],
  2: ['立春', '雨水'],
  3: ['惊蛰', '春分'],
  4: ['清明', '谷雨'],
  5: ['立夏', '小满'],
  6: ['芒种', '夏至'],
  7: ['小暑', '大暑'],
  8: ['立秋', '处暑'],
  9: ['白露', '秋分'],
  10: ['寒露', '霜降'],
  11: ['立冬', '小雪'],
  12: ['大雪', '冬至'],
}

/**
 * 注册表条目（features/tools/registry.ts，openspec content-growth-phase2 决策 5）：
 * `prerender: false` 让黄历留在 SSR + 边缘缓存（内容随参考日期滚动），仍进站点地图、hreflang 与 llms.txt；
 * 站点地图只含这 13 个不带参数的地址。`nav: false`：页头入口待「历法与生肖」下拉分组（第 4 组）合并后再加。
 * 标题是面包屑与内链区块的主词。简中不是拆分语言，描述不经 localeText。
 */
export const ALMANAC_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'almanac',
    site: 'east',
    nav: false,
    prerender: false,
    paths: { 'zh-Hans': ALMANAC_TOOL_PATH },
    titles: { 'zh-Hans': '黄历' },
    descriptions: {
      'zh-Hans': '选择任意日期，查看当天干支、农历、宜忌、建除十二值星、黄道黑道与冲煞。',
    },
  },
  ...ALMANAC_MONTHS.map(
    (month): ToolRoute => ({
      id: `almanac-month-${month}`,
      site: 'east',
      nav: false,
      prerender: false,
      paths: { 'zh-Hans': almanacMonthPath(month) },
      titles: { 'zh-Hans': `${month}月黄历` },
      descriptions: {
        'zh-Hans': `逐日列出${month}月的宜忌、建除、黄道黑道与冲煞，以及${MONTH_TERM_NAMES[month]?.join('、')}的交节时刻。`,
      },
    }),
  ),
]
