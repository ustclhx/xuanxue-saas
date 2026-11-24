import type { AspectKey, PointKey, SignKey } from '@xuanxue/astro/chart'
import type { ElementKey, ModalityKey } from './model.ts'
import { capitalize, ordinal } from './model.ts'

/**
 * 三巨头计算器与出生星盘的界面文字（只有 en；设计稿 content-growth-v2-batch2/Main.dc.html、NatalChart.dc.html）。
 * 逐页正文与 FAQ 在内容集合 content/natal-chart/en/。公开界面不提人工智能；合规声明沿用西方站措辞（B14）。
 */

export const SIGN_GLYPHS = [
  '♈',
  '♉',
  '♊',
  '♋',
  '♌',
  '♍',
  '♎',
  '♏',
  '♐',
  '♑',
  '♒',
  '♓',
].map((glyph) => `${glyph}︎`)

const POINT_NAMES: Record<PointKey, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
  meanNode: 'North Node',
}

const POINT_GLYPHS: Record<PointKey, string> = {
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
  meanNode: '☊',
}

/** 相位表「传统读法」的拼句：两个行星的关键词 + 相位的传统说法（不作预测） */
const POINT_THEMES: Record<PointKey, string> = {
  sun: 'identity',
  moon: 'feelings and habits',
  mercury: 'thinking and speech',
  venus: 'affection and taste',
  mars: 'drive',
  jupiter: 'growth',
  saturn: 'structure',
  uranus: 'change',
  neptune: 'imagination',
  pluto: 'intensity',
  meanNode: 'direction',
}

const ASPECT_NAMES: Record<AspectKey, string> = {
  conjunction: 'Conjunction',
  sextile: 'Sextile',
  square: 'Square',
  trine: 'Trine',
  opposition: 'Opposition',
}

const ASPECT_ANGLES: Record<AspectKey, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
}

const ASPECT_READINGS: Record<AspectKey, string> = {
  conjunction: 'blended into one theme',
  sextile: 'in easy cooperation',
  square: 'at a right angle, read as friction that asks for adjustment',
  trine: 'in the same element, read as an easy flow',
  opposition: 'facing each other, read as a pull toward balance',
}

const ELEMENT_NAMES: Record<ElementKey, string> = {
  fire: 'Fire',
  earth: 'Earth',
  air: 'Air',
  water: 'Water',
}
const MODALITY_NAMES: Record<ModalityKey, string> = {
  cardinal: 'Cardinal',
  fixed: 'Fixed',
  mutable: 'Mutable',
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const NATAL_COPY = {
  formLabel: 'Birth details',
  date: 'Date of birth',
  time: 'Time of birth',
  unknownTime: 'I don’t know my birth time',
  place: 'Place of birth',
  placePlaceholder: 'Start typing a town or city',
  placeClear: 'Clear place',
  placeTypeMore: 'Type at least two letters, then choose your town or the nearest larger one.',
  placeNone: 'No matching places. Try the nearest larger town.',
  placeLoading: 'Looking up places…',
  placeFailed: 'Places could not be loaded. Check your connection and try again.',
  houseSystem: 'House system',
  placidus: 'Placidus',
  wholeSign: 'Whole sign',
  browserNote: 'Calculated in your browser. No sign-up needed.',
  submitBigThree: 'Find my big three',
  submitChart: 'Draw my chart',
  errors: {
    date: 'Enter a valid date of birth.',
    dateRange: 'Enter a date between 1900 and today.',
    time: 'Enter the time as hours and minutes, or tick “I don’t know my birth time”.',
    place: 'Choose a place from the list so we can look up its coordinates and time zone.',
  },
  engineFailed:
    'The calculation could not be loaded. Check your connection and try again; your details stay in this page.',
  loading: 'Loading the ephemeris. This takes a moment the first time.',
  zoneHint: (zone: string, offset: string, dst: boolean) =>
    `Time zone ${zone} · ${offset} on that date${dst ? ' (daylight saving time)' : ''}`,
  zoneHintUndated: (zone: string) => `Time zone ${zone}`,

  bigThreeTitle: 'Your big three',
  chartTitle: 'Your birth chart',
  sunSign: 'Sun sign',
  moonSign: 'Moon sign',
  risingSign: 'Rising sign (Ascendant)',
  needsTime: 'Needs a birth time',
  notCalculated: 'Not calculated',
  sunText:
    'The Sun sign is the one most people know. Tradition reads it as the themes you grow into over a lifetime.',
  moonText:
    'The Moon sign is read as how you settle and what feels familiar. The Moon changes sign roughly every two and a quarter days.',
  risingText:
    'The rising sign is the sign on the eastern horizon at birth. It changes on average about every two hours, which is why the time matters.',
  risingNoTime:
    'The rising sign moves through all twelve signs in a day, so it can’t be estimated from the date alone.',
  allDay: (sign: string) => `${sign} all day`,
  either: (signs: readonly string[]) => signs.join(' or '),
  changedAt: (time: string) => `Changed signs at ${time} local time`,
  bornBeforeAfter: (time: string, before: string, after: string) =>
    `Born before ${time}: ${before}. Born after: ${after}. If a parent or a birth record can narrow down the hour, enter it above.`,
  noTimeBigThree: (moonChanged: boolean) =>
    `Without a birth time the rising sign can’t be calculated. The Sun and Moon are worked out for the whole day.${moonChanged ? ' The Moon changed signs on this date, so both possibilities are listed.' : ''}`,
  noTimeChart: (moonChanged: boolean) =>
    `No birth time entered. Planets are shown by sign for noon on that date. The Ascendant, Midheaven, houses and chart wheel need a time and are left out.${moonChanged ? ' The Moon changed signs that day, so both possibilities are listed.' : ''}`,
  aboutSign: (sign: string) => `About ${sign}`,
  zodiacSigns: 'Zodiac signs',
  placeLine: (degree: string, sign: string, house: number | null) =>
    `${degree} ${sign}${house ? ` · ${house === 1 ? 'start of the 1st house' : `${houseName(house)} house`}` : ''}`,

  howTitle: 'How this was calculated',
  howCaption: 'Calculation steps',
  step: 'Step',
  value: 'Value',
  note: 'Note',
  localTime: 'Local time',
  localTimeNote: 'As entered.',
  localNoon: 'Local noon',
  localNoonNote: 'Used when the birth time is unknown.',
  timeZone: 'Time zone',
  zoneNote: (dst: boolean) =>
    dst
      ? 'Daylight saving time was in effect at this place on this date.'
      : 'Standard time at this place on this date, from the time-zone database.',
  ambiguousNote:
    'This clock time happened twice when the clocks went back; the earlier moment is used.',
  skippedNote:
    'This clock time was skipped when the clocks went forward, so it is read with the offset before the change.',
  universalTime: 'Universal time',
  universalNote: 'All positions are computed for this moment.',
  coordinates: 'Coordinates',
  coordinatesNote: 'From the place you chose. Needed for the rising sign and houses.',
  houses: 'House system',
  housesNote: 'Above 66° latitude the calculator switches to whole-sign houses and says so.',
  highLatitude:
    'This place is above 66° latitude, where Placidus cusps can’t be computed for every hour, so the chart uses whole-sign houses.',

  seeChartTitle: 'See the whole chart',
  seeChartText:
    'The big three are three points on a birth chart. The full chart adds the other planets, the twelve houses and the aspects between them.',
  seeChartLink: 'Open my birth chart',

  wheelTitle: 'Chart wheel',
  wheelLabel: (asc: string) =>
    `Chart wheel with the twelve signs, twelve houses, eleven points and the closest aspects; Ascendant in ${asc}. The same positions are listed in the planets table.`,
  wheelKey: 'Ascendant on the left, Midheaven near the top.',
  wheelSoft: 'conjunction, sextile, trine',
  wheelHard: 'square, opposition',
  axisLabels: ['AC', 'IC', 'DC', 'MC'] as const,
  bigThreeTile: 'The big three',
  sun: 'Sun',
  moon: 'Moon',
  rising: 'Rising',
  elementsTile: (count: number) => `Elements (${count === 10 ? 'ten' : count} planets)`,
  modalitiesTile: (count: number) => `Modalities (${count === 10 ? 'ten' : count} planets)`,
  moonLeftOut: 'The Moon is left out because its sign depends on the time.',

  planetsTitle: 'Planets',
  planetsCaption: 'Planet positions: sign, degree, house and motion',
  planet: 'Planet',
  sign: 'Sign',
  degree: 'Degree',
  house: 'House',
  motion: 'Motion',
  direct: 'Direct',
  retrograde: 'Retrograde',
  meanNode: 'Mean node',
  dependsOnTime: 'Depends on time',
  ascendant: 'Ascendant',
  midheaven: 'Midheaven',
  cuspLabel: (n: number) => `${ordinal(n)} cusp`,
  cuspsTitle: (system: string) => `House cusps (${system})`,

  aspectsTitle: 'Closest aspects',
  aspectsCaption: 'Aspects between the planets, closest first',
  planets: 'Planets',
  aspect: 'Aspect',
  orb: 'Orb',
  reading: 'Traditional reading',
  showAll: (count: number) => `Show all ${count} aspects`,
  showFewer: 'Show the closest only',
  orbs: 'Orbs: 8° for conjunction, opposition, square and trine; 6° for sextile.',
  noAspects: 'No major aspects between the planets within these orbs.',
  noMoonAspects: 'Without a birth time the Moon’s aspects are left out.',

  disclaimerBigThree:
    'Positions are calculated with standard astronomical methods. Sign meanings are traditional, for reference and self-reflection only; they do not predict the future.',
  disclaimerChart:
    'Positions are calculated with standard astronomical methods. Sign, house and aspect meanings are traditional, for reference and self-reflection only; they do not predict the future.',
  attribution: {
    before: 'Place names and coordinates from ',
    middle: ', licensed under ',
    after: '.',
  },
  relatedTitle: 'Related',
  faqTitle: 'Common questions',
} as const

function houseName(house: number) {
  return ordinal(house)
}

export const signName = (sign: SignKey) => capitalize(sign)
export const pointName = (key: PointKey) => POINT_NAMES[key]
export const pointGlyph = (key: PointKey) => `${POINT_GLYPHS[key]}︎`
export const aspectName = (key: AspectKey) => `${ASPECT_NAMES[key]} (${ASPECT_ANGLES[key]}°)`
export const elementName = (key: ElementKey) => ELEMENT_NAMES[key]
export const modalityName = (key: ModalityKey) => MODALITY_NAMES[key]
export const houseOrdinal = ordinal
export const isHardAspect = (key: AspectKey) => key === 'square' || key === 'opposition'

export function aspectReading(a: PointKey, b: PointKey, aspect: AspectKey): string {
  return `${sentence(POINT_THEMES[a])} and ${POINT_THEMES[b]} ${ASPECT_READINGS[aspect]}.`
}
