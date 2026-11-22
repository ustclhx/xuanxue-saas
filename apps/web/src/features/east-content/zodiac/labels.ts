import type { Branch, BranchRelationType, Element, Stem } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import { BRANCH_HANGUL, BRANCH_HANZI, STEM_HANGUL, STEM_HANZI } from '../../tools/bazi/glyphs.ts'
import { ELEMENT_LABEL } from '../../tools/bazi/labels.ts'
import type { MonthDay, MonthDayTime, ZodiacAnnual } from './data.ts'

/**
 * 生肖页的文案映射（messages/<locale>/zodiac.json）：引擎只给稳定 key 与序号，这里换成当前语言的文字。
 * 显式列出每个文案函数，便于类型检查与按需打包。
 */
type Message = () => string

const ANIMAL: Record<Branch, Message> = {
  zi: m.zodiac_animal_zi,
  chou: m.zodiac_animal_chou,
  yin: m.zodiac_animal_yin,
  mao: m.zodiac_animal_mao,
  chen: m.zodiac_animal_chen,
  si: m.zodiac_animal_si,
  wu: m.zodiac_animal_wu,
  wei: m.zodiac_animal_wei,
  shen: m.zodiac_animal_shen,
  you: m.zodiac_animal_you,
  xu: m.zodiac_animal_xu,
  hai: m.zodiac_animal_hai,
}

const NAYIN: readonly Message[] = [
  m.zodiac_nayin_0,
  m.zodiac_nayin_1,
  m.zodiac_nayin_2,
  m.zodiac_nayin_3,
  m.zodiac_nayin_4,
  m.zodiac_nayin_5,
  m.zodiac_nayin_6,
  m.zodiac_nayin_7,
  m.zodiac_nayin_8,
  m.zodiac_nayin_9,
  m.zodiac_nayin_10,
  m.zodiac_nayin_11,
  m.zodiac_nayin_12,
  m.zodiac_nayin_13,
  m.zodiac_nayin_14,
  m.zodiac_nayin_15,
  m.zodiac_nayin_16,
  m.zodiac_nayin_17,
  m.zodiac_nayin_18,
  m.zodiac_nayin_19,
  m.zodiac_nayin_20,
  m.zodiac_nayin_21,
  m.zodiac_nayin_22,
  m.zodiac_nayin_23,
  m.zodiac_nayin_24,
  m.zodiac_nayin_25,
  m.zodiac_nayin_26,
  m.zodiac_nayin_27,
  m.zodiac_nayin_28,
  m.zodiac_nayin_29,
]

export const RELATION_LABEL: Record<BranchRelationType, Message> = {
  sixCombine: m.zodiac_rel_six,
  triad: m.zodiac_rel_triad,
  clash: m.zodiac_rel_clash,
  punish: m.zodiac_rel_punish,
  harm: m.zodiac_rel_harm,
}

/** 五行圆点的颜色（brand.css 的 --wx-*） */
export const ELEMENT_DOT: Record<Element, string> = {
  wood: 'bg-wx-wood',
  fire: 'bg-wx-fire',
  earth: 'bg-wx-earth',
  metal: 'bg-wx-metal',
  water: 'bg-wx-water',
}

const DIRECTION: Record<Branch, Message> = {
  zi: m.zodiac_dir_zi,
  chou: m.zodiac_dir_chou,
  yin: m.zodiac_dir_yin,
  mao: m.zodiac_dir_mao,
  chen: m.zodiac_dir_chen,
  si: m.zodiac_dir_si,
  wu: m.zodiac_dir_wu,
  wei: m.zodiac_dir_wei,
  shen: m.zodiac_dir_shen,
  you: m.zodiac_dir_you,
  xu: m.zodiac_dir_xu,
  hai: m.zodiac_dir_hai,
}

/** 地支方位（二十四山：子为 0°，每支 30°） */
export const direction = (branch: Branch) => DIRECTION[branch]()

export const glyph = (branch: Branch) => BRANCH_HANZI[branch]

/**
 * ko 页的干支写法（设计稿 ZodiacPageKoMobile）：韩文读音在前、汉字在括号里，如「자(子)」「경자(庚子)」；
 * 中文页仍只写汉字。
 */
const isKorean = (locale: string) => locale === 'ko'
export const branchName = (locale: string, branch: Branch) =>
  isKorean(locale) ? BRANCH_HANGUL[branch] : BRANCH_HANZI[branch]
export const branchLabel = (locale: string, branch: Branch) =>
  isKorean(locale) ? `${BRANCH_HANGUL[branch]}(${BRANCH_HANZI[branch]})` : BRANCH_HANZI[branch]
export const ganzhiHangul = (stem: Stem, branch: Branch) =>
  `${STEM_HANGUL[stem]}${BRANCH_HANGUL[branch]}`
export const ganzhiLabel = (locale: string, stem: Stem, branch: Branch) =>
  isKorean(locale) ? `${ganzhiHangul(stem, branch)}(${ganzhi(stem, branch)})` : ganzhi(stem, branch)

const ELEMENT_HANZI: Record<Element, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
}
/** 五行名：ko 写「수(水)」，中文写「水」 */
export const elementLabel = (locale: string, element: Element) =>
  isKorean(locale)
    ? `${ELEMENT_LABEL[element]()}(${ELEMENT_HANZI[element]})`
    : ELEMENT_LABEL[element]()
export const elementHanzi = (element: Element) => ELEMENT_HANZI[element]
export const ganzhi = (stem: Stem, branch: Branch) => `${STEM_HANZI[stem]}${BRANCH_HANZI[branch]}`
export const animal = (branch: Branch) => ANIMAL[branch]()
export const zodiacName = (branch: Branch) => m.zodiac_name({ animal: ANIMAL[branch]() })
export const nayinName = (index: number) => NAYIN[index]?.() ?? ''

const CHINESE_NUMERALS = [
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '十一',
  '十二',
]

const KOREAN_ORDINALS = [
  '첫째',
  '둘째',
  '셋째',
  '넷째',
  '다섯째',
  '여섯째',
  '일곱째',
  '여덟째',
  '아홉째',
  '열째',
  '열한째',
  '열두째',
]

/** 地支序位：中文写「第七位」，ko 写「자(子) · 첫째」，其他语言用阿拉伯数字 */
export function branchPosition(locale: string, index: number): string {
  const branch = BRANCH_ORDER[index] as Branch
  return m.zodiac_branch_position({
    glyph: branchLabel(locale, branch),
    position: locale.startsWith('zh')
      ? (CHINESE_NUMERALS[index] ?? '')
      : isKorean(locale)
        ? (KOREAN_ORDINALS[index] ?? '')
        : String(index + 1),
  })
}

const BRANCH_ORDER: readonly Branch[] = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
]

/** 时辰：子时 23:00–01:00，此后每支两小时 */
export function hourRange(index: number): string {
  const start = (index * 2 + 23) % 24
  const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`
  return `${pad(start)}–${pad((start + 2) % 24)}`
}

const hhmm = (time: MonthDayTime) =>
  `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
export const monthDay = (date: MonthDay) => m.zodiac_month_day({ month: date.month, day: date.day })
export const monthDayTime = (date: MonthDayTime) =>
  m.zodiac_month_day_time({ month: date.month, day: date.day, time: hhmm(date) })

/** 流年卡片中的关系名（本支在前，如「午未六合」） */
export function annualChips(annual: ZodiacAnnual, natal: Branch): string[] {
  const natalGlyph = BRANCH_HANZI[natal]
  const yearGlyph = BRANCH_HANZI[annual.branch]
  // ko 文案另用韩文读音（「자오충(子午沖)」）
  const values = {
    natal: natalGlyph,
    year: yearGlyph,
    natalK: BRANCH_HANGUL[natal],
    yearK: BRANCH_HANGUL[annual.branch],
  }
  const chips: string[] = []
  if (annual.taiSui === 'zhi') chips.push(m.zodiac_taisui_zhi())
  if (annual.taiSui === 'chong') chips.push(m.zodiac_taisui_chong(values))
  for (const relation of annual.relations) {
    if (relation === 'sixCombine') chips.push(m.zodiac_chip_six(values))
    if (relation === 'triad') chips.push(m.zodiac_chip_triad(values))
    // 冲太岁已在上面标出，不再重复「相冲」
    if (relation === 'clash' && annual.taiSui !== 'chong') chips.push(m.zodiac_chip_clash(values))
    if (relation === 'punish')
      chips.push(
        natal === annual.branch ? m.zodiac_chip_punish_self(values) : m.zodiac_chip_punish(values),
      )
    if (relation === 'harm') chips.push(m.zodiac_chip_harm(values))
  }
  if (chips.length === 0) chips.push(m.zodiac_chip_none(values))
  return chips
}
