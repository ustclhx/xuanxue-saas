import type { Aspect, Element, Modality, Planet } from './facts.ts'

/**
 * 西方星座页的界面文字（只有 en，design 决策 2；结构与说明文字以设计稿
 * content-growth-v2-tools/WestPair、WestGrid、WestGridMobile 与 Proposals「PairGrid」为准）。
 * 本集合只有 en，界面文字随按需加载的页面模块下发，不进 messages（否则 es、ja 严格语言须逐条补译）。
 * 逐页撰写的正文在 content/western-zodiac/en。合规声明沿用站上的 tools_disclaimer。
 */

export const ELEMENT_LABEL: Readonly<Record<Element, string>> = {
  fire: 'Fire',
  earth: 'Earth',
  air: 'Air',
  water: 'Water',
}

export const MODALITY_LABEL: Readonly<Record<Modality, string>> = {
  cardinal: 'Cardinal',
  fixed: 'Fixed',
  mutable: 'Mutable',
}

export const PLANET_LABEL: Readonly<Record<Planet, string>> = {
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
}

/** 守护星在传统里的一个关键词（配对表「In tradition」列） */
const PLANET_THEME: Readonly<Record<Planet, string>> = {
  sun: 'identity',
  moon: 'feeling and memory',
  mercury: 'thought and speech',
  venus: 'attraction and value',
  mars: 'drive',
  jupiter: 'growth and meaning',
  saturn: 'structure and time',
  uranus: 'change',
  neptune: 'imagination',
  pluto: 'transformation',
}

export const ASPECT_LABEL: Readonly<Record<Aspect, string>> = {
  conjunction: 'Same sign',
  semisextile: 'Semi-sextile',
  sextile: 'Sextile',
  square: 'Square',
  trine: 'Trine',
  quincunx: 'Quincunx',
  opposition: 'Opposition',
}

/** 总表格内的短名：次要相位按设计稿写「–」（无主要相位），aria-label 仍写全名 */
export const GRID_LABEL: Readonly<Record<Aspect, string>> = {
  conjunction: 'Same',
  semisextile: '–',
  sextile: 'Sextile',
  square: 'Square',
  trine: 'Trine',
  quincunx: '–',
  opposition: 'Opposite',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dayLabel = ([month, day]: readonly [number, number]) => `${MONTHS[month - 1]} ${day}`
export const dateRange = (start: readonly [number, number], end: readonly [number, number]) =>
  `${dayLabel(start)} – ${dayLabel(end)}`

const MODALITY_VERB: Readonly<Record<Modality, string>> = {
  cardinal: 'start things',
  fixed: 'sustain them',
  mutable: 'adapt them',
}

export const ZODIAC_COPY = {
  home: 'Home',
  hubCrumb: 'Zodiac Signs',
  chartCrumb: 'Zodiac Compatibility',
  quickLabel: 'At a glance',
  dates: 'Dates',
  element: 'Element',
  modality: 'Modality',
  ruler: 'Ruling planet',
  opposite: 'Opposite sign',
  aspect: 'Aspect',
  signsApart: 'Signs apart',
  modernRuler: (planet: string) => `modern: ${planet}`,
  degrees: (angle: number) => `${angle}°`,
  // 枢纽
  hubTableTitle: 'The twelve signs at a glance',
  hubTableCaption:
    'The twelve zodiac signs with their usual dates, element, modality and ruling planet',
  hubTableNote:
    'Dates are the usual span of the Sun in each sign. The exact changeover moves by about a day from year to year, so a birthday on the first or last day may fall in the neighboring sign.',
  colSign: 'Sign',
  // 档案页 12 行配对一览
  rowTitle: (sign: string) => `${sign} compatibility with every sign`,
  rowCaption: (sign: string) => `${sign} paired with each of the twelve signs`,
  colPair: 'Pair',
  colAspect: 'Aspect',
  colElements: 'Elements',
  othersTitle: 'Other signs',
  // 配对页
  signBySign: 'Sign by sign',
  signBySignNote:
    'These are general rules about two sun signs. Full birth charts also include the Moon, the rising sign and the planets, which this page does not cover.',
  factor: 'Factor',
  inTradition: 'In tradition',
  betweenThem: 'Between them',
  moreTitle: (sign: string) => `More ${sign} pairs`,
  allPairs: 'All 78 pairs',
  allPairsNote: 'The full compatibility chart',
  seriesLabel: 'Adjacent pairs',
  previous: 'Previous',
  next: 'Next',
  bandText: 'Curious about numbers too? Compare two birth dates by life path number.',
  bandLink: 'Life Path Compatibility',
  // 总表
  gridTitle: 'All twelve signs, pair by pair',
  gridLabel: 'Zodiac compatibility chart',
  keyLabel: 'Key',
  keyHarmonious: 'Trine, sextile',
  keyChallenging: 'Square, opposition',
  keyNeutral: 'Same sign, or no major aspect (–)',
  gridCaption:
    'The chart is symmetric, so there are 78 distinct pairs. Aspects are counted sign to sign, not by exact degrees.',
  pickTitle: 'Pick two signs',
  firstSign: 'First sign',
  secondSign: 'Second sign',
  see: (pair: string) => `See ${pair}`,
  withEvery: (sign: string) => `${sign} with every sign`,
  mobileNote:
    'On phones the chart is shown as two selects and a list of twelve pairs for one sign. All 78 pair pages stay linked.',
} as const

/** 配对表「In tradition」列：元素、模式、守护星与相位的一般说法 */
export const traditionNote = {
  element(relation: 'same' | 'complementary' | 'other'): string {
    switch (relation) {
      case 'same':
        return 'Same element. Signs that share an element are said to share a basic temperament.'
      case 'complementary':
        return 'Complementary elements: fire and air feed each other, as do earth and water.'
      case 'other':
        return 'Elements that are neither shared nor complementary, so each brings what the other lacks.'
    }
  },
  modality(a: Modality, b: Modality): string {
    if (a === b) return `Same modality: both are ${MODALITY_LABEL[a].toLowerCase()} signs.`
    return `${MODALITY_LABEL[a]} signs ${MODALITY_VERB[a].replace(' them', ' things')}, ${MODALITY_LABEL[b].toLowerCase()} signs ${MODALITY_VERB[b]}.`
  },
  ruler(a: Planet, b: Planet): string {
    if (a === b) return `Both are ruled by ${PLANET_LABEL[a]}, linked with ${PLANET_THEME[a]}.`
    return `${PLANET_LABEL[a]} stands for ${PLANET_THEME[a]}, ${PLANET_LABEL[b]} for ${PLANET_THEME[b]}.`
  },
  aspect(aspect: Aspect): string {
    switch (aspect) {
      case 'conjunction':
        return 'The same sign: element, modality and ruler are all shared.'
      case 'sextile':
      case 'trine':
        return 'Counted among the harmonious aspects.'
      case 'square':
      case 'opposition':
        return 'Counted among the challenging, dynamic aspects.'
      default:
        return 'A minor aspect, read as an adjustment between neighboring styles.'
    }
  },
}
