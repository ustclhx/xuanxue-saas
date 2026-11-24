import type { AngelFacts, AngelGroup } from './numbers.ts'
import type { AngelLocale } from './paths.ts'

/**
 * angel numbers 页的界面文字（en、es；结构与说明文字以设计稿 content-growth-v2-batch2/AngelHub、AngelNumber 为准）。
 * 只随按需加载的页面模块下发，不进 messages。es 按「números angelicales」另写，不逐句对应 en。
 * 数字主题与站上生命灵数页一致（证据目录 content-growth/v2/26/fact-sheet.md §2）。合规声明沿用站上的 tools_disclaimer。
 */

interface DigitTheme {
  /** 格子与事实块用的短主题 */
  readonly short: string
  /** 事实块「Theme of the root」的完整写法 */
  readonly long: string
}

const THEMES: Readonly<Record<AngelLocale, Readonly<Record<number, DigitTheme>>>> = {
  en: {
    0: { short: 'potential', long: 'Potential, wholeness' },
    1: { short: 'beginnings', long: 'Beginnings, initiative' },
    2: { short: 'cooperation', long: 'Cooperation, balance' },
    3: { short: 'expression', long: 'Expression, creativity' },
    4: { short: 'structure', long: 'Structure, groundwork' },
    5: { short: 'change', long: 'Change, freedom' },
    6: { short: 'care', long: 'Care, responsibility' },
    7: { short: 'inquiry', long: 'Inquiry, reflection' },
    8: { short: 'resources', long: 'Resources, influence' },
    9: { short: 'completion', long: 'Completion, perspective' },
    11: { short: 'insight', long: 'Insight, sensitivity' },
    22: { short: 'practical vision', long: 'Practical vision, building' },
    33: { short: 'supportive care', long: 'Supportive care, teaching' },
  },
  es: {
    0: { short: 'potencial', long: 'Potencial, totalidad' },
    1: { short: 'inicio', long: 'Inicio, iniciativa' },
    2: { short: 'cooperación', long: 'Cooperación, equilibrio' },
    3: { short: 'expresión', long: 'Expresión, creatividad' },
    4: { short: 'estructura', long: 'Estructura, cimientos' },
    5: { short: 'cambio', long: 'Cambio, libertad' },
    6: { short: 'cuidado', long: 'Cuidado, responsabilidad' },
    7: { short: 'búsqueda', long: 'Búsqueda, introspección' },
    8: { short: 'recursos', long: 'Recursos, poder personal' },
    9: { short: 'cierre', long: 'Cierre, compasión' },
    11: { short: 'intuición', long: 'Intuición, sensibilidad' },
    22: { short: 'visión práctica', long: 'Visión práctica, construcción' },
    33: { short: 'servicio', long: 'Servicio, enseñanza' },
  },
}

export const digitTheme = (locale: AngelLocale, digit: number) =>
  THEMES[locale][digit] ?? { short: String(digit), long: String(digit) }

const EN_TIMES = ['', 'once', 'twice', 'three times', 'four times']
const ES_TIMES = ['', 'una vez', 'dos veces', 'tres veces', 'cuatro veces']

/** 事实块「Digits」的写法：1, four times / 1 and 2, alternating */
export function digitsSummary(locale: AngelLocale, f: AngelFacts): string {
  const [a = 0, b = 0] = f.distinct
  const n = f.digits.length
  const last = f.digits[n - 1] ?? 0
  if (locale === 'en') {
    switch (f.pattern) {
      case 'repeat':
        return `${a}, ${EN_TIMES[n]}`
      case 'alternate':
        return `${a} and ${b}, alternating`
      case 'pairs':
        return `${a} twice, then ${b} twice`
      case 'mirror':
        return `${a} and ${b}, mirrored`
      case 'ascending':
        return `${a} to ${last}, in order`
      case 'lead':
        return `${a}, then ${b} twice`
    }
  }
  switch (f.pattern) {
    case 'repeat':
      return `${a}, ${ES_TIMES[n]}`
    case 'alternate':
      return `${a} y ${b}, alternados`
    case 'pairs':
      return `${a} dos veces y ${b} dos veces`
    case 'mirror':
      return `${a} y ${b}, en espejo`
    case 'ascending':
      return `Del ${a} al ${last}, en orden`
    case 'lead':
      return `${a} y luego ${b} dos veces`
  }
}

/** 计算步骤「Pattern」行 */
export function patternText(locale: AngelLocale, f: AngelFacts): string {
  const [a = 0, b = 0] = f.distinct
  const n = f.digits.length
  if (locale === 'en') {
    switch (f.pattern) {
      case 'repeat':
        return `The digit ${a} appears ${EN_TIMES[n]}, which emphasizes its theme`
      case 'alternate':
        return `Two digits taking turns, so the themes of ${a} and ${b} are read together`
      case 'pairs':
        return `Two pairs: the theme of ${a} leading into the theme of ${b}`
      case 'mirror':
        return `The sequence reads the same in both directions`
      case 'ascending':
        return `Consecutive digits counting upward, step by step`
      case 'lead':
        return `A single ${a} followed by a doubled ${b}, which stresses the theme of ${b}`
    }
  }
  switch (f.pattern) {
    case 'repeat':
      return `La cifra ${a} aparece ${ES_TIMES[n]} y refuerza su tema`
    case 'alternate':
      return `Dos cifras que se turnan: los temas del ${a} y del ${b} se leen juntos`
    case 'pairs':
      return `Dos pares: el tema del ${a} da paso al del ${b}`
    case 'mirror':
      return `La secuencia se lee igual de izquierda a derecha y al revés`
    case 'ascending':
      return `Cifras consecutivas que suben de una en una`
    case 'lead':
      return `Un ${a} seguido de un ${b} doble, que refuerza el tema del ${b}`
  }
}

/** 「Sum」行：`4 + 4 + 4 = 12 → 1 + 2 = 3` */
export function sumText(f: AngelFacts): string {
  return [
    `${f.digits.join(' + ')} = ${f.sum}`,
    ...f.steps.map((step) => `${step.operands.join(' + ')} = ${step.result}`),
  ].join(' → ')
}

export const ANGEL_COPY = {
  en: {
    hubCrumb: 'Angel Numbers',
    groups: {
      triple: 'Triple numbers',
      four: 'Four-digit numbers',
      more: 'More sequences',
    } satisfies Record<AngelGroup, string>,
    hubNote: undefined as string | undefined,
    howTitle: 'How to read any number',
    howIntro: 'The same three steps work for a number that has no page here.',
    howSteps: [
      [
        'Read each digit',
        'Every digit from 0 to 9 has a traditional theme. 1 is about starting, 2 about pairing, 4 about structure.',
      ],
      [
        'Notice the pattern',
        'A repeated digit stresses its theme. A mixed sequence such as 1212 is read as two themes taking turns.',
      ],
      [
        'Reduce to a root',
        'Add the digits and repeat with each new total until you reach a single digit or one of the master numbers 11, 22 and 33. For example, 1 + 2 + 1 + 2 = 6.',
      ],
    ] as readonly (readonly [string, string])[],
    rootTitle: 'Root numbers 1 to 9',
    rootIntro: 'The life path pages below explain the traditional themes of roots 1 to 9.',
    rootLink: (n: number) => `Life Path Number ${n}`,
    quickLabel: 'Number at a glance',
    digits: 'Digits',
    root: 'Root number',
    digitTheme: (count: number) => (count === 1 ? 'Theme of the digit' : 'Themes of the digits'),
    rootTheme: 'Theme of the root',
    master: (n: number) => `${n}, a master number`,
    breakdownTitle: 'How the number breaks down',
    stepDigits: 'Digits',
    stepPattern: 'Pattern',
    stepSum: 'Sum',
    stepRoot: 'Root',
    rootKept: (n: number) => `${n}, kept as a master number under the life path rule`,
    questionTitle: 'A question to take away',
    nearbyTitle: 'Nearby numbers',
    allNumbers: 'All angel numbers',
    relatedTitle: 'Related',
    numberLink: (n: string) => `Angel number ${n}`,
  },
  es: {
    hubCrumb: 'Números angelicales',
    groups: {
      triple: 'Números publicados',
      four: 'Números publicados',
      more: 'Números publicados',
    } satisfies Record<AngelGroup, string>,
    hubNote:
      'Añadimos números poco a poco. Si el tuyo no está en la lista, puedes leerlo cifra por cifra con los pasos de abajo.' as
        | string
        | undefined,
    howTitle: 'Cómo leer cualquier número',
    howIntro:
      'Lee cada cifra y fíjate en cómo se ordenan. Súmalas y, si hace falta, vuelve a sumar las cifras del resultado. Detente al llegar a una sola cifra o a un número maestro (11, 22 o 33). Por ejemplo, 1 + 2 + 1 + 2 = 6.',
    howSteps: [] as readonly (readonly [string, string])[],
    rootTitle: undefined as string | undefined,
    rootIntro: '',
    rootLink: (n: number) => `Número de vida ${n}`,
    quickLabel: 'El número de un vistazo',
    digits: 'Cifras',
    root: 'Número raíz',
    digitTheme: (count: number) => (count === 1 ? 'Tema de la cifra' : 'Temas de las cifras'),
    rootTheme: 'Tema de la raíz',
    master: (n: number) => `${n}, número maestro`,
    breakdownTitle: 'Cómo se descompone el número',
    stepDigits: 'Cifras',
    stepPattern: 'Patrón',
    stepSum: 'Suma',
    stepRoot: 'Raíz',
    rootKept: (n: number) =>
      `${n}: se conserva como número maestro, igual que en el número de vida`,
    questionTitle: 'Una pregunta para ti',
    nearbyTitle: 'Números cercanos',
    allNumbers: 'Todos los números angelicales',
    relatedTitle: 'Relacionado',
    numberLink: (n: string) => `Número angelical ${n}`,
  },
} as const

/** 相关区块的卡片（站内已上线页面，含第 27 组的个人年数计算器） */
export interface RelatedCard {
  readonly path: string
  readonly title: string
  readonly description: string
}

export function hubRelated(locale: AngelLocale): readonly RelatedCard[] {
  return locale === 'en'
    ? [
        {
          path: '/life-path-number',
          title: 'Life Path Calculator',
          description: 'Your core number from your birth date',
        },
        {
          path: '/numerology-calculator',
          title: 'Numerology Calculator',
          description: 'Numbers from your name',
        },
        {
          path: '/personal-year-number',
          title: 'Personal Year Calculator',
          description: 'The theme numerology gives your current year',
        },
        {
          path: '/daily-numerology',
          title: 'Number of the Day',
          description: 'Today’s universal day number',
        },
      ]
    : [
        {
          path: '/numero-de-vida',
          title: 'Número de vida',
          description: 'Tu número principal según tu fecha de nacimiento',
        },
        {
          path: '/calculadora-numerologia',
          title: 'Calculadora de numerología',
          description: 'Los números de tu nombre',
        },
        {
          path: '/ano-personal',
          title: 'Calculadora del año personal',
          description: 'El número que te corresponde en el año en curso',
        },
        {
          path: '/numerologia',
          title: 'Qué es la numerología',
          description: 'Las cifras, la reducción y los números principales',
        },
      ]
}

/** 数字页的相关卡片：所含数字与根数的生命灵数页，再补计算器，共 4 张 */
export function numberRelated(locale: AngelLocale, f: AngelFacts, number: string): RelatedCard[] {
  const lifePath = locale === 'en' ? '/life-path-number' : '/numero-de-vida'
  const pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]
  const cards: RelatedCard[] = []
  const add = (card: RelatedCard) => {
    if (cards.length < 4 && !cards.some((item) => item.path === card.path)) cards.push(card)
  }
  for (const digit of f.distinct.filter((d) => pages.includes(d)).slice(0, 2))
    add({
      path: `${lifePath}/${digit}`,
      title: locale === 'en' ? `Life Path Number ${digit}` : `Número de vida ${digit}`,
      description:
        locale === 'en' ? `The themes of ${digit} in full` : `Los temas del ${digit} a fondo`,
    })
  if (pages.includes(f.root))
    add({
      path: `${lifePath}/${f.root}`,
      title: locale === 'en' ? `Life Path Number ${f.root}` : `Número de vida ${f.root}`,
      description: locale === 'en' ? `The root of ${number}` : `La raíz del ${number}`,
    })
  for (const card of hubRelated(locale)) add(card)
  return cards
}
