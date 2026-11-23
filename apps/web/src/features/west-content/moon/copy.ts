import type { MoonPhaseKey } from './model.ts'

/**
 * 月相页的界面文字（en；es 由第 19.4 项补一份同构对象）。正文、导语与 FAQ 在内容集合（content/moon/en）。
 * 传统月名与 @xuanxue/astro/moon 的 fullMoonNames() 一一对应（单测与 scripts/check-content-moon.mjs 核对），
 * 页面不引入引擎，因此在这里按月份另列一份。
 */
export const FULL_MOON_NAME_KEYS = [
  'wolf-moon',
  'snow-moon',
  'worm-moon',
  'pink-moon',
  'flower-moon',
  'strawberry-moon',
  'buck-moon',
  'sturgeon-moon',
  'corn-moon',
  'hunters-moon',
  'beaver-moon',
  'cold-moon',
] as const

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const PHASES: Readonly<Record<MoonPhaseKey, string>> = {
  'new-moon': 'New Moon',
  'waxing-crescent': 'Waxing Crescent',
  'first-quarter': 'First Quarter',
  'waxing-gibbous': 'Waxing Gibbous',
  'full-moon': 'Full Moon',
  'waning-gibbous': 'Waning Gibbous',
  'last-quarter': 'Last Quarter',
  'waning-crescent': 'Waning Crescent',
}

export const PHASE_ORDER: readonly MoonPhaseKey[] = [
  'new-moon',
  'waxing-crescent',
  'first-quarter',
  'waxing-gibbous',
  'full-moon',
  'waning-gibbous',
  'last-quarter',
  'waning-crescent',
]

const NAMES = [
  'Wolf Moon',
  'Snow Moon',
  'Worm Moon',
  'Pink Moon',
  'Flower Moon',
  'Strawberry Moon',
  'Buck Moon',
  'Sturgeon Moon',
  'Corn Moon',
  'Hunter’s Moon',
  'Beaver Moon',
  'Cold Moon',
] as const

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const MOON_COPY = {
  home: 'Home',
  month: (month: number) => MONTHS[month - 1] ?? '',
  monthShort: (month: number) => (MONTHS[month - 1] ?? '').slice(0, 3),
  phase: (key: MoonPhaseKey) => PHASES[key],
  /** 网格里的短标签 */
  quarterShort: {
    'new-moon': 'New',
    'first-quarter': 'First Q',
    'full-moon': 'Full',
    'last-quarter': 'Last Q',
  } as Record<string, string>,
  /** 传统月名按当地公历月份；不带撇号变体，标题与表格共用 */
  moonName: (month: number) => (NAMES[month - 1] ?? '').replace('’', "'"),
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const,

  localNote: 'your local time',
  utcNote: 'UTC',
  utcAlert:
    'Your time zone is unavailable. Dates and times are shown in UTC, so a phase may fall on a different date where you are.',
  asOf: (date: string) => `As of ${date}`,
  illumination: 'Illumination',
  moonAge: 'Moon age',
  ageValue: (days: number) => plural(Math.round(days), 'day', 'days'),
  nextFull: 'Next full moon',
  nextNew: 'Next new moon',
  inDays: (n: number) => (n === 0 ? 'today' : n === 1 ? 'in 1 day' : `in ${n} days`),
  phasesTitle: 'The eight phases',
  phasesLabel: 'Moon phases in order',
  monthCalendarLabel: (month: string) => `Moon calendar for ${month}`,
  todayTag: 'Today',
  previous: 'Previous',
  next: 'Next',
  seriesLabel: 'Adjacent months',
  monthLink: (month: number) => `${MONTHS[month - 1]} moon calendar`,
  outOfRange:
    'This date is outside the calendar’s current range. Check back for an updated calendar.',

  // 满月页
  tonightFull: 'Tonight is a full moon',
  tonightNot: 'Tonight is not a full moon',
  tonightFullNote: (time: string) => `The full moon occurs at ${time}.`,
  tonightNotNote: (percent: number, date: string) =>
    `Today’s illumination is about ${percent}%. The next full moon is on ${date}.`,
  nextName: 'Name',
  fullAt: 'Date and time',
  ahead: 'Upcoming full moons',
  supermoon: 'Supermoon',
  blueMoon: 'Blue moon',

  // 年度表与表格列
  yearTitle: (year: number) => `Full moons in ${year}`,
  yearCaption: (year: number) => `Full and new moons in ${year}`,
  yearNoteUtc: 'Dates and times are in UTC. Traditional names follow the calendar month.',
  yearNoteLocal: (zone: string) =>
    `Dates and times are in your time zone (${zone}). Traditional names follow the calendar month.`,
  colMonth: 'Month',
  colFull: 'Full moon',
  colTime: 'Time',
  colName: 'Traditional name',
  colNew: 'New moon',
  stackFull: 'Full',
  stackTime: 'Time',
  stackName: 'Name',
  stackNew: 'New',

  // 月历与月份页
  calendarMonthsTitle: 'Choose a month',
  calendarMonthNote: (year: number, date: string | null, name: string) =>
    date ? `${year} · ${name} on ${date}` : `${year} · ${name}`,
  daysTitle: 'Daily moon phases',
  keyDatesTitle: 'Main phases this month',
  keyDatesLabel: 'Main phases',
  monthRollover: (month: string, year: number, next: number) =>
    `This page shows ${month} ${year}. After the month ends it moves on to ${month} ${next}.`,
  monthFuture: (month: string, year: number) =>
    `This page shows ${month} ${year}. It switches to the following year after that month ends.`,
  otherYear: (month: string, year: number) => `Show ${month} ${year}`,
  backToCurrent: (month: string, year: number) => `Back to ${month} ${year}`,
  fullMoonOf: (name: string) => `Full moon: ${name}`,

  faqTitle: 'Common questions',
  relatedTitle: 'Related',
  disclaimer:
    'Moon phases are calculated with standard astronomical methods. Traditional names and customs are for reference and for exploring the subconscious. They do not predict the future.',
} as const

export function fillYear(text: string, year: number): string {
  return text.replaceAll('{year}', String(year))
}
