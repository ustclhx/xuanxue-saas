import {
  dateLong,
  lastPeriod,
  nextPeriod,
  type RetroData,
  type RetrogradePlanet,
  type SignKey,
} from './model.ts'

/**
 * 逆行日历的界面文字（en）。正文、导语与 FAQ 在内容集合（content/retrograde-calendar/en/index.mdx）。
 * 合规（设计稿 B14）：天文计算类页面的说明用「calculated with standard astronomical methods … for reference and
 * self-reflection only; they do not predict the future」。
 */

const PLANETS: Readonly<Record<RetrogradePlanet, string>> = {
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
}

const SIGNS: Readonly<Record<SignKey, string>> = {
  aries: 'Aries',
  taurus: 'Taurus',
  gemini: 'Gemini',
  cancer: 'Cancer',
  leo: 'Leo',
  virgo: 'Virgo',
  libra: 'Libra',
  scorpio: 'Scorpio',
  sagittarius: 'Sagittarius',
  capricorn: 'Capricorn',
  aquarius: 'Aquarius',
  pisces: 'Pisces',
}

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth'] as const

export const RETRO_COPY = {
  planet: (key: RetrogradePlanet) => PLANETS[key],
  signs: (keys: readonly SignKey[]) => keys.map((key) => SIGNS[key]).join(', '),
  ordinal: (index: number) => ORDINALS[index] ?? String(index + 1),
  months: 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),
  newBadge: 'New',

  tocLabel: 'On this page',
  tocNow: 'Right now',
  tocHow: 'How it’s calculated',

  // 「Right now」块
  nowTitle: 'Retrograde right now',
  asOf: (date: string) => `As of ${date} · changes to today’s date when the page loads`,
  today: (date: string, zone: string) => `Today, ${date} · ${zone}`,
  localNote: 'your local time',
  utcNote: 'UTC',
  until: (planet: string, date: string) => `${planet} · until ${date}`,
  noneNow: 'No planet is retrograde right now.',
  mercury: 'Mercury',
  mercuryRetro: (date: string) => `Retrograde until ${date}`,
  mercuryDirect: (date: string) => `Direct since ${date}`,
  mercuryDirectPlain: 'Direct',
  nextMercury: 'Next Mercury retrograde',
  inDays: (date: string, days: number) =>
    days === 0
      ? `${date} · today`
      : days === 1
        ? `${date} · tomorrow`
        : `${date} · in ${days} days`,
  outOfRange:
    'Today is outside the years this calendar lists. The dates below are kept for reference until the next update.',
  utcAlert:
    'Your time zone is unavailable, so dates are shown in UTC. A planet may turn on a different date where you are.',

  // 年度分区
  yearTitle: (year: number) => `Retrogrades in ${year}`,
  timelineLabel: (year: number) =>
    `Timeline of retrograde periods in ${year} from Mercury to Pluto. The same dates are listed in the tables below.`,
  timelineCaption: (today: boolean) =>
    today
      ? 'Filled bars are retrograde periods. The vertical line is today.'
      : 'Filled bars are retrograde periods.',
  mercuryTitle: (year: number) => `Mercury retrograde ${year}`,
  othersTitle: (year: number) => `Other planets in ${year}`,
  mercuryCaption: (year: number) => `Mercury retrograde periods in ${year}`,
  othersCaption: (year: number) => `Retrograde periods of Venus through Pluto in ${year}`,
  colPeriod: 'Period',
  colPlanet: 'Planet',
  colStart: 'Turns retrograde',
  colEnd: 'Turns direct',
  colSigns: 'Signs',
  stackStart: 'Starts',
  stackEnd: 'Ends',
  stackSigns: 'Signs',
  none: (year: number) => `No retrograde in ${year}.`,
  noneNext: (year: number, date: string) => `No retrograde in ${year}. The next begins ${date}.`,
  tableNote: (zone: 'local' | 'utc', highlighted: boolean) =>
    `${highlighted ? 'Highlighted rows are retrograde right now. ' : ''}${
      zone === 'local' ? 'Dates are in your local time zone.' : 'Dates are in UTC.'
    }`,

  // FAQ 中的水星现状（{mercury-now}）
  mercuryNowRetro: (start: string, end: string) =>
    `Yes. Mercury turned retrograde on ${start} and turns direct on ${end}.`,
  mercuryNowDirect: (end: string, next: string) =>
    `No. Mercury turned direct on ${end}. The next Mercury retrograde begins on ${next}.`,
  mercuryNowNext: (next: string) => `No. The next Mercury retrograde begins on ${next}.`,
  mercuryNowUnknown:
    'This calendar lists Mercury’s retrograde dates for this year and next; see the tables above.',

  faqTitle: 'Common questions',
  relatedTitle: 'Related',
  disclaimer:
    'Dates are calculated with standard astronomical methods. Traditional meanings are for reference and self-reflection only; they do not predict the future.',
} as const

/** `{year}`、`{next}` 换成所列的两个年份 */
export function fillYears(text: string, [year, next]: readonly number[]): string {
  return text
    .replaceAll('{year}', String(year))
    .replaceAll('{next}', String(next ?? Number(year) + 1))
}

/** FAQ「Is Mercury retrograde right now?」的答案：按参考时刻与时区从停滞表算出（占位 `{mercury-now}`） */
export function mercuryNowAnswer(data: RetroData, nowMs: number, timeZone: string): string {
  const active = data.periods.find(
    (period) => period.planet === 'mercury' && period.startMs <= nowMs && nowMs < period.endMs,
  )
  if (active)
    return RETRO_COPY.mercuryNowRetro(
      dateLong(active.startMs, timeZone),
      dateLong(active.endMs, timeZone),
    )
  const last = lastPeriod(data, 'mercury', nowMs)
  const next = nextPeriod(data, 'mercury', nowMs)
  if (last && next)
    return RETRO_COPY.mercuryNowDirect(
      dateLong(last.endMs, timeZone),
      dateLong(next.startMs, timeZone),
    )
  if (next) return RETRO_COPY.mercuryNowNext(dateLong(next.startMs, timeZone))
  return RETRO_COPY.mercuryNowUnknown
}

export const MERCURY_NOW_TOKEN = '{mercury-now}'
