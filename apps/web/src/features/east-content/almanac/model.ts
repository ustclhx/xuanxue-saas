import type { AlmanacDay, AlmanacMonth } from '@xuanxue/bazi/almanac'
import { lunarText } from '../../daily/copy.ts'
import { type CivilDate, dateKey } from '../../daily/date.ts'
import { ZH_HANS_ALMANAC } from '../../daily/rules/almanac.zh-Hans.ts'
import { ZH_HANT_ALMANAC } from '../../daily/rules/almanac.zh-Hant.ts'
import { type AlmanacGlossary, type EastRules, HIDDEN_TABOOS } from '../../daily/rules/types.ts'
import { ZH_HANS_RULES } from '../../daily/rules/zh-Hans.ts'
import { ZH_HANT_RULES } from '../../daily/rules/zh-Hant.ts'
import { ALMANAC_YEAR_RANGE } from './date.ts'
import { ALMANAC_LOCALE, type AlmanacLocale } from './paths.ts'

export { ALMANAC_YEAR_RANGE, parseAlmanacDate } from './date.ts'

/**
 * 黄历的「引擎序号 → 页面文字」（openspec content-growth-phase2 第 6 组）。在服务端执行，
 * 页面组件只拿到解析好的文字，不加载引擎与规则表。宜忌按引擎顺序列出，只去掉 HIDDEN_TABOOS
 * （医疗、法律与吉凶断语类），嫁娶等词条与其他词条同等对待，不重排、不突出（使用者 2026-11-22 裁定）。
 * zh-Hant 農民曆（content-growth-v2-tools 第 18 组）用同一套计算，按 locale 换词表与句式，并多一行胎神占方；
 * 沖煞按台湾农民历惯例写出所沖日柱「沖猴(戊申)煞北」。
 */

export interface AlmanacEngine {
  readonly almanacDay: (date: CivilDate) => AlmanacDay
  readonly almanacMonth: (year: number, month: number) => AlmanacMonth
}

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

/** 按语言的词表与句式。zh-Hans 的句子保持第 2 阶段原样（单测逐字核对） */
interface AlmanacText {
  readonly glossary: AlmanacGlossary
  readonly rules: EastRules
  readonly weekday: (day: string) => string
  readonly weekdayLong: (day: string) => string
  readonly starGloss: (name: string, ecliptic: string, gloss: string) => string
  readonly clashGloss: (input: {
    dayBranch: string
    opposite: string
    zodiac: string
    triad: string
    sha: string
    dayPillar: string
    clashPillar: string
  }) => string
  readonly caption: (date: CivilDate, weekdayLong: string, lunar: string) => string
  readonly yearChange: (from: string, to: string) => string
  readonly branchChange: (from: string, to: string) => string
  readonly termToday: (time: string, name: string, changes: readonly string[]) => string
  readonly termNext: (current: string, name: string, date: CivilDate, time: string) => string
  readonly termCurrent: (current: string) => string
  readonly monthDay: (date: CivilDate, weekday: string) => string
  readonly dayMonth: (month: number, day: number) => string
  readonly fetus: {
    readonly stems: readonly string[]
    readonly branches: readonly string[]
    readonly door: string
    readonly mill: string
    readonly bed: string
    readonly occupy: string
    readonly inside: string
    readonly outside: string
    readonly due: string
  }
}

const TEXT: Readonly<Record<AlmanacLocale, AlmanacText>> = {
  'zh-Hans': {
    glossary: ZH_HANS_ALMANAC,
    rules: ZH_HANS_RULES,
    weekday: (day) => `周${day}`,
    weekdayLong: (day) => `星期${day}`,
    starGloss: (name, ecliptic, gloss) => `${name}是${ecliptic}六神之一。${gloss}`,
    clashGloss: ({ dayBranch, opposite, zodiac, triad, sha }) =>
      `日支${dayBranch}与${opposite}相冲，${opposite}对应生肖${zodiac}；${dayBranch}属${triad}，当日煞方在正${sha}。`,
    caption: (date, weekdayLong, lunar) =>
      `${date.year} 年 ${date.month} 月 ${date.day} 日 ${weekdayLong} · 农历${lunar}`,
    yearChange: (from, to) => `干支年由${from}转为${to}`,
    branchChange: (from, to) => `月建由${from}转${to}`,
    termToday: (time, name, changes) =>
      `当天 ${time} 交${name}${changes.length ? `，${changes.join('，')}` : ''}。`,
    termNext: (current, name, date, time) =>
      `当天处在${current}节气里。下一个节气是${name}，${date.month} 月 ${date.day} 日 ${time} 交节。`,
    termCurrent: (current) => `当天处在${current}节气里。`,
    monthDay: (date, weekday) => `${date.month}月${date.day}日（${weekday}）`,
    dayMonth: (month, day) => `${month}月${day}日`,
    fetus: {
      stems: ['门', '碓磨', '厨灶', '仓库', '房床'],
      branches: ['碓', '厕', '炉', '门', '栖', '床'],
      door: '门',
      mill: '碓磨',
      bed: '房床',
      occupy: '占',
      inside: '房内',
      outside: '外',
      due: '正',
    },
  },
  'zh-Hant': {
    glossary: ZH_HANT_ALMANAC,
    rules: ZH_HANT_RULES,
    weekday: (day) => `週${day}`,
    weekdayLong: (day) => `星期${day}`,
    starGloss: (name, ecliptic, gloss) => `${name}屬於${ecliptic}六神。${gloss}`,
    clashGloss: ({ dayPillar, clashPillar, opposite, zodiac, dayBranch, triad, sha }) =>
      `本日日柱${dayPillar}，所沖的干支為${clashPillar}。兩干陰陽相同，日干剋所沖的天干，兩支相沖。${opposite}對應${zodiac}，而日支${dayBranch}屬${triad}，煞方在${sha}方。`,
    caption: (date, weekdayLong, lunar) =>
      `國曆 ${date.year}年${date.month}月${date.day}日 ${weekdayLong}・農曆${lunar}`,
    yearChange: (from, to) => `年柱由${from}換成${to}`,
    branchChange: (from, to) => `月令由${from}換到${to}`,
    termToday: (time, name, changes) =>
      `本日 ${time} 交${name}${changes.length ? `；${changes.join('，')}` : ''}。`,
    termNext: (current, name, date, time) =>
      `本日仍屬${current}節氣，下一個節氣${name}在${date.month}月${date.day}日 ${time} 交節。`,
    termCurrent: (current) => `本日仍屬${current}節氣。`,
    monthDay: (date, weekday) => `${date.month}/${date.day}（${weekday}）`,
    dayMonth: (month, day) => `${month}/${day}`,
    fetus: {
      stems: ['門', '碓磨', '廚灶', '倉庫', '房床'],
      branches: ['碓', '廁', '爐', '門', '棲', '床'],
      door: '門',
      mill: '碓磨',
      bed: '房床',
      occupy: '占',
      inside: '房內',
      outside: '外',
      due: '正',
    },
  },
}

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
  /** 「周日」「週日」 */
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
  /** 所冲生肖与地支、煞方，以及冲煞的推算说明；`pillar` 是所沖日柱（天干相克、地支相冲） */
  readonly clash: {
    readonly zodiac: string
    readonly branch: string
    readonly pillar: string
    readonly sha: string
    readonly gloss: string
  }
  /** 胎神占方（「占門碓 外東南」），与 tyme4ts FetusDay.getName() 的组字规则一致 */
  readonly fetus: string
  readonly term: { readonly name: string; readonly beginsToday: boolean }
  /** 当天的节日与节令起始（三伏、数九、入梅、出梅），按引擎顺序 */
  readonly marks: readonly string[]
}

/** 宜忌名称：按引擎顺序，只去掉不展示的词条 */
function tabooList(rules: EastRules, indices: readonly number[]): string[] {
  return indices
    .filter((index) => !HIDDEN_TABOOS.has(index) && rules.taboo[index] !== undefined)
    .map((index) => rules.taboo[index] as string)
}

function marksOf(glossary: AlmanacGlossary, day: AlmanacDay, locale: AlmanacLocale): string[] {
  const marks: (string | undefined)[] = []
  for (const { calendar, index } of day.festivals) {
    if (calendar === 'solar') marks.push(glossary.solarFestival[index])
    else if (locale !== 'zh-Hant' || (index !== 4 && index !== 10))
      marks.push(glossary.lunarFestival[index])
  }
  // 引擎每天只返回一个农历节日；清明、冬节按页面的交节日另列，避免同日节日覆盖。
  if (locale === 'zh-Hant' && day.solarTerm.beginsToday) {
    if (day.solarTerm.index === 7) marks.push(glossary.lunarFestival[4])
    if (day.solarTerm.index === 0) marks.push(glossary.lunarFestival[10])
  }
  if (day.dogDays?.dayIndex === 0) marks.push(glossary.dogDay[day.dogDays.phaseIndex])
  if (day.nineDays?.dayIndex === 0) marks.push(glossary.nineDay[day.nineDays.phaseIndex])
  if (day.plumRain?.dayIndex === 0) marks.push(glossary.plumRain[day.plumRain.phaseIndex])
  return marks.filter((mark): mark is string => Boolean(mark))
}

/** 方位里的四正（北、东、西、南，tyme4ts Direction 序号 0、2、6、8）在房外时前加「正」 */
const CARDINAL_DIRECTIONS = new Set([0, 2, 6, 8])

/** 胎神占方：tyme4ts FetusDay.getName() 的组字规则，词表换成本语言 */
export function fetusText(
  fetus: AlmanacDay['fetus'],
  locale: AlmanacLocale = ALMANAC_LOCALE,
): string {
  const { fetus: words, glossary } = TEXT[locale]
  const stem = words.stems[fetus.heavenStemIndex] ?? ''
  const branch = words.branches[fetus.earthBranchIndex] ?? ''
  let place = stem + branch
  if (place === words.door + words.door) place = `${words.occupy}大${words.door}`
  else if (place === `${words.mill}碓`) place = `${words.occupy}${words.mill}`
  else if (place === `${words.bed}床`) place = `${words.occupy}${words.bed}`
  else if (place.startsWith(words.door)) place = words.occupy + place
  const direction = glossary.direction[fetus.directionIndex] ?? ''
  const side =
    fetus.side === 'inside'
      ? words.inside
      : `${words.outside}${CARDINAL_DIRECTIONS.has(fetus.directionIndex) ? words.due : ''}`
  return `${place} ${side}${direction}`
}

export function dayView(day: AlmanacDay, locale: AlmanacLocale = ALMANAC_LOCALE): AlmanacDayView {
  const text = TEXT[locale]
  const { glossary, rules } = text
  const weekday = WEEKDAYS[weekdayOf(day.date)] ?? ''
  const dayBranch = branchHanzi(day.branch)
  const opposite = BRANCHES[(BRANCH_KEYS.indexOf(day.branch) + 6) % 12] ?? ''
  const zodiac = glossary.zodiac[day.clashZodiacIndex] ?? ''
  const sha = glossary.direction[day.ominousDirectionIndex] ?? ''
  const triad = TRIADS.find((group) => group.includes(dayBranch)) ?? ''
  const star = glossary.twelveStar[day.twelveStarIndex] ?? { name: '', gloss: '' }
  const ecliptic = glossary.ecliptic[day.eclipticIndex as 0 | 1] ?? ''
  const dayPillar = cycleText(day.cycleIndex)
  // 天克地冲：日干所克的同阴阳天干（甲克戊）配所冲地支，即台湾农民历「沖猴(戊申)」中的干支
  const clashPillar = `${STEMS[(day.cycleIndex + 4) % 10]}${opposite}`
  return {
    date: dateKey(day.date),
    month: day.date.month,
    day: day.date.day,
    weekday: text.weekday(weekday),
    weekdayLong: text.weekdayLong(weekday),
    lunar: lunarText(locale, day.lunar),
    pillars: {
      year: cycleText(day.yearCycleIndex),
      month: cycleText(day.monthCycleIndex),
      day: dayPillar,
    },
    recommends: tabooList(rules, day.recommends),
    avoids: tabooList(rules, day.avoids),
    duty: { name: rules.duty[day.duty].name, gloss: glossary.duty[day.duty] },
    star: {
      name: star.name,
      gloss: text.starGloss(star.name, ecliptic, star.gloss),
      ecliptic,
      yellow: day.eclipticIndex === 0,
    },
    clash: {
      zodiac,
      branch: opposite,
      pillar: clashPillar,
      sha,
      gloss: text.clashGloss({ dayBranch, opposite, zodiac, triad, sha, dayPillar, clashPillar }),
    },
    fetus: fetusText(day.fetus, locale),
    term: {
      name: glossary.solarTerm[day.solarTerm.index] ?? '',
      beginsToday: day.solarTerm.beginsToday,
    },
    marks: marksOf(glossary, day, locale),
  }
}

const termTime = (time: { hour: number; minute: number }) => `${pad(time.hour)}:${pad(time.minute)}`

/** 工具页：所选日期的结果，加节气说明（交节时刻、月建与干支年的变化、下一个节气） */
export interface AlmanacToolDay extends AlmanacDayView {
  /** 「2026 年 11 月 22 日 星期日 · 农历十月十四」 */
  readonly caption: string
  readonly termNote: string
}

export function toolDay(
  engine: AlmanacEngine,
  date: CivilDate,
  locale: AlmanacLocale = ALMANAC_LOCALE,
): AlmanacToolDay {
  const text = TEXT[locale]
  const { glossary } = text
  const month = engine.almanacMonth(date.year, date.month)
  const raw = month.days[date.day - 1] as AlmanacDay
  const view = dayView(raw, locale)
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
        text.yearChange(cycleText(previous.yearCycleIndex), cycleText(raw.yearCycleIndex)),
      )
    const branchChange = month.monthBranchChanges.find(
      (change) => change.date.day === date.day && change.date.month === date.month,
    )
    if (branchChange)
      changes.push(text.branchChange(branchHanzi(branchChange.from), branchHanzi(branchChange.to)))
    termNote = text.termToday(termTime(today.time), today.name, changes)
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
      ? text.termNext(view.term.name, next.name, next.time, termTime(next.time))
      : text.termCurrent(view.term.name)
  }
  return {
    ...view,
    caption: text.caption(date, view.weekdayLong, view.lunar),
    termNote,
  }
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
  locale: AlmanacLocale = ALMANAC_LOCALE,
): AlmanacMonthView {
  const text = TEXT[locale]
  const { glossary, rules } = text
  const monthDay = (date: CivilDate) =>
    text.monthDay(date, text.weekday(WEEKDAYS[weekdayOf(date)] ?? ''))
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
          ? rules.duty[day.duty].name
          : null,
      date: sameMonth ? term.time.day : null,
    }
  })
  const change = data.monthBranchChanges[0]
  const changeDay = change ? data.days[change.date.day - 1] : undefined
  const beforeChange = change ? data.days[change.date.day - 2] : undefined
  const lunarStarts = data.lunarMonthStarts.map((start) => ({
    name: lunarText(locale, start.lunar),
    when: monthDay(start.date),
    day: start.date.day,
  }))
  const days = data.days.map((raw) => {
    const view = dayView(raw, locale)
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
            when: text.dayMonth(change.date.month, change.date.day),
            term: terms.find((term) => term.date === change.date.day)?.name ?? '',
            fromPillar: cycleText(beforeChange.monthCycleIndex),
            toPillar: cycleText(changeDay.monthCycleIndex),
          }
        : null,
    lunarStarts: lunarStarts.map(({ day: _day, ...start }) => start),
    seasonal: days
      .filter((day) => day.marks.length > 0)
      .map((day) => ({ when: text.dayMonth(day.month, day.day), names: day.marks.join('、') })),
  }
}
