import type { ToolRoute } from '../../tools/registry.ts'
import {
  ALMANAC_MONTHS,
  ALMANAC_TOOL_PATHS,
  type AlmanacLocale,
  almanacMonthPath,
} from './paths.ts'

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

/** 農民曆（zh-Hant）的节气名 */
const MONTH_TERM_NAMES_HANT: Readonly<Record<number, readonly [string, string]>> = {
  ...MONTH_TERM_NAMES,
  3: ['驚蟄', '春分'],
  4: ['清明', '穀雨'],
  5: ['立夏', '小滿'],
  6: ['芒種', '夏至'],
  8: ['立秋', '處暑'],
}

export function monthTermNames(month: number, locale: AlmanacLocale): readonly string[] {
  return (locale === 'zh-Hant' ? MONTH_TERM_NAMES_HANT : MONTH_TERM_NAMES)[month] ?? []
}

/**
 * 注册表条目（features/tools/registry.ts，openspec content-growth-phase2 决策 5）：
 * `prerender: false` 让黄历留在 SSR + 边缘缓存（内容随参考日期滚动），仍进站点地图、hreflang 与 llms.txt；
 * 站点地图只含不带参数的地址。工具页进页头「历法与生肖」分组（设计稿 EastNavVariant 方案 C，排在十二生肖之前），月份页 `nav: false`。
 * 标题是面包屑与内链区块的主词。zh-Hant 農民曆（content-growth-v2-tools 第 18 组）与 zh-Hans 黄历同一条目，互为 hreflang。
 * 简中、繁中都不是拆分语言，描述不经 localeText。
 */
export const ALMANAC_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'almanac',
    site: 'east',
    navGroup: 'calendar',
    prerender: false,
    paths: { 'zh-Hans': ALMANAC_TOOL_PATHS['zh-Hans'], 'zh-Hant': ALMANAC_TOOL_PATHS['zh-Hant'] },
    titles: { 'zh-Hans': '黄历', 'zh-Hant': '農民曆' },
    descriptions: {
      'zh-Hans': '选择任意日期，查看当天干支、农历、宜忌、建除十二值星、黄道黑道与冲煞。',
      'zh-Hant': '挑一個國曆日期，查看當天日柱、農曆、宜忌、十二建星、沖煞與胎神占方。',
    },
  },
  ...ALMANAC_MONTHS.map(
    (month): ToolRoute => ({
      id: `almanac-month-${month}`,
      site: 'east',
      nav: false,
      prerender: false,
      paths: {
        'zh-Hans': almanacMonthPath(month, 'zh-Hans'),
        'zh-Hant': almanacMonthPath(month, 'zh-Hant'),
      },
      titles: { 'zh-Hans': `${month}月黄历`, 'zh-Hant': `${month}月農民曆` },
      descriptions: {
        'zh-Hans': `逐日列出${month}月的宜忌、建除、黄道黑道与冲煞，以及${MONTH_TERM_NAMES[month]?.join('、')}的交节时刻。`,
        'zh-Hant': `${month}月每天的宜忌、建星、沖煞與胎神一覽，附${MONTH_TERM_NAMES_HANT[month]?.join('、')}的交節時間。`,
      },
    }),
  ),
]
