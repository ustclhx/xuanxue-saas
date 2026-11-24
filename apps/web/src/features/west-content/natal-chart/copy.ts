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
  conjunction: 'can blend into one theme',
  sextile: 'may work together with a little effort',
  square: 'can create tension that calls for adjustment',
  trine: 'may flow easily together',
  opposition: 'can pull in different directions and call for balance',
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
    time: 'Enter your birth time or select “I don’t know my birth time.”',
    place: 'Choose a place from the list so we can look up its coordinates and time zone.',
  },
  engineFailed:
    'Check your connection and try again. The details you entered are still on this page.',
  loading: 'Getting the calculator ready. This can take a moment on your first visit.',
  zoneHint: (zone: string, offset: string) => `Time zone ${zone} · ${offset} at local noon`,
  zoneHintUndated: (zone: string) => `Time zone ${zone}`,

  bigThreeTitle: 'Your big three',
  chartTitle: 'Your birth chart',
  sunSign: 'Sun sign',
  moonSign: 'Moon sign',
  risingSign: 'Rising sign (Ascendant)',
  needsTime: 'Needs a birth time',
  notCalculated: 'Not calculated',
  sunText: 'In astrology, the Sun sign is associated with identity and how you express it.',
  moonText:
    'Astrologers associate the Moon sign with habits and what makes you feel at home. The Moon spends about two and a quarter days in each sign on average.',
  risingText:
    'The rising sign is the sign on the eastern horizon at birth. It changes on average about every two hours, which is why the time matters.',
  risingNoTime: 'The rising sign depends on the time of day as well as the place of birth.',
  allDay: (sign: string) => `${sign} all day`,
  either: (signs: readonly string[]) => signs.join(' or '),
  changedAt: (time: string) => `Changed signs at ${time} local time`,
  bornBeforeAfter: (time: string, before: string, after: string) =>
    `${before} before about ${time}, then ${after}. You can enter a birth time above if you find it.`,
  noTimeBigThree: (moonChanged: boolean) =>
    `Without a birth time, we can show the Sun and Moon signs and check whether either changed that day. The rising sign requires a birth time.${moonChanged ? ' The Moon changed signs that day, so both possibilities are listed.' : ''}`,
  noTimeChart: (moonChanged: boolean) =>
    `With a date and place, you can find the Sun and Moon signs. Enter a birth time to see the full chart.${moonChanged ? ' The Moon changed signs that day, so both possibilities are listed.' : ''}`,
  aboutSign: (sign: string) => `About ${sign}`,
  zodiacSigns: 'Zodiac signs',
  placeLine: (degree: string, sign: string, house: number | null) =>
    `${degree} ${sign}${house === null ? '' : ` · ${ordinal(house)} house`}`,

  howTitle: 'How this was calculated',
  howCaption: 'Calculation steps',
  step: 'Step',
  value: 'Value',
  note: 'Note',
  localTime: 'Local time',
  localTimeNote: 'As entered.',
  timeZone: 'Time zone',
  zoneNote: 'The UTC offset in effect at the selected place and time.',
  ambiguousNote:
    'This clock time happened twice when the clocks went back; the earlier moment is used.',
  skippedNote:
    'This clock time was skipped when the clocks went forward, so it is read with the offset before the change.',
  universalTime: 'Universal time',
  universalNote: 'All positions are computed for this moment.',
  coordinates: 'Coordinates',
  coordinatesNote: 'From the place you chose. Needed for the rising sign and houses.',
  houses: 'House system',
  housesNote: 'The house system used to calculate this chart.',
  highLatitude:
    'At latitudes beyond 66° north or south, Placidus cusps may be undefined. This chart uses whole-sign houses.',

  seeChartTitle: 'See the whole chart',
  seeChartText:
    'The big three are three points on a birth chart. The full chart adds the other planets, the twelve houses and the aspects between them.',
  seeChartLink: 'Open my birth chart',

  wheelTitle: 'Chart wheel',
  wheelLabel: (asc: string) =>
    `Chart wheel with the twelve signs, twelve houses, eleven points and the closest aspects; Ascendant in ${asc}. The same positions are listed in the planets table.`,
  wheelKey: 'The Ascendant (AC) is on the left. The Midheaven is marked MC.',
  wheelSoft: 'conjunction, sextile, trine',
  wheelHard: 'square, opposition',
  axisLabels: ['AC', 'IC', 'DC', 'MC'] as const,
  bigThreeTile: 'The big three',
  sun: 'Sun',
  moon: 'Moon',
  rising: 'Rising',
  elementsTile: 'Elements (ten planets)',
  modalitiesTile: 'Modalities (ten planets)',

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
