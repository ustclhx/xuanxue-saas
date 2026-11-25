import {
  clockTime,
  clockTimeEs,
  fullDate,
  fullDateEs,
  longDate,
  longDateEs,
  type MoonPhaseKey,
  shortDate,
  shortDateEs,
} from './model.ts'
import type { MoonLocale } from './paths.ts'

/**
 * 月相页的界面文字（en 与 es 两份同构对象；es 为第 19.4 项按西语写法另写）。正文、导语与 FAQ 在内容集合（content/moon/<locale>）。
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
  month: (month: number): string => MONTHS[month - 1] ?? '',
  /** 「November 2026」 */
  monthYear: (month: number, year: number) => `${MONTHS[month - 1] ?? ''} ${year}`,
  shortDate,
  clockTime,
  longDate,
  fullDate,
  /** 水合后的当天日期行（首帧另用 asOf） */
  todayLine: (date: string) => date,
  phaseLabel: (phase: string, percent: number) => `${phase}, ${percent}% illuminated`,
  /** 月历网格每周第一天：0 周日 */
  weekStart: 0 as 0 | 1,
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
  moonName: (month: number): string => (NAMES[month - 1] ?? '').replace('’', "'"),
  /** 按 weekStart 排好的星期表头 */
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as readonly string[],

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
  /** 没有月份页的语言里，当月月历下的链接改指月历枢纽（es） */
  calendarLink: 'Moon calendar',
  /** 没有月份页的语言里，月历枢纽列出接下来的满月与新月（es） */
  upcomingTitle: 'Full and new moons ahead',
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
}

export type MoonCopy = typeof MOON_COPY

const ES_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

const ES_PHASES: Readonly<Record<MoonPhaseKey, string>> = {
  'new-moon': 'Luna nueva',
  'waxing-crescent': 'Luna creciente',
  'first-quarter': 'Cuarto creciente',
  'waxing-gibbous': 'Gibosa creciente',
  'full-moon': 'Luna llena',
  'waning-gibbous': 'Gibosa menguante',
  'last-quarter': 'Cuarto menguante',
  'waning-crescent': 'Luna menguante',
}

/**
 * 西语媒体和科普出版物采用的北美满月名译名，与 FULL_MOON_NAME_KEYS 逐月对应。
 */
const ES_NAMES = [
  'Luna del Lobo',
  'Luna de Nieve',
  'Luna del Gusano',
  'Luna Rosa',
  'Luna de las Flores',
  'Luna de Fresa',
  'Luna del Ciervo',
  'Luna del Esturión',
  'Luna del Maíz',
  'Luna del Cazador',
  'Luna del Castor',
  'Luna Fría',
] as const

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const days = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

export const MOON_COPY_ES: MoonCopy = {
  home: 'Inicio',
  month: (month: number) => ES_MONTHS[month - 1] ?? '',
  monthShort: (month: number) => (ES_MONTHS[month - 1] ?? '').slice(0, 3).toLowerCase(),
  monthYear: (month: number, year: number) => `${ES_MONTHS[month - 1] ?? ''} de ${year}`,
  shortDate: shortDateEs,
  clockTime: clockTimeEs,
  longDate: longDateEs,
  fullDate: fullDateEs,
  todayLine: capitalize,
  phaseLabel: (phase: string, percent: number) => `${phase}, ${percent} % iluminada`,
  weekStart: 1,
  phase: (key: MoonPhaseKey) => ES_PHASES[key],
  quarterShort: {
    'new-moon': 'Nueva',
    'first-quarter': 'C. crec.',
    'full-moon': 'Llena',
    'last-quarter': 'C. meng.',
  },
  moonName: (month: number) => ES_NAMES[month - 1] ?? '',
  weekdays: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],

  localNote: 'tu hora local',
  utcNote: 'UTC',
  utcAlert:
    'No pudimos leer tu zona horaria. Las fechas y horas se muestran en UTC, así que una fase puede caer en otra fecha donde estás.',
  asOf: (date: string) => `Calculado para el ${date}`,
  illumination: 'Iluminación',
  moonAge: 'Edad de la Luna',
  ageValue: (value: number) => days(Math.round(value)),
  nextFull: 'Próxima luna llena',
  nextNew: 'Próxima luna nueva',
  inDays: (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`),
  phasesTitle: 'Las ocho fases',
  phasesLabel: 'Fases de la Luna en orden',
  monthCalendarLabel: (month: string) => `Calendario lunar de ${month}`,
  todayTag: 'Hoy',
  previous: 'Anterior',
  next: 'Siguiente',
  seriesLabel: 'Meses vecinos',
  monthLink: (month: number) => `Calendario lunar de ${(ES_MONTHS[month - 1] ?? '').toLowerCase()}`,
  calendarLink: 'Calendario lunar',
  upcomingTitle: 'Lunas llenas y nuevas de los próximos meses',
  outOfRange:
    'Esta fecha queda fuera del periodo que cubre el calendario. Vuelve pronto para ver la versión actualizada.',

  tonightFull: 'Hoy hay luna llena',
  tonightNot: 'Hoy no hay luna llena',
  tonightFullNote: (time: string) => `La luna llena ocurre a las ${time}.`,
  tonightNotNote: (percent: number, date: string) =>
    `Hoy está iluminado cerca del ${percent} % del disco lunar. La próxima luna llena será el ${date}.`,
  nextName: 'Nombre popular',
  fullAt: 'Fecha y hora',
  ahead: 'Próximas lunas llenas',
  supermoon: 'Superluna',
  blueMoon: 'Luna azul',

  yearTitle: (year: number) => `Lunas llenas de ${year}`,
  yearCaption: (year: number) => `Lunas llenas y nuevas de ${year}`,
  yearNoteUtc: 'Fechas y horas en UTC. El nombre popular sigue el mes del calendario.',
  yearNoteLocal: (zone: string) =>
    `Fechas y horas en tu zona horaria (${zone}). El nombre popular sigue el mes del calendario.`,
  colMonth: 'Mes',
  colFull: 'Luna llena',
  colTime: 'Hora',
  colName: 'Nombre popular',
  colNew: 'Luna nueva',
  stackFull: 'Llena',
  stackTime: 'Hora',
  stackName: 'Nombre',
  stackNew: 'Nueva',

  calendarMonthsTitle: 'Elige un mes',
  calendarMonthNote: (year: number, date: string | null, name: string) =>
    date ? `${year} · ${name} el ${date}` : `${year} · ${name}`,
  daysTitle: 'Fases de la Luna día a día',
  keyDatesTitle: 'Fases principales del mes',
  keyDatesLabel: 'Fases principales',
  monthRollover: (month: string, year: number, next: number) =>
    `Esta página muestra ${month.toLowerCase()} de ${year}. Cuando termine el mes, pasará a ${month.toLowerCase()} de ${next}.`,
  monthFuture: (month: string, year: number) =>
    `Esta página muestra ${month.toLowerCase()} de ${year}. Cambiará al año siguiente cuando termine ese mes.`,
  otherYear: (month: string, year: number) => `Ver ${month.toLowerCase()} de ${year}`,
  backToCurrent: (month: string, year: number) => `Volver a ${month.toLowerCase()} de ${year}`,
  fullMoonOf: (name: string) => `Luna llena: ${name}`,

  faqTitle: 'Preguntas frecuentes',
  relatedTitle: 'Temas relacionados',
  disclaimer:
    'Las fases se calculan con métodos astronómicos estándar. Los nombres y las costumbres tradicionales sirven solo como referencia para reflexionar y explorar el subconsciente, y no predicen el futuro.',
}

export function moonCopy(locale: MoonLocale): MoonCopy {
  return locale === 'es' ? MOON_COPY_ES : MOON_COPY
}

export function fillYear(text: string, year: number): string {
  return text.replaceAll('{year}', String(year))
}
