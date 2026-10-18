import type { Branch, Element, LunarDate, Stem } from '@xuanxue/bazi'

/**
 * 干支字形与韩文读音（历法数据，不随语言翻译，因此不进 messages）。
 * 只引用引擎的类型，页面首屏不加载引擎代码。
 */
export const STEM_HANZI: Record<Stem, string> = {
  jia: '甲',
  yi: '乙',
  bing: '丙',
  ding: '丁',
  wu: '戊',
  ji: '己',
  geng: '庚',
  xin: '辛',
  ren: '壬',
  gui: '癸',
}

export const BRANCH_HANZI: Record<Branch, string> = {
  zi: '子',
  chou: '丑',
  yin: '寅',
  mao: '卯',
  chen: '辰',
  si: '巳',
  wu: '午',
  wei: '未',
  shen: '申',
  you: '酉',
  xu: '戌',
  hai: '亥',
}

export const STEM_HANGUL: Record<Stem, string> = {
  jia: '갑',
  yi: '을',
  bing: '병',
  ding: '정',
  wu: '무',
  ji: '기',
  geng: '경',
  xin: '신',
  ren: '임',
  gui: '계',
}

export const BRANCH_HANGUL: Record<Branch, string> = {
  zi: '자',
  chou: '축',
  yin: '인',
  mao: '묘',
  chen: '진',
  si: '사',
  wu: '오',
  wei: '미',
  shen: '신',
  you: '유',
  xu: '술',
  hai: '해',
}

export const STEM_ELEMENT: Record<Stem, Element> = {
  jia: 'wood',
  yi: 'wood',
  bing: 'fire',
  ding: 'fire',
  wu: 'earth',
  ji: 'earth',
  geng: 'metal',
  xin: 'metal',
  ren: 'water',
  gui: 'water',
}

/** 地支本气五行 */
export const BRANCH_ELEMENT: Record<Branch, Element> = {
  zi: 'water',
  chou: 'earth',
  yin: 'wood',
  mao: 'wood',
  chen: 'earth',
  si: 'fire',
  wu: 'fire',
  wei: 'earth',
  shen: 'metal',
  you: 'metal',
  xu: 'earth',
  hai: 'water',
}

/** 五行色（视觉规范，两站共用）：配合文字标签使用 */
export const ELEMENT_TEXT: Record<Element, string> = {
  wood: 'text-wx-wood',
  fire: 'text-wx-fire',
  earth: 'text-wx-earth',
  metal: 'text-wx-metal',
  water: 'text-wx-water',
}

export const ELEMENT_BG: Record<Element, string> = {
  wood: 'bg-wx-wood',
  fire: 'bg-wx-fire',
  earth: 'bg-wx-earth',
  metal: 'bg-wx-metal',
  water: 'bg-wx-water',
}

export function ganzhi(stem: Stem, branch: Branch): string {
  return `${STEM_HANZI[stem]}${BRANCH_HANZI[branch]}`
}

export function ganzhiHangul(stem: Stem, branch: Branch): string {
  return `${STEM_HANGUL[stem]}${BRANCH_HANGUL[branch]}`
}

const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘']
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/** 農曆日：初一…初十、十一…二十、廿一…廿九、三十 */
function lunarDayName(day: number): string {
  if (day <= 10) return `初${DIGITS[day]}`
  if (day < 20) return `十${DIGITS[day - 10]}`
  if (day === 20) return '二十'
  if (day < 30) return `廿${DIGITS[day - 20]}`
  return '三十'
}

/** 繁中农历日期，如「四月廿一」「閏六月初三」 */
export function lunarDateZh(date: LunarDate): string {
  return `${date.isLeapMonth ? '閏' : ''}${LUNAR_MONTHS[date.month - 1]}月${lunarDayName(date.day)}`
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDateTime(parts: {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
}): string {
  const date = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  return parts.hour === undefined ? date : `${date} ${pad(parts.hour)}:${pad(parts.minute ?? 0)}`
}
