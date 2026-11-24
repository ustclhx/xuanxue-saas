import type { SiteId } from '@xuanxue/config'
import { m } from '../../../paraglide/messages.js'
import type { DirectoryEntry } from '../directory.ts'
import type { ToolDirectoryGroup, ToolFreeLabel } from '../registry.ts'

export { badgeText } from './badge.ts'

// 工具卡的显示文案（首页精选、页头下拉与「全部工具」枢纽页共用）：动作式免费标签、小标、名称、一句话说明与字形。
// 入口卡属于免费区：这里的文案不写 AI，也不标付费（specs/tool-directory「免费与付费标注」）。

const FREE_LABEL: Readonly<Record<ToolFreeLabel, () => string>> = {
  free_chart: m.tools_hub_free_chart,
  free_compatibility: m.tools_hub_free_compatibility,
  free_lookup: m.tools_hub_free_lookup,
  free_draw: m.tools_hub_free_draw,
  free_cast: m.tools_hub_free_cast,
  free_calculate: m.tools_hub_free_calculate,
}

export function freeLabelText(label: ToolFreeLabel | undefined): string | null {
  return label ? FREE_LABEL[label]() : null
}

const GROUP: Readonly<Record<ToolDirectoryGroup, readonly [() => string, () => string]>> = {
  chart: [m.tools_hub_group_chart, m.tools_hub_group_chart_intro],
  relation: [m.tools_hub_group_relation, m.tools_hub_group_relation_intro],
  yearly: [m.tools_hub_group_yearly, m.tools_hub_group_yearly_intro],
  divination: [m.tools_hub_group_divination, m.tools_hub_group_divination_intro],
  calendar: [m.tools_hub_group_calendar, m.tools_hub_group_calendar_intro],
  knowledge: [m.tools_hub_group_knowledge, m.tools_hub_group_knowledge_intro],
  tarot: [m.tools_hub_group_tarot, m.tools_hub_group_tarot_intro],
  numerology: [m.tools_hub_group_numerology, m.tools_hub_group_numerology_intro],
  astrology: [m.tools_hub_group_astrology, m.tools_hub_group_astrology_intro],
  moon: [m.tools_hub_group_moon, m.tools_hub_group_moon_intro],
  compatibility: [m.tools_hub_group_compatibility, m.tools_hub_group_compatibility_intro],
}

export function groupCopy(group: ToolDirectoryGroup): { title: string; intro: string } {
  const [title, intro] = GROUP[group]
  return { title: title(), intro: intro() }
}

/** 工具卡的一句话说明；没有专属说明的工具用注册表的 SEO 描述 */
const SUMMARY: Readonly<Record<string, () => string>> = {
  bazi: m.home_hub_tool_bazi,
  ziwei: m.home_hub_tool_ziwei,
  mingpan: m.home_hub_tool_mingpan,
  'saju-gunghap': m.home_hub_tool_saju_gunghap,
  'tarot-three-card': m.home_hub_tool_tarot_three_card,
  'tarot-daily': m.tools_hub_tool_tarot_daily,
  'tarot-yes-or-no': m.tools_hub_tool_tarot_yes_or_no,
  'tarot-celtic-cross': m.tools_hub_tool_tarot_celtic_cross,
  'tarot-card-index': m.tools_hub_tool_tarot_card_index,
  daily: m.home_hub_daily_desc,
  'daily-numerology': m.home_hub_daily_desc,
  almanac: m.tools_hub_tool_almanac,
  zodiac: m.tools_hub_tool_zodiac,
  'life-path': m.home_hub_tool_life_path,
  'numerology-calculator': m.home_hub_tool_numerology_calculator,
  numerology: m.tools_hub_tool_numerology,
  'life-path-compatibility': m.home_hub_tool_life_path_compatibility,
}

/**
 * 卡片上的名称与注册表导航名不同的工具：life-path 的导航名是「Life Path」，牌义索引的导航名是 Title 长句。
 * 都取已有的主词（落地页工具名、牌义索引的面包屑名），与站内其他入链的锚文本一致。
 */
const TITLE: Readonly<Record<string, () => string>> = {
  'life-path': m.landing_tool_title_life_path,
  'tarot-card-index': m.tarot_index_crumb,
  // 导航名只有「Compatibility」；站内入链的锚文本一直是「Life path compatibility」（原首页文字链接）
  'life-path-compatibility': () => m.landing_more_tool_link().replace(/\s*→\s*$/, ''),
}

/** 东方站根路径英文里与站内既有锚文本写法一致的名称（features/east-en/copy/landing.ts 的工具卡标题） */
const EAST_ENGLISH_TITLE: Readonly<Record<string, string>> = {
  'tarot-three-card': 'Past Present Future Tarot',
}

/** 东方站根路径英文与西方站共用 en 文案：名称与说明按西方站写的条目在东方站英文改用注册表 */
const WEST_WORDED: ReadonlySet<string> = new Set(['tarot-card-index', 'tarot-three-card'])

const eastEnglish = (site: SiteId, locale: string) => site === 'east' && locale === 'en'

export function toolTitle(tool: DirectoryEntry, site: SiteId, locale: string): string {
  if (eastEnglish(site, locale) && WEST_WORDED.has(tool.id))
    return EAST_ENGLISH_TITLE[tool.id] ?? tool.title
  return TITLE[tool.id]?.() ?? tool.title
}

export function toolSummary(tool: DirectoryEntry, site: SiteId, locale: string): string {
  // 东方站英文的牌义索引是「as feelings」牌页，说明另写；三张牌的说明两站通用
  if (eastEnglish(site, locale) && tool.id === 'tarot-card-index')
    return 'All 78 cards read as feelings, one page each.'
  return SUMMARY[tool.id]?.() ?? tool.description ?? ''
}

/** 落地页已有字形的工具（文案在 landing.json，按语言不同） */
const GLYPH_MESSAGE: Readonly<Record<string, () => string>> = {
  bazi: m.landing_tool_glyph_bazi,
  ziwei: m.landing_tool_glyph_ziwei,
  mingpan: m.landing_tool_glyph_mingpan,
  'saju-gunghap': m.landing_tool_glyph_saju_gunghap,
  'tarot-three-card': m.landing_tool_glyph_tarot,
  'life-path': m.landing_tool_glyph_life_path,
  'numerology-calculator': m.landing_tool_glyph_numerology_calculator,
}

/** 不随语言变化的字形（数字与符号） */
const GLYPH: Readonly<Record<string, string>> = {
  'tarot-daily': '1',
  'tarot-yes-or-no': '?',
  'tarot-celtic-cross': '10',
  'tarot-love': '5',
  'tarot-career': '4',
  'tarot-full-moon': '○',
  'tarot-card-index': '78',
  'daily-numerology': '7',
  'life-path-compatibility': '2',
  numerology: '∑',
  'moon-phase-today': '☾',
  'full-moon-calendar': '○',
  'western-zodiac-signs': '♈',
  'western-zodiac-compatibility': '♌',
  'angel-numbers': '11',
  'personal-year': '5',
}

/** 工具卡的大号字形（装饰，对读屏隐藏）：没有登记的工具取名称里的第一个文字 */
export function toolGlyph(tool: DirectoryEntry, title: string, locale: string): string {
  // 东方英文卡片沿用总工具页画板上生肖配对的「配」字。
  if (tool.id === 'zodiac-pair' && locale === 'en') return '配'
  return (
    GLYPH_MESSAGE[tool.id]?.() ??
    GLYPH[tool.id] ??
    (/\p{L}/u.exec(title)?.[0] ?? '').toLocaleUpperCase()
  )
}
