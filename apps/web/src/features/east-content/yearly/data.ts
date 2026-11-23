import { BRANCHES, type Branch, ELEMENTS, type Element, STEMS, type Stem } from '@xuanxue/bazi'
import {
  lunarNewYearAt,
  nayinTable,
  zodiacBoundaries,
  zodiacPairFacts,
  zodiacYearFacts,
  zodiacYears,
} from '@xuanxue/bazi/almanac'
import type { YearlyKey, YearlyLocale } from './paths.ts'

/**
 * 年度生肖页的引擎事实（design 决策 4、6）：只在服务端与构建期计算，随 loader 下发，客户端不加载 tyme4ts。
 * 关系表来自 `zodiacYearFacts`，出生年份与纳音来自 `zodiacYears`，立春与春节来自 `zodiacBoundaries`。
 * 输出只含稳定 key 与数值，文字由页面按语言渲染（messages/<locale>/yearly.json）。
 */

export type YearlyRelation = ReturnType<typeof zodiacYearFacts>['rows'][number]['relations'][number]
export type YearlyTaiSui = ReturnType<typeof zodiacYearFacts>['rows'][number]['taiSui'][number]
export type ElementRelation = ReturnType<typeof zodiacPairFacts>['elementRelation']

/**
 * 各语言页显示立春时刻与春节日期所用的固定 UTC 偏移（分钟）：中文与东方英文按北京时间；
 * ko 按韩国标准时，설날按 UTC+9 的合朔日（2027 年为 2 月 7 日，中国春节为 2 月 6 日）。
 */
export const YEARLY_UTC_OFFSET: Readonly<Record<YearlyLocale, number>> = {
  'zh-Hans': 480,
  'zh-Hant': 480,
  ko: 540,
  en: 480,
}
const CHINA_OFFSET = 480

/** 出生年份表的跨度：目标年前 79 年至前 1 年（2027 年为 1948–2026） */
const BIRTH_SPAN = 79

export interface DateTimeParts {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
}
export interface DateParts {
  readonly year: number
  readonly month: number
  readonly day: number
}

export interface YearlyYearFacts {
  readonly year: number
  readonly stem: Stem
  readonly branch: Branch
  readonly nayinIndex: number
  readonly stemElement: Element
  readonly branchElement: Element
  /** 本年与次年的立春（显示偏移下） */
  readonly lichun: DateTimeParts
  readonly nextLichun: DateTimeParts
  /** 本年与次年的正月初一（显示偏移下） */
  readonly newYear: DateParts
  readonly nextNewYear: DateParts
  /** 次年立春的绝对时刻：此后页面显示过季提示 */
  readonly endsAt: number
}

export interface YearlyRow {
  readonly branch: Branch
  readonly relations: readonly YearlyRelation[]
  readonly taiSui: readonly YearlyTaiSui[]
}

export interface YearlyBirthRow {
  readonly year: number
  readonly stem: Stem
  readonly branch: Branch
  readonly nayinIndex: number
  /** 目标年的虚岁 */
  readonly age: number
}

export interface YearlyChildFacts {
  readonly year: YearlyYearFacts
  readonly branch: Branch
  readonly element: Element
  readonly row: YearlyRow
  /** 本支与流年地支的五行生克（本支在前） */
  readonly branchElementRelation: ElementRelation
  /** 本支与流年天干的五行生克（本支在前） */
  readonly stemElementRelation: ElementRelation
  /** 本支所在三合局的三支，及流年地支是否在局内 */
  readonly triad: readonly Branch[]
  readonly triadElement: Element
  readonly triadHasYear: boolean
  readonly births: readonly YearlyBirthRow[]
}

export interface YearlyHubFacts {
  readonly year: YearlyYearFacts
  readonly rows: readonly YearlyRow[]
}

const ELEMENT_RELATIONS: readonly ElementRelation[] = [
  'same',
  'aGeneratesB',
  'aOvercomesB',
  'bOvercomesA',
  'bGeneratesA',
]
/** 五行按木火土金水排列：下一位为所生，隔一位为所克（与 zodiacPairFacts 同一规则） */
const elementRelation = (a: Element, b: Element): ElementRelation =>
  ELEMENT_RELATIONS[
    (((ELEMENTS.indexOf(b) - ELEMENTS.indexOf(a)) % ELEMENTS.length) + ELEMENTS.length) %
      ELEMENTS.length
  ] as ElementRelation
/** 十干五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水 */
const stemElementOf = (stem: Stem): Element =>
  ELEMENTS[Math.floor(STEMS.indexOf(stem) / 2)] as Element

/** 三合局：申子辰水、巳酉丑金、寅午戌火、亥卯未木（地支序号除以 4 的余数相同），按余数取局的五行 */
const TRIAD_ELEMENTS: readonly Element[] = ['water', 'metal', 'fire', 'wood']
const triadOf = (branch: Branch): Branch[] => {
  const index = BRANCHES.indexOf(branch)
  return [0, 4, 8]
    .map((step) => BRANCHES[(index + step) % 12] as Branch)
    .sort((a, b) => BRANCHES.indexOf(a) - BRANCHES.indexOf(b))
}

function toParts(epochMs: number, offsetMinutes: number): DateTimeParts {
  const local = new Date(epochMs + offsetMinutes * 60_000)
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  }
}

function newYearOf(year: number, fallback: DateParts, offsetMinutes: number): DateParts {
  if (offsetMinutes === CHINA_OFFSET) return fallback
  const date = lunarNewYearAt(year, { utcOffsetMinutes: offsetMinutes })
  return { year: date.year, month: date.month, day: date.day }
}

export function yearFacts(year: number, offsetMinutes = CHINA_OFFSET): YearlyYearFacts {
  const facts = zodiacYearFacts(year)
  const boundaries = zodiacBoundaries()
  const current = boundaries.find((entry) => entry.year === year)
  const next = boundaries.find((entry) => entry.year === year + 1)
  if (!current || !next) throw new RangeError(`Year out of range: ${year}`)
  const nayin = nayinTable()[facts.cycleIndex]
  return {
    year,
    stem: facts.stem,
    branch: facts.branch,
    nayinIndex: nayin?.nayinIndex ?? 0,
    stemElement: stemElementOf(facts.stem),
    branchElement: zodiacPairFacts(facts.branch, facts.branch).elements[0],
    lichun: toParts(current.lichunEpochMs, offsetMinutes),
    nextLichun: toParts(next.lichunEpochMs, offsetMinutes),
    newYear: newYearOf(year, current.lunarNewYear, offsetMinutes),
    nextNewYear: newYearOf(year + 1, next.lunarNewYear, offsetMinutes),
    endsAt: next.lichunEpochMs,
  }
}

export function yearRows(year: number): YearlyRow[] {
  return zodiacYearFacts(year).rows.map((row) => ({
    branch: row.branch,
    relations: row.relations,
    taiSui: row.taiSui,
  }))
}

export function childFacts(
  year: number,
  key: YearlyKey,
  offsetMinutes = CHINA_OFFSET,
): YearlyChildFacts {
  const branch = key as Branch
  const yearInfo = yearFacts(year, offsetMinutes)
  const row = yearRows(year).find((entry) => entry.branch === branch)
  if (!row) throw new RangeError(`Unknown branch: ${branch}`)
  const pair = zodiacPairFacts(branch, yearInfo.branch)
  const triad = triadOf(branch)
  return {
    year: yearInfo,
    branch,
    element: pair.elements[0],
    row,
    branchElementRelation: pair.elementRelation,
    stemElementRelation: elementRelation(pair.elements[0], yearInfo.stemElement),
    triad,
    triadElement: TRIAD_ELEMENTS[BRANCHES.indexOf(branch) % 4] as Element,
    triadHasYear: triad.includes(yearInfo.branch),
    births: zodiacYears(branch, { utcOffsetMinutes: offsetMinutes })
      .filter((entry) => entry.year >= year - BIRTH_SPAN && entry.year < year)
      .map((entry) => ({
        year: entry.year,
        stem: entry.stem,
        branch: entry.branch,
        nayinIndex: entry.nayinIndex,
        age: year - entry.year + 1,
      })),
  }
}

export function hubFacts(year: number, offsetMinutes = CHINA_OFFSET): YearlyHubFacts {
  return { year: yearFacts(year, offsetMinutes), rows: yearRows(year) }
}
