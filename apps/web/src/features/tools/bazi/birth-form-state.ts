import type { BirthInput, CityId, InputField, InputIssue } from '@xuanxue/bazi'
import type { ShareInput, ShareValue } from '../share.ts'

/**
 * 出生信息表单的状态（openspec add-bazi-saju-chart tasks.md 2.1）：表单值、换算为引擎输入、
 * 跨页保留（sessionStorage）与分享片段。只引用引擎的类型，页面首屏不加载引擎代码。
 */
export interface BirthFormValues {
  readonly calendar: 'solar' | 'lunar'
  readonly leap: boolean
  readonly gender: 'male' | 'female'
  readonly year: string
  readonly month: string
  readonly day: string
  /** `HH:MM` */
  readonly time: string
  readonly unknownTime: boolean
  /** 内置城市 id，或 `other`（手选 UTC 偏移） */
  readonly place: string
  /** 分钟，place 为 other 时使用 */
  readonly utcOffset: string
  readonly longitude: string
  readonly trueSolar: boolean
}

export const OTHER_PLACE = 'other'

/**
 * 韩语页진태양시（真太阳时）修正的默认值。韩国常见만세력默认开启（首尔约 −32 分钟），
 * 本站按 spec 默认关闭并醒目提示；用户决策 D5（docs/v1-decisions.md）定案后只需改这一处。
 */
export const KO_TRUE_SOLAR_DEFAULT = false

/** 出生地下拉的内置城市（与引擎 CITIES 同 id）；按语言把常用城市放在前面 */
export const PLACE_IDS: Record<'zh-Hant' | 'ko', readonly CityId[]> = {
  'zh-Hant': [
    'taipei',
    'taichung',
    'kaohsiung',
    'hongKong',
    'macau',
    'beijing',
    'shanghai',
    'guangzhou',
    'seoul',
    'busan',
    'daegu',
    'tokyo',
    'singapore',
    'kualaLumpur',
    'losAngeles',
    'vancouver',
    'newYork',
    'toronto',
    'london',
    'sydney',
  ],
  ko: [
    'seoul',
    'busan',
    'daegu',
    'taipei',
    'taichung',
    'kaohsiung',
    'hongKong',
    'macau',
    'beijing',
    'shanghai',
    'guangzhou',
    'tokyo',
    'singapore',
    'kualaLumpur',
    'losAngeles',
    'vancouver',
    'newYork',
    'toronto',
    'london',
    'sydney',
  ],
}

/** UTC 偏移选项（分钟）：−12:00 至 +14:00，每 30 分钟一档，另含 +5:45、+8:45、+12:45 */
export const UTC_OFFSETS: readonly number[] = [
  ...Array.from({ length: 53 }, (_, i) => -720 + i * 30),
  345,
  525,
  765,
].sort((a, b) => a - b)

export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+'
  const abs = Math.abs(minutes)
  return `UTC${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

export function defaultBirthValues(locale: string): BirthFormValues {
  return {
    calendar: 'solar',
    leap: false,
    gender: 'male',
    year: '',
    month: '',
    day: '',
    time: '',
    unknownTime: false,
    place: locale === 'ko' ? 'seoul' : 'taipei',
    utcOffset: locale === 'ko' ? '540' : '480',
    longitude: '',
    trueSolar: false,
  }
}

/** 从 FormData 读取一个人的表单值；双人表单用 prefix 区分（`a_`、`b_`） */
export function readBirthForm(data: FormData, prefix = ''): BirthFormValues {
  const text = (key: string) => {
    const value = data.get(`${prefix}${key}`)
    return typeof value === 'string' ? value.trim() : ''
  }
  return {
    calendar: text('calendar') === 'lunar' ? 'lunar' : 'solar',
    leap: data.has(`${prefix}leap`),
    gender: text('gender') === 'female' ? 'female' : 'male',
    year: text('year'),
    month: text('month'),
    day: text('day'),
    time: text('time'),
    unknownTime: data.has(`${prefix}unknownTime`),
    place: text('place'),
    utcOffset: text('utcOffset'),
    longitude: text('longitude'),
    trueSolar: data.has(`${prefix}trueSolar`),
  }
}

const INTEGER = /^\d{1,4}$/
const TIME = /^(\d{1,2}):(\d{2})$/

/**
 * 表单值换算为引擎输入。这里只检查「必填」与数字格式；日期是否存在、范围与闰月由引擎的
 * validateInput 判断（同一套规则用于浏览器与服务端）。
 */
export function toBirthInput(
  values: BirthFormValues,
): { ok: true; input: BirthInput } | { ok: false; issues: InputIssue[] } {
  const issues: InputIssue[] = []
  const integer = (value: string, field: InputField) => {
    if (value === '') issues.push({ field, code: 'required' })
    else if (!INTEGER.test(value)) issues.push({ field, code: 'out_of_range' })
    return Number(value)
  }
  const year = integer(values.year, 'year')
  const month = integer(values.month, 'month')
  const day = integer(values.day, 'day')
  let time: BirthInput['time'] = null
  if (!values.unknownTime) {
    const match = TIME.exec(values.time)
    if (values.time === '') issues.push({ field: 'time', code: 'required' })
    else if (!match) issues.push({ field: 'time', code: 'out_of_range' })
    else time = { hour: Number(match[1]), minute: Number(match[2]) }
  }
  let location: BirthInput['location']
  if (values.place === OTHER_PLACE) {
    const offset = Number(values.utcOffset)
    const longitude = values.longitude === '' ? undefined : Number(values.longitude)
    if (values.utcOffset === '' || !Number.isInteger(offset))
      issues.push({ field: 'location', code: 'required' })
    if (longitude !== undefined && Number.isNaN(longitude))
      issues.push({ field: 'location', code: 'out_of_range' })
    location =
      longitude === undefined
        ? { utcOffsetMinutes: offset }
        : { utcOffsetMinutes: offset, longitude }
  } else if (values.place === '') {
    issues.push({ field: 'location', code: 'required' })
    location = { city: 'taipei' }
  } else {
    location = { city: values.place as CityId }
  }
  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    input: {
      calendar: values.calendar,
      year,
      month,
      day,
      ...(values.calendar === 'lunar' ? { isLeapMonth: values.leap } : {}),
      time,
      gender: values.gender,
      location,
      trueSolarTime: values.trueSolar,
    },
  }
}

/** 字段级错误：同一字段只显示第一条 */
export function issuesByField(
  issues: readonly InputIssue[],
): Partial<Record<InputField, InputIssue>> {
  const result: Partial<Record<InputField, InputIssue>> = {}
  for (const issue of issues) result[issue.field] ??= issue
  return result
}

/** 八字、紫微、命盘查询与韩语만세력 / 궁합（本人）共用一份输入，切页时带入 */
export const BIRTH_STORAGE_KEY = 'xuanxue.bazi.birth'
/** 궁합的对方 */
export const PARTNER_STORAGE_KEY = 'xuanxue.bazi.partner'

const KEYS = Object.keys(defaultBirthValues('zh-Hant')) as (keyof BirthFormValues)[]

/** 校验并补全外部来源（存储、分享链接）的值；形状不对时返回 null */
export function normalizeBirthValues(
  raw: unknown,
  fallback: BirthFormValues,
): BirthFormValues | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  const result: Record<string, string | boolean> = { ...fallback }
  for (const key of KEYS) {
    const value = source[key]
    if (value === undefined) continue
    if (typeof value !== typeof fallback[key]) return null
    result[key] = typeof value === 'string' ? value.slice(0, 16) : (value as boolean)
  }
  if (result.calendar !== 'solar' && result.calendar !== 'lunar') return null
  if (result.gender !== 'male' && result.gender !== 'female') return null
  return result as unknown as BirthFormValues
}

/** 存储不可用（隐私模式、禁用站点数据）时静默失败，不影响排盘 */
export function loadBirthValues(
  storage: Pick<Storage, 'getItem'> | undefined,
  key: string,
  fallback: BirthFormValues,
): BirthFormValues | null {
  try {
    const text = storage?.getItem(key)
    return text ? normalizeBirthValues(JSON.parse(text), fallback) : null
  } catch {
    return null
  }
}

export function saveBirthValues(
  storage: Pick<Storage, 'setItem'> | undefined,
  key: string,
  values: BirthFormValues,
): void {
  try {
    storage?.setItem(key, JSON.stringify(values))
  } catch {
    // 配额已满或被禁用：跨页保留失效，排盘照常
  }
}

/** 浏览器的 sessionStorage；访问本身也可能抛错（禁用站点数据时） */
export function sessionStore(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage
  } catch {
    return undefined
  }
}

/** 分享片段：每个人的字段加前缀（单人为空前缀） */
export function toShareInput(values: BirthFormValues, prefix = ''): Record<string, ShareValue> {
  return Object.fromEntries(KEYS.map((key) => [`${prefix}${key}`, values[key]]))
}

export function fromShareInput(
  shared: ShareInput,
  fallback: BirthFormValues,
  prefix = '',
): BirthFormValues | null {
  const raw: Record<string, ShareValue> = {}
  for (const key of KEYS) {
    const value = shared[`${prefix}${key}`]
    if (value !== undefined) raw[key] = value
  }
  return Object.keys(raw).length > 0 ? normalizeBirthValues(raw, fallback) : null
}
