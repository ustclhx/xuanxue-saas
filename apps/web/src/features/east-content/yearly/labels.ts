import type { Branch, Element, Stem } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import { BRANCH_HANGUL, BRANCH_HANZI, STEM_HANGUL, STEM_HANZI } from '../../tools/bazi/glyphs.ts'
import { ELEMENT_LABEL } from '../../tools/bazi/labels.ts'
import type {
  DateParts,
  DateTimeParts,
  ElementRelation,
  YearlyRelation,
  YearlyTaiSui,
} from './data.ts'

/**
 * 年度生肖页的文案映射（messages/<locale>/yearly.json）：引擎只给稳定 key 与序号，这里换成当前语言的文字。
 * 组件不判断语言，各语言的差异都在文案里；只有干支的写法按语言选汉字或「韩文(汉字)」。
 */
type Message = () => string

const ANIMAL: Record<Branch, Message> = {
  zi: m.yearly_animal_zi,
  chou: m.yearly_animal_chou,
  yin: m.yearly_animal_yin,
  mao: m.yearly_animal_mao,
  chen: m.yearly_animal_chen,
  si: m.yearly_animal_si,
  wu: m.yearly_animal_wu,
  wei: m.yearly_animal_wei,
  shen: m.yearly_animal_shen,
  you: m.yearly_animal_you,
  xu: m.yearly_animal_xu,
  hai: m.yearly_animal_hai,
}

const NAYIN: readonly Message[] = [
  m.yearly_nayin_0,
  m.yearly_nayin_1,
  m.yearly_nayin_2,
  m.yearly_nayin_3,
  m.yearly_nayin_4,
  m.yearly_nayin_5,
  m.yearly_nayin_6,
  m.yearly_nayin_7,
  m.yearly_nayin_8,
  m.yearly_nayin_9,
  m.yearly_nayin_10,
  m.yearly_nayin_11,
  m.yearly_nayin_12,
  m.yearly_nayin_13,
  m.yearly_nayin_14,
  m.yearly_nayin_15,
  m.yearly_nayin_16,
  m.yearly_nayin_17,
  m.yearly_nayin_18,
  m.yearly_nayin_19,
  m.yearly_nayin_20,
  m.yearly_nayin_21,
  m.yearly_nayin_22,
  m.yearly_nayin_23,
  m.yearly_nayin_24,
  m.yearly_nayin_25,
  m.yearly_nayin_26,
  m.yearly_nayin_27,
  m.yearly_nayin_28,
  m.yearly_nayin_29,
]

export const RELATION_LABEL: Record<YearlyRelation, Message> = {
  sixCombine: m.yearly_rel_sixCombine,
  triad: m.yearly_rel_triad,
  clash: m.yearly_rel_clash,
  punish: m.yearly_rel_punish,
  harm: m.yearly_rel_harm,
  break: m.yearly_rel_break,
}

export const TAI_SUI_LABEL: Record<YearlyTaiSui, Message> = {
  zhi: m.yearly_taisui_zhi,
  chong: m.yearly_taisui_chong,
  xing: m.yearly_taisui_xing,
  hai: m.yearly_taisui_hai,
  po: m.yearly_taisui_po,
}

const ELEMENT_RELATION: Record<ElementRelation, (values: { a: string; b: string }) => string> = {
  same: m.yearly_elem_same,
  aGeneratesB: m.yearly_elem_aGeneratesB,
  bGeneratesA: m.yearly_elem_bGeneratesA,
  aOvercomesB: m.yearly_elem_aOvercomesB,
  bOvercomesA: m.yearly_elem_bOvercomesA,
}

/** 五行圆点的颜色（brand.css 的 --wx-*） */
export const ELEMENT_DOT: Record<Element, string> = {
  wood: 'bg-wx-wood',
  fire: 'bg-wx-fire',
  earth: 'bg-wx-earth',
  metal: 'bg-wx-metal',
  water: 'bg-wx-water',
}

const isKorean = (locale: string) => locale === 'ko'

/** 地支字形（速览大字与表格），各语言都用汉字 */
export const glyph = (branch: Branch) => BRANCH_HANZI[branch]
export const stemGlyph = (stem: Stem) => STEM_HANZI[stem]
/** 地支名：ko 写「오(午)」，其他语言写汉字 */
export const branchLabel = (locale: string, branch: Branch) =>
  isKorean(locale) ? `${BRANCH_HANGUL[branch]}(${BRANCH_HANZI[branch]})` : BRANCH_HANZI[branch]
export const stemLabel = (locale: string, stem: Stem) =>
  isKorean(locale) ? `${STEM_HANGUL[stem]}(${STEM_HANZI[stem]})` : STEM_HANZI[stem]
/** 干支：ko 写「정미(丁未)」，其他语言写「丁未」 */
export const ganzhiLabel = (locale: string, stem: Stem, branch: Branch) =>
  isKorean(locale)
    ? `${STEM_HANGUL[stem]}${BRANCH_HANGUL[branch]}(${STEM_HANZI[stem]}${BRANCH_HANZI[branch]})`
    : `${STEM_HANZI[stem]}${BRANCH_HANZI[branch]}`

export const animal = (branch: Branch) => ANIMAL[branch]()
export const zodiacName = (branch: Branch) => m.yearly_name({ animal: ANIMAL[branch]() })
export const nayinName = (index: number) => NAYIN[index]?.() ?? ''
export const elementName = (element: Element) => ELEMENT_LABEL[element]()

export const relationText = (relations: readonly YearlyRelation[]) =>
  relations.length === 0
    ? m.yearly_rel_none()
    : relations.map((relation) => RELATION_LABEL[relation]()).join(m.yearly_list_separator())

export const taiSuiText = (taiSui: readonly YearlyTaiSui[]) =>
  taiSui.length === 0
    ? m.yearly_taisui_none()
    : taiSui.map((item) => TAI_SUI_LABEL[item]()).join(m.yearly_list_separator())

export const elementRelationText = (relation: ElementRelation, a: Element, b: Element) =>
  ELEMENT_RELATION[relation]({ a: elementName(a), b: elementName(b) })

const pad = (value: number) => String(value).padStart(2, '0')
export const dateText = (date: DateParts) =>
  m.yearly_date({ year: date.year, month: pad(date.month), day: pad(date.day) })
export const timeText = (time: DateTimeParts) =>
  m.yearly_time({ hour: pad(time.hour), minute: pad(time.minute) })

/** 前一天（春节口径的结束日为下一年正月初一的前一天） */
export function dayBefore(date: DateParts): DateParts {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day - 1))
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() }
}
