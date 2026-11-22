import type { Branch, Stem } from '@xuanxue/bazi'
import type { ZodiacBoundaryTuple } from './data.ts'

/**
 * 枢纽页「属相查询」（design 决策 3、4）：只用随页面下发的立春与春节边界表，在浏览器里比较日期，
 * 不加载 tyme4ts、不上传生日。只引用引擎的类型。
 */
const STEM_KEYS: readonly Stem[] = [
  'jia',
  'yi',
  'bing',
  'ding',
  'wu',
  'ji',
  'geng',
  'xin',
  'ren',
  'gui',
]
const BRANCH_KEYS: readonly Branch[] = [
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

export const FIRST_YEAR = 1924
export const LAST_YEAR = 2043

const CHINA_OFFSET_MINUTES = 480

export interface LookupYear {
  readonly year: number
  readonly stem: Stem
  readonly branch: Branch
}

export type LookupResult =
  | { readonly kind: 'required' | 'invalid' | 'range' }
  | {
      readonly kind: 'ok'
      readonly year: number
      /** 按立春：same 为立春当天，after / before 为出生时刻在立春之后 / 之前的两种结果 */
      readonly lichun: {
        readonly state: 'after' | 'before' | 'same'
        readonly month: number
        readonly day: number
        readonly time: string
        readonly after: LookupYear
        readonly before: LookupYear
      }
      readonly newYear: {
        readonly state: 'after' | 'before'
        readonly month: number
        readonly day: number
        readonly result: LookupYear
      }
    }

export const lookupYear = (year: number): LookupYear => ({
  year,
  stem: STEM_KEYS[(((year - FIRST_YEAR) % 10) + 10) % 10] as Stem,
  branch: BRANCH_KEYS[(((year - FIRST_YEAR) % 12) + 12) % 12] as Branch,
})

const order = (month: number, day: number) => month * 100 + day

/** `YYYY-MM-DD`（DateField 的提交值）→ 两种口径的生肖 */
export function lookupZodiac(
  value: string,
  boundaries: readonly ZodiacBoundaryTuple[],
  /** 立春时刻按此偏移换算成当地日期（zh-hans 北京时间，ko 韩国标准时） */
  offsetMinutes = CHINA_OFFSET_MINUTES,
): LookupResult {
  const text = value.trim()
  if (!text) return { kind: 'required' }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return { kind: 'invalid' }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return { kind: 'invalid' }
  const boundary = boundaries.find(([entry]) => entry === year)
  if (!boundary) return { kind: 'range' }
  const [, lichunEpochMs, newYearMonth, newYearDay] = boundary
  const lichun = new Date(lichunEpochMs + offsetMinutes * 60_000)
  const lichunMonth = lichun.getUTCMonth() + 1
  const lichunDay = lichun.getUTCDate()
  const birth = order(month, day)
  const spring = order(lichunMonth, lichunDay)
  const lichunState = birth > spring ? 'after' : birth < spring ? 'before' : 'same'
  const newYearState = birth >= order(newYearMonth, newYearDay) ? 'after' : 'before'
  // 表首年（1924）立春或春节之前的日期属于 1923 年，不在年份表范围内
  if (year === FIRST_YEAR && (lichunState !== 'after' || newYearState === 'before'))
    return { kind: 'range' }
  const time = `${String(lichun.getUTCHours()).padStart(2, '0')}:${String(lichun.getUTCMinutes()).padStart(2, '0')}`
  return {
    kind: 'ok',
    year,
    lichun: {
      state: lichunState,
      month: lichunMonth,
      day: lichunDay,
      time,
      after: lookupYear(year),
      before: lookupYear(year - 1),
    },
    newYear: {
      state: newYearState,
      month: newYearMonth,
      day: newYearDay,
      result: lookupYear(newYearState === 'after' ? year : year - 1),
    },
  }
}
