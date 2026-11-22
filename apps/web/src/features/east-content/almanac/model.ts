import type { AlmanacDay, AlmanacMonth } from '@xuanxue/bazi/almanac'
import { lunarText } from '../../daily/copy.ts'
import { type CivilDate, dateKey, parseDateKey } from '../../daily/date.ts'
import { ZH_HANS_ALMANAC } from '../../daily/rules/almanac.zh-Hans.ts'
import { HIDDEN_TABOOS } from '../../daily/rules/types.ts'
import { ZH_HANS_RULES } from '../../daily/rules/zh-Hans.ts'

/**
 * 黄历的「引擎序号 → 页面文字」（openspec content-growth-phase2 第 6 组）。在服务端执行，
 * 页面组件只拿到解析好的文字，不加载引擎与规则表。宜忌按引擎顺序列出，只去掉 HIDDEN_TABOOS
 * （医疗、法律与吉凶断语类），嫁娶等词条与其他词条同等对待，不重排、不突出（使用者 2026-11-22 裁定）。
 */

export interface AlmanacEngine {
  readonly almanacDay: (date: CivilDate) => AlmanacDay
  readonly almanacMonth: (year: number, month: number) => AlmanacMonth
}

/** 引擎支持的公历年份范围（packages/bazi MIN_YEAR / MAX_YEAR） */
export const ALMANAC_YEAR_RANGE = [1900, 2100] as const

const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const WEEKDAYS = '日一二三四五六'
const BRANCH_KEYS = [
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
] as const
/** 三合局：日支所在的局与煞方（申子辰煞南、寅午戌煞北、亥卯未煞西、巳酉丑煞东） */
const TRIADS = ['申子辰水局', '巳酉丑金局', '寅午戌火局', '亥卯未木局'] as const

const glossary = ZH_HANS_ALMANAC
const pad = (value: number) => String(value).padStart(2, '0')

export const cycleText = (index: number) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`
const branchHanzi = (key: string) => BRANCHES[BRANCH_KEYS.indexOf(key as 'zi')] ?? ''

function weekdayOf(date: CivilDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
}

export interface AlmanacDayView {
  /** `YYYY-MM-DD` */
  readonly date: string
  readonly month: number
  readonly day: number
  /** 「周日」 */
  readonly weekday: string
  /** 「星期日」 */
  readonly weekdayLong: string
  readonly lunar: string
  readonly pillars: { readonly year: string; readonly month: string; readonly day: string }
  readonly recommends: readonly string[]
  readonly avoids: readonly string[]
  readonly duty: { readonly name: string; readonly gloss: string }
  readonly star: {
    readonly name: string
    readonly gloss: string
    readonly ecliptic: string
    readonly yellow: boolean
  }
  /** 所冲生肖与地支、煞方，以及冲煞的推算说明 */
  readonly clash: {
    readonly zodiac: string
    readonly branch: string
    readonly sha: string
    readonly gloss: string
  }
  readonly term: { readonly name: string; readonly beginsToday: boolean }
  /** 当天的节日与节令起始（三伏、数九、入梅、出梅），按引擎顺序 */
  readonly marks: readonly string[]
}

/** 宜忌名称：按引擎顺序，只去掉不展示的词条 */
function tabooList(indices: readonly number[]): string[] {
  return indices
    .filter((index) => !HIDDEN_TABOOS.has(index) && ZH_HANS_RULES.taboo[index] !== undefined)
    .map((index) => ZH_HANS_RULES.taboo[index] as string)
}

function marksOf(day: AlmanacDay): string[] {
  const marks = day.festivals.map((festival) =>
    festival.calendar === 'solar'
      ? glossary.solarFestival[festival.index]
      : glossary.lunarFestival[festival.index],
  )
  if (day.dogDays?.dayIndex === 0) marks.push(glossary.dogDay[day.dogDays.phaseIndex])
  if (day.nineDays?.dayIndex === 0) marks.push(glossary.nineDay[day.nineDays.phaseIndex])
  if (day.plumRain?.dayIndex === 0) marks.push(glossary.plumRain[day.plumRain.phaseIndex])
  return marks.filter((mark): mark is string => Boolean(mark))
}

export function dayView(day: AlmanacDay): AlmanacDayView {
  const weekday = WEEKDAYS[weekdayOf(day.date)] ?? ''
  const dayBranch = branchHanzi(day.branch)
  const opposite = BRANCHES[(BRANCH_KEYS.indexOf(day.branch) + 6) % 12] ?? ''
  const zodiac = glossary.zodiac[day.clashZodiacIndex] ?? ''
  const sha = glossary.direction[day.ominousDirectionIndex] ?? ''
  const triad = TRIADS.find((group) => group.includes(dayBranch)) ?? ''
  const star = glossary.twelveStar[day.twelveStarIndex] ?? { name: '', gloss: '' }
  const ecliptic = glossary.ecliptic[day.eclipticIndex as 0 | 1] ?? ''
  return {
    date: dateKey(day.date),
    month: day.date.month,
    day: day.date.day,
    weekday: `周${weekday}`,
    weekdayLong: `星期${weekday}`,
    lunar: lunarText('zh-Hans', day.lunar),
    pillars: {
      year: cycleText(day.yearCycleIndex),
      month: cycleText(day.monthCycleIndex),
      day: cycleText(day.cycleIndex),
    },
    recommends: tabooList(day.recommends),
    avoids: tabooList(day.avoids),
    duty: ZH_HANS_RULES.duty[day.duty],
    star: {
      name: star.name,
      gloss: `${star.name}是${ecliptic}六神之一。${star.gloss}`,
      ecliptic,
      yellow: day.eclipticIndex === 0,
    },
    clash: {
      zodiac,
      branch: opposite,
      sha,
      gloss: `日支${dayBranch}与${opposite}相冲，${opposite}对应生肖${zodiac}；${dayBranch}属${triad}，当日煞方在正${sha}。`,
    },
    term: {
      name: glossary.solarTerm[day.solarTerm.index] ?? '',
      beginsToday: day.solarTerm.beginsToday,
    },
    marks: marksOf(day),
  }
}

const termTime = (time: { hour: number; minute: number }) => `${pad(time.hour)}:${pad(time.minute)}`
const monthDay = (date: CivilDate) =>
  `${date.month}月${date.day}日（周${WEEKDAYS[weekdayOf(date)] ?? ''}）`

/** 工具页：所选日期的结果，加节气说明（交节时刻、月建与干支年的变化、下一个节气） */
export interface AlmanacToolDay extends AlmanacDayView {
  /** 「2026 年 11 月 22 日 星期日 · 农历十月十四」 */
  readonly caption: string
  readonly termNote: string
}

export function toolDay(engine: AlmanacEngine, date: CivilDate): AlmanacToolDay {
  const month = engine.almanacMonth(date.year, date.month)
  const raw = month.days[date.day - 1] as AlmanacDay
  const view = dayView(raw)
  const terms = month.solarTerms.map((term) => ({
    name: glossary.solarTerm[term.index] ?? '',
    time: term.time,
  }))
  let termNote: string
  const today = terms.find(
    (term) => term.time.month === date.month && term.time.day === date.day && view.term.beginsToday,
  )
  if (today) {
    const changes: string[] = []
    const previous = month.days[date.day - 2]
    if (previous && previous.yearCycleIndex !== raw.yearCycleIndex)
      changes.push(
        `干支年由${cycleText(previous.yearCycleIndex)}转为${cycleText(raw.yearCycleIndex)}`,
      )
    const branchChange = month.monthBranchChanges.find(
      (change) => change.date.day === date.day && change.date.month === date.month,
    )
    if (branchChange)
      changes.push(`月建由${branchHanzi(branchChange.from)}转${branchHanzi(branchChange.to)}`)
    termNote = `当天 ${termTime(today.time)} 交${today.name}${changes.length ? `，${changes.join('，')}` : ''}。`
  } else {
    // 下一个节气：本月尚未交的节气，没有时取下月第一个（年末取次年 1 月）
    let next = terms.find((term) => term.time.month === date.month && term.time.day > date.day)
    if (!next) {
      const [year, monthNumber] =
        date.month === 12 ? [date.year + 1, 1] : [date.year, date.month + 1]
      const following =
        year <= ALMANAC_YEAR_RANGE[1] ? engine.almanacMonth(year, monthNumber) : undefined
      const first = following?.solarTerms[0]
      next = first && { name: glossary.solarTerm[first.index] ?? '', time: first.time }
    }
    termNote = next
      ? `当天处在${view.term.name}节气里。下一个节气是${next.name}，${next.time.month} 月 ${next.time.day} 日 ${termTime(next.time)} 交节。`
      : `当天处在${view.term.name}节气里。`
  }
  return {
    ...view,
    caption: `${date.year} 年 ${date.month} 月 ${date.day} 日 ${view.weekdayLong} · 农历${view.lunar}`,
    termNote,
  }
}

/** 解析 `?date=`：合法且在引擎范围内时返回日期，否则 null */
export function parseAlmanacDate(value: string | undefined): CivilDate | null {
  if (value === undefined) return null
  const date = parseDateKey(value)
  if (!date || date.year < ALMANAC_YEAR_RANGE[0] || date.year > ALMANAC_YEAR_RANGE[1]) return null
  return date
}

/**
 * 月份页显示的年份（决策 5）：参考时区当前月份 ≤ M 时取当年，否则取次年。
 * 12 个月份页因此总是覆盖从当月起的 12 个月；当月页包含已经过去的日子。
 */
export function displayYear(month: number, reference: CivilDate): number {
  return reference.month <= month ? reference.year : reference.year + 1
}

export interface AlmanacMonthView {
  readonly year: number
  readonly month: number
  readonly days: readonly (AlmanacDayView & {
    /** 当天的节气交节标记「立冬 17:52」 */
    readonly termMark: string | null
    /** 农历月初「十月初一」 */
    readonly lunarStart: string | null
    readonly today: boolean
  })[]
  readonly terms: readonly {
    readonly name: string
    readonly when: string
    readonly time: string
    /** 交节当天重复前一天的值星时，值星名（「开」） */
    readonly repeatedDuty: string | null
  }[]
  readonly monthBranch: {
    readonly from: string
    readonly to: string
    readonly when: string
    readonly term: string
    readonly fromPillar: string
    readonly toPillar: string
  } | null
  readonly lunarStarts: readonly { readonly name: string; readonly when: string }[]
  /** 节日与节令：「12月22日 冬至节、一九」 */
  readonly seasonal: readonly { readonly when: string; readonly names: string }[]
}

export function monthView(
  engine: AlmanacEngine,
  year: number,
  month: number,
  today: CivilDate,
): AlmanacMonthView {
  const data = engine.almanacMonth(year, month)
  const terms = data.solarTerms.map((term) => {
    const index = term.time.day - 1
    const day = data.days[index]
    const previous = data.days[index - 1]
    const sameMonth = term.time.month === month && term.time.year === year
    return {
      name: glossary.solarTerm[term.index] ?? '',
      when: monthDay(term.time),
      time: termTime(term.time),
      repeatedDuty:
        sameMonth && day && previous && day.duty === previous.duty
          ? ZH_HANS_RULES.duty[day.duty].name
          : null,
      date: sameMonth ? term.time.day : null,
    }
  })
  const change = data.monthBranchChanges[0]
  const changeDay = change ? data.days[change.date.day - 1] : undefined
  const beforeChange = change ? data.days[change.date.day - 2] : undefined
  const lunarStarts = data.lunarMonthStarts.map((start) => ({
    name: lunarText('zh-Hans', start.lunar),
    when: monthDay(start.date),
    day: start.date.day,
  }))
  const days = data.days.map((raw) => {
    const view = dayView(raw)
    const term = terms.find((item) => item.date === raw.date.day)
    const lunarStart = lunarStarts.find((item) => item.day === raw.date.day)
    return {
      ...view,
      termMark: term ? `${term.name} ${term.time}` : null,
      lunarStart: lunarStart?.name ?? null,
      today:
        raw.date.year === today.year &&
        raw.date.month === today.month &&
        raw.date.day === today.day,
    }
  })
  return {
    year,
    month,
    days,
    terms: terms.map(({ date: _date, ...term }) => term),
    monthBranch:
      change && changeDay && beforeChange
        ? {
            from: branchHanzi(change.from),
            to: branchHanzi(change.to),
            when: `${change.date.month}月${change.date.day}日`,
            term: terms.find((term) => term.date === change.date.day)?.name ?? '',
            fromPillar: cycleText(beforeChange.monthCycleIndex),
            toPillar: cycleText(changeDay.monthCycleIndex),
          }
        : null,
    lunarStarts: lunarStarts.map(({ day: _day, ...start }) => start),
    seasonal: days
      .filter((day) => day.marks.length > 0)
      .map((day) => ({ when: `${day.month}月${day.day}日`, names: day.marks.join('、') })),
  }
}
