/**
 * 西方星座事实表（openspec content-growth-v2-tools 决策 12）：日期范围、元素、模式、守护星、对宫与黄道序。
 * 静态数据，不依赖天文引擎；配对的角距由黄道序差推出。只放稳定 key 与数值，文字在 copy.ts。
 * scripts/check-content-western-zodiac.mjs 用独立定义逐项复算本文件，并核对正文写到的事实。
 * 本文件不得引用其他模块（检查脚本直接以 Node 加载）。
 */

export const SIGN_KEYS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const
export type SignKey = (typeof SIGN_KEYS)[number]

export type Element = 'fire' | 'earth' | 'air' | 'water'
export type Modality = 'cardinal' | 'fixed' | 'mutable'
export type Planet =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'

export interface SignFact {
  readonly key: SignKey
  /** 黄道序，Aries 为 0 */
  readonly index: number
  readonly glyph: string
  /** 太阳通常进入与离开本座的日期（月、日）；每年交接时刻有一天左右的出入 */
  readonly start: readonly [number, number]
  readonly end: readonly [number, number]
  readonly element: Element
  readonly modality: Modality
  /** 传统守护星（七曜） */
  readonly ruler: Planet
  /** 现代守护星（天王、海王、冥王发现后的通行说法），与传统相同时省略 */
  readonly modernRuler?: Planet
  readonly opposite: SignKey
}

const ELEMENTS: readonly Element[] = ['fire', 'earth', 'air', 'water']
const MODALITIES: readonly Modality[] = ['cardinal', 'fixed', 'mutable']
const GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']
const DATES: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [
    [3, 21],
    [4, 19],
  ],
  [
    [4, 20],
    [5, 20],
  ],
  [
    [5, 21],
    [6, 20],
  ],
  [
    [6, 21],
    [7, 22],
  ],
  [
    [7, 23],
    [8, 22],
  ],
  [
    [8, 23],
    [9, 22],
  ],
  [
    [9, 23],
    [10, 22],
  ],
  [
    [10, 23],
    [11, 21],
  ],
  [
    [11, 22],
    [12, 21],
  ],
  [
    [12, 22],
    [1, 19],
  ],
  [
    [1, 20],
    [2, 18],
  ],
  [
    [2, 19],
    [3, 20],
  ],
]
const RULERS: readonly (readonly [Planet, Planet?])[] = [
  ['mars'],
  ['venus'],
  ['mercury'],
  ['moon'],
  ['sun'],
  ['mercury'],
  ['venus'],
  ['mars', 'pluto'],
  ['jupiter'],
  ['saturn'],
  ['saturn', 'uranus'],
  ['jupiter', 'neptune'],
]

export const SIGNS: readonly SignFact[] = SIGN_KEYS.map((key, index) => {
  const [start, end] = DATES[index] ?? [
    [0, 0],
    [0, 0],
  ]
  const [ruler = 'sun', modernRuler] = RULERS[index] ?? []
  return {
    key,
    index,
    glyph: GLYPHS[index] ?? '',
    start,
    end,
    element: ELEMENTS[index % 4] ?? 'fire',
    modality: MODALITIES[index % 3] ?? 'cardinal',
    ruler,
    ...(modernRuler && { modernRuler }),
    opposite: SIGN_KEYS[(index + 6) % 12] ?? key,
  }
})

export const signOf = (key: SignKey): SignFact =>
  SIGNS[SIGN_KEYS.indexOf(key)] ?? (SIGNS[0] as SignFact)
export const isSignKey = (value: string): value is SignKey =>
  (SIGN_KEYS as readonly string[]).includes(value)

/** 按黄道序差（0–6 宫）命名的整宫相位：合、半六分、六分、四分、三分、梅花（补十二分）、对分 */
export const ASPECTS = [
  'conjunction',
  'semisextile',
  'sextile',
  'square',
  'trine',
  'quincunx',
  'opposition',
] as const
export type Aspect = (typeof ASPECTS)[number]

/** 主要相位里的和谐与紧张两类（总表填充与描边）；合与次要相位为中性 */
export type AspectTone = 'harmonious' | 'challenging' | 'neutral'
export const ASPECT_TONE: Readonly<Record<Aspect, AspectTone>> = {
  conjunction: 'neutral',
  semisextile: 'neutral',
  sextile: 'harmonious',
  square: 'challenging',
  trine: 'harmonious',
  quincunx: 'neutral',
  opposition: 'challenging',
}

/** 元素关系：同元素；互补（火与风、土与水）；其他 */
export type ElementRelation = 'same' | 'complementary' | 'other'

export interface PairFact {
  readonly first: SignKey
  readonly second: SignKey
  /** 黄道上相隔的宫数（0–6） */
  readonly distance: number
  readonly angle: number
  readonly aspect: Aspect
  readonly tone: AspectTone
  readonly elementRelation: ElementRelation
  readonly sameModality: boolean
  /** 火、风为阳性（外向），土、水为阴性（内向）；相隔偶数宫时极性相同 */
  readonly samePolarity: boolean
}

const COMPLEMENT: Readonly<Record<Element, Element>> = {
  fire: 'air',
  air: 'fire',
  earth: 'water',
  water: 'earth',
}

export function pairFacts(a: SignKey, b: SignKey): PairFact {
  const [first, second] = SIGN_KEYS.indexOf(a) <= SIGN_KEYS.indexOf(b) ? [a, b] : [b, a]
  const x = signOf(first)
  const y = signOf(second)
  const raw = Math.abs(x.index - y.index)
  const distance = Math.min(raw, 12 - raw)
  const aspect = ASPECTS[distance] ?? 'conjunction'
  return {
    first,
    second,
    distance,
    angle: distance * 30,
    aspect,
    tone: ASPECT_TONE[aspect],
    elementRelation:
      x.element === y.element
        ? 'same'
        : COMPLEMENT[x.element] === y.element
          ? 'complementary'
          : 'other',
    sameModality: x.modality === y.modality,
    samePolarity: distance % 2 === 0,
  }
}

/** 78 组配对，按黄道序（Aries 与 Aries、Aries 与 Taurus …） */
export const PAIRS: readonly (readonly [SignKey, SignKey])[] = SIGN_KEYS.flatMap((a, i) =>
  SIGN_KEYS.slice(i).map((b) => [a, b] as const),
)

export const pairSlug = (a: SignKey, b: SignKey): string => {
  const { first, second } = pairFacts(a, b)
  return `${first}-and-${second}`
}

export function parsePairSlug(slug: string): readonly [SignKey, SignKey] | undefined {
  const [a = '', b = '', ...rest] = slug.split('-and-')
  if (rest.length || !isSignKey(a) || !isSignKey(b)) return undefined
  return SIGN_KEYS.indexOf(a) <= SIGN_KEYS.indexOf(b) ? [a, b] : undefined
}
