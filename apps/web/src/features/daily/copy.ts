import type { Branch, LunarDate, Stem, TenGod } from '@xuanxue/bazi'
import type { NumberResult } from '@xuanxue/numerology'
import {
  BRANCH_ELEMENT,
  BRANCH_HANGUL,
  BRANCH_HANZI,
  STEM_ELEMENT,
  STEM_HANGUL,
  STEM_HANZI,
} from '../tools/bazi/glyphs.ts'
import { type CivilDate, dayNumber, parseDateKey } from './date.ts'
import type { EastRelationFact } from './facts.ts'
import { STEM_KEYS } from './facts.ts'
import {
  type DailyNumber,
  type DailyTip,
  type EastRules,
  HIDDEN_TABOOS,
  type WestRules,
} from './rules/types.ts'

/**
 * 「事实 → 文案」（design D6）：同一类事实有多条文案时按日期确定性轮换，
 * 再加上事实自身的序号作偏移，让十个日主在同一天不会都取到第几条。
 */

const TEN_GOD_ORDER: readonly TenGod[] = [
  'biJian',
  'jieCai',
  'shiShen',
  'shangGuan',
  'pianCai',
  'zhengCai',
  'qiSha',
  'zhengGuan',
  'pianYin',
  'zhengYin',
]

export function pick<T>(list: readonly T[], date: CivilDate | string, salt = 0): T {
  const civil = typeof date === 'string' ? parseDateKey(date) : date
  const seed = civil ? dayNumber(civil) : 0
  const index = (((seed + salt) % list.length) + list.length) % list.length
  return list[index] as T
}

export function tenGodTip(rules: EastRules, tenGod: TenGod, date: CivilDate | string): DailyTip {
  return pick(rules.tenGod[tenGod], date, TEN_GOD_ORDER.indexOf(tenGod))
}

/** 干支字形：韩语页用韩文读音，中文页用汉字 */
export function stemText(locale: string, stem: Stem): string {
  return locale === 'ko' ? STEM_HANGUL[stem] : STEM_HANZI[stem]
}

export function branchText(locale: string, branch: Branch): string {
  return locale === 'ko' ? BRANCH_HANGUL[branch] : BRANCH_HANZI[branch]
}

/** 「甲子」或「갑자(甲子)」 */
export function ganzhiText(locale: string, stem: Stem, branch: Branch): string {
  const hanzi = `${STEM_HANZI[stem]}${BRANCH_HANZI[branch]}`
  return locale === 'ko' ? `${STEM_HANGUL[stem]}${BRANCH_HANGUL[branch]}(${hanzi})` : hanzi
}

const ELEMENT_ZH: Record<string, readonly [string, string]> = {
  wood: ['木', '목'],
  fire: ['火', '화'],
  earth: ['土', '토'],
  metal: ['金', '금'],
  water: ['水', '수'],
}

/** 「子水」/「자수」：地支加本气五行 */
export function branchWithElement(locale: string, branch: Branch): string {
  const element = ELEMENT_ZH[BRANCH_ELEMENT[branch]] ?? ['', '']
  return `${branchText(locale, branch)}${locale === 'ko' ? element[1] : element[0]}`
}

/** 「庚金」/「경금」：日主加五行 */
export function stemWithElement(locale: string, stem: Stem): string {
  const element = ELEMENT_ZH[STEM_ELEMENT[stem]] ?? ['', '']
  return `${stemText(locale, stem)}${locale === 'ko' ? element[1] : element[0]}`
}

/** 关系标签「辰戌沖」「子辰半合」：当日地支在前，本命地支在后 */
export function relationLabel(
  rules: EastRules,
  dayBranch: Branch,
  relation: EastRelationFact,
): string {
  return `${branchText(rules.locale, dayBranch)}${branchText(rules.locale, relation.natalBranch)}${rules.relationName[relation.kind]}`
}

/** 关系提示：每条关系一句，按日期轮换；没有关系时给一条平稳提示 */
export function relationLines(
  rules: EastRules,
  relations: readonly EastRelationFact[],
  date: CivilDate | string,
): string[] {
  if (relations.length === 0) return [pick(rules.noRelation, date)]
  return relations.map((relation, index) =>
    pick(rules.relation[relation.kind], date, index).replace(
      '{pillar}',
      rules.pillar[relation.natal],
    ),
  )
}

/** 宜忌词条名称：去掉不展示的词条（医疗、法律与吉凶断语），最多 `limit` 条 */
export function tabooNames(
  rules: EastRules,
  indices: readonly number[],
  limit = Number.POSITIVE_INFINITY,
): string[] {
  return indices
    .filter((index) => !HIDDEN_TABOOS.has(index) && rules.taboo[index] !== undefined)
    .slice(0, limit)
    .map((index) => rules.taboo[index] as string)
}

/** 今日出现、且有释义的词条 */
export function tabooGlosses(
  rules: EastRules,
  indices: readonly number[],
): { name: string; gloss: string }[] {
  return indices.flatMap((index) => {
    const gloss = rules.tabooGloss[index]
    const name = rules.taboo[index]
    return gloss && name && !HIDDEN_TABOOS.has(index) ? [{ name, gloss }] : []
  })
}

const LUNAR_MONTHS = {
  'zh-Hant': ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'],
  'zh-Hans': ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'],
} as const
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function lunarDayName(day: number): string {
  if (day <= 10) return `初${DIGITS[day]}`
  if (day < 20) return `十${DIGITS[day - 10]}`
  if (day === 20) return '二十'
  if (day < 30) return `廿${DIGITS[day - 20]}`
  return '三十'
}

/** 农历日期：「十月廿六」「閏六月初三」；韩语「음력 10월 26일」「윤6월 3일」 */
export function lunarText(locale: string, lunar: LunarDate): string {
  if (locale === 'ko') return `${lunar.isLeapMonth ? '윤' : ''}${lunar.month}월 ${lunar.day}일`
  const months = locale === 'zh-Hans' ? LUNAR_MONTHS['zh-Hans'] : LUNAR_MONTHS['zh-Hant']
  const leap = lunar.isLeapMonth ? (locale === 'zh-Hans' ? '闰' : '閏') : ''
  return `${leap}${months[lunar.month - 1]}月${lunarDayName(lunar.day)}`
}

/** 十个日主（甲至癸）在当日的十神与提示，公开页的十个区块 */
export function stemOrder(): readonly Stem[] {
  return STEM_KEYS
}

/** 数字命理：只保留 1–9、11、22（引擎已保证），越界时退回个位 */
export function dailyNumber(value: number): DailyNumber {
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22] as const).includes(value as DailyNumber)
    ? (value as DailyNumber)
    : ((((value - 1) % 9) + 1) as DailyNumber)
}

export function personalTip(rules: WestRules, value: number, date: CivilDate | string): DailyTip {
  return pick(rules.number[dailyNumber(value)].personal, date, value)
}

export function universalLine(rules: WestRules, value: number, date: CivilDate | string): string {
  return pick(rules.number[dailyNumber(value)].universal, date)
}

/**
 * 归约算式行：每个阶段一行，如 `2026 → 2 + 0 + 2 + 6 = 10 → 1 + 0 = 1`；
 * 合计行为 `1 + 11 + 4 = 16 → 1 + 6 = 7`。`labels` 给出阶段名与该阶段的原始值。
 */
export function reductionLines(
  result: NumberResult,
  parts: readonly { phase: 'year' | 'month' | 'day'; label: string; raw: number }[],
): string[] {
  const lines = parts.map(({ phase, label, raw }) => {
    const chain = result.steps
      .filter((step) => step.phase === phase)
      .map((step) => `${step.operands.join(' + ')} = ${step.result}`)
    return [`${label} ${raw}`, ...chain].join(' → ')
  })
  const totals = result.steps.filter((step) => step.phase === 'total')
  const [sum, ...rest] = totals
  if (sum) {
    const tail = rest.map((step) => `${step.operands.join(' + ')} = ${step.result}`)
    lines.push([`${sum.operands.join(' + ')} = ${sum.result}`, ...tail].join(' → '))
  }
  return lines
}
