import {
  BRANCHES,
  type Branch,
  type BranchRelationType,
  branchRelations,
  type Element,
  STEMS,
  type Stem,
  taiSuiOf,
  triadOf,
} from '@xuanxue/bazi'
import { lunarNewYearAt, zodiacBoundaries, zodiacYears } from '@xuanxue/bazi/almanac'
import { PUNISH_GROUPS, TRIADS } from './constants.ts'
import type { ZodiacKey, ZodiacLocale } from './paths.ts'

/**
 * 生肖页的引擎事实（design 决策 3、4）：只在服务端与构建期计算，结果随 loader 下发，客户端不加载 tyme4ts。
 * 输出只含稳定 key 与序号，文字由页面按语言渲染（messages/<locale>/zodiac.json）。
 */

/** 地支五行：子亥水、寅卯木、巳午火、申酉金、辰戌丑未土 */
const BRANCH_ELEMENT: readonly Element[] = [
  'water',
  'earth',
  'wood',
  'wood',
  'earth',
  'fire',
  'fire',
  'earth',
  'metal',
  'metal',
  'earth',
  'water',
]

export const branchIndexOf = (branch: Branch) => BRANCHES.indexOf(branch)
export const branchElementOf = (branch: Branch): Element =>
  BRANCH_ELEMENT[branchIndexOf(branch)] as Element
export const triadIndexOf = (branch: Branch) => triadOf(branchIndexOf(branch))

/**
 * 各语言页显示立春时刻与春节日期所用的固定 UTC 偏移（分钟）：zh-hans 为北京时间；ko 为韩国标准时，
 * 설날也按 UTC+9 的合朔日（与中国春节偶有一天之差，如 1997、2027 年）。1954–1961 年等历史标准时差异不计（design Risks）。
 */
export const ZODIAC_UTC_OFFSET: Readonly<Record<ZodiacLocale, number>> = {
  'zh-Hans': 480,
  ko: 540,
}
const CHINA_OFFSET = 480

/** 该偏移下的正月初一：北京时间直接取引擎的春节日期 */
function newYearAt(year: number, fallback: MonthDay, offsetMinutes: number): MonthDay {
  if (offsetMinutes === CHINA_OFFSET) return fallback
  const date = lunarNewYearAt(year, { utcOffsetMinutes: offsetMinutes })
  return { month: date.month, day: date.day }
}

const stemOfYear = (year: number) => STEMS[(((year - 1924) % 10) + 10) % 10] as Stem
const branchOfYear = (year: number) => BRANCHES[(((year - 1924) % 12) + 12) % 12] as Branch

export interface MonthDay {
  readonly month: number
  readonly day: number
}
export interface MonthDayTime extends MonthDay {
  readonly hour: number
  readonly minute: number
}

export interface ZodiacYearRow {
  readonly year: number
  readonly stem: Stem
  readonly branch: Branch
  readonly nayinIndex: number
  readonly lichun: MonthDayTime
  readonly newYear: MonthDay
}

export interface ZodiacRelation {
  readonly type: BranchRelationType
  /** 与本支构成该关系的地支（自刑时为本支），按传统顺序 */
  readonly branches: readonly Branch[]
}

export interface ZodiacAnnual {
  readonly year: number
  readonly stem: Stem
  readonly branch: Branch
  readonly lichun: MonthDay
  readonly taiSui: 'zhi' | 'chong' | null
  readonly relations: readonly BranchRelationType[]
}

/** 立春分界的干支年：某一时刻所在的年份（1924–2043 之外返回 undefined） */
export function zodiacYearAt(epochMs: number): number | undefined {
  let year: number | undefined
  for (const boundary of zodiacBoundaries())
    if (boundary.lichunEpochMs <= epochMs) year = boundary.year
  return year
}

export function yearRows(branch: Branch, offsetMinutes = CHINA_OFFSET): ZodiacYearRow[] {
  return zodiacYears(branch, { utcOffsetMinutes: offsetMinutes }).map((row) => ({
    year: row.year,
    stem: row.stem,
    branch: row.branch,
    nayinIndex: row.nayinIndex,
    lichun: {
      month: row.lichun.month,
      day: row.lichun.day,
      hour: row.lichun.hour,
      minute: row.lichun.minute,
    },
    newYear: newYearAt(
      row.year,
      { month: row.lunarNewYear.month, day: row.lunarNewYear.day },
      offsetMinutes,
    ),
  }))
}

/** 本支的六合、三合、冲、刑、害，顺序固定 */
export function relationsOf(branch: Branch): ZodiacRelation[] {
  const triad = TRIADS[triadIndexOf(branch)]
  const punishGroup = PUNISH_GROUPS.find((group) => group.includes(branch))
  const partner = (type: BranchRelationType) =>
    BRANCHES.filter((other) => other !== branch && branchRelations(branch, other).includes(type))
  return [
    { type: 'sixCombine', branches: partner('sixCombine') },
    { type: 'triad', branches: triad?.branches ?? [] },
    { type: 'clash', branches: partner('clash') },
    {
      type: 'punish',
      branches: punishGroup ? punishGroup.filter((other) => other !== branch) : [branch],
    },
    { type: 'harm', branches: partner('harm') },
  ]
}

/** 某干支年与本支的太岁关系与地支关系 */
export function annualOf(
  year: number,
  natal: Branch,
  offsetMinutes = CHINA_OFFSET,
): ZodiacAnnual | null {
  const boundary = zodiacBoundaries().find((entry) => entry.year === year)
  if (!boundary) return null
  const branch = branchOfYear(year)
  const lichun = new Date(boundary.lichunEpochMs + offsetMinutes * 60_000)
  return {
    year,
    stem: stemOfYear(year),
    branch,
    lichun: { month: lichun.getUTCMonth() + 1, day: lichun.getUTCDate() },
    taiSui: taiSuiOf(branch, natal),
    relations: branchRelations(natal, branch),
  }
}

export interface ZodiacExample {
  readonly year: number
  /**
   * after：立春在春节之前（交节后、初一前出生两种口径不同）；before：春节在立春之前；
   * same：同一天（初一零时起算，年柱在交节时更替）
   */
  readonly order: 'after' | 'before' | 'same'
  readonly lichun: MonthDayTime
  readonly newYear: MonthDay
  readonly previous: Branch
}

/** 年份表下的核对示例：取本支不晚于本年的最近一年 */
export function exampleOf(
  rows: readonly ZodiacYearRow[],
  currentYear: number,
): ZodiacExample | null {
  const row = [...rows].reverse().find((entry) => entry.year <= currentYear) ?? rows[0]
  if (!row) return null
  const lichun = row.lichun.month * 100 + row.lichun.day
  const newYear = row.newYear.month * 100 + row.newYear.day
  return {
    year: row.year,
    order: lichun < newYear ? 'after' : lichun > newYear ? 'before' : 'same',
    lichun: row.lichun,
    newYear: row.newYear,
    previous: BRANCHES[(branchIndexOf(row.branch) + 11) % 12] as Branch,
  }
}

export interface ZodiacChildFacts {
  readonly branch: Branch
  readonly element: Element
  readonly polarity: 'yang' | 'yin'
  readonly currentYear: number
  /** 만 나이等按公历计的「今年」（显示偏移下的日期） */
  readonly calendarYear: number
  readonly years: readonly ZodiacYearRow[]
  readonly example: ZodiacExample | null
  readonly relations: readonly ZodiacRelation[]
  readonly annual: readonly ZodiacAnnual[]
}

export function childFacts(
  key: ZodiacKey,
  now: number,
  offsetMinutes = CHINA_OFFSET,
): ZodiacChildFacts {
  const branch = key as Branch
  const currentYear = zodiacYearAt(now) ?? 2043
  const years = yearRows(branch, offsetMinutes)
  return {
    branch,
    element: branchElementOf(branch),
    polarity: branchIndexOf(branch) % 2 === 0 ? 'yang' : 'yin',
    currentYear,
    calendarYear: new Date(now + offsetMinutes * 60_000).getUTCFullYear(),
    years,
    example: exampleOf(years, currentYear),
    relations: relationsOf(branch),
    annual: [currentYear, currentYear + 1]
      .map((year) => annualOf(year, branch, offsetMinutes))
      .filter((entry): entry is ZodiacAnnual => entry !== null),
  }
}

export interface ZodiacHubRow {
  readonly key: ZodiacKey
  readonly branch: Branch
  readonly element: Element
  readonly triad: number
  /** 不晚于本年的最近一年与其后一轮 */
  readonly recent: readonly number[]
}

/** 属相查询的边界表：[立春年份, 立春时刻（UTC 毫秒）, 春节月, 春节日] */
export type ZodiacBoundaryTuple = readonly [number, number, number, number]

export interface ZodiacHubFacts {
  readonly currentYear: number
  readonly currentBranch: Branch
  readonly rows: readonly ZodiacHubRow[]
  readonly boundaries: readonly ZodiacBoundaryTuple[]
  /** 查询结果显示立春时刻所用的偏移（分钟） */
  readonly offsetMinutes: number
}

export function hubFacts(now: number, offsetMinutes = CHINA_OFFSET): ZodiacHubFacts {
  const currentYear = zodiacYearAt(now) ?? 2043
  const rows = BRANCHES.map((branch, index): ZodiacHubRow => {
    // 1924 甲子起，本支第一个年份为 1924 + index
    const last = currentYear - ((((currentYear - 1924 - index) % 12) + 12) % 12)
    return {
      key: branch as ZodiacKey,
      branch,
      element: branchElementOf(branch),
      triad: triadOf(index),
      recent: [last, last + 12],
    }
  })
  return {
    currentYear,
    currentBranch: branchOfYear(currentYear),
    rows,
    boundaries: zodiacBoundaries().map((entry): ZodiacBoundaryTuple => {
      const newYear = newYearAt(entry.year, entry.lunarNewYear, offsetMinutes)
      return [entry.year, entry.lichunEpochMs, newYear.month, newYear.day]
    }),
    offsetMinutes,
  }
}
