import { personalYears } from '@xuanxue/numerology'
import { READING_ANNUAL_YEARS } from './catalog.ts'
import { HANS_PAIRS } from './hans-chars.ts'
import { toTraditional } from './hant.ts'

/**
 * v4 详批生成后的确定性兜底（readings-prompt-v4-yearly tasks 4.3，使用者已批准）：
 * rev2 评测 48 份中有 2 份硬性失败都是单字笔误——简中报告夹一个繁体「變」、年份标题把 2027 丁未写成丁酉。
 * 提示词已有对应约束，模型仍偶发，因此在保存前按数据做无歧义的修正：
 * - zh-Hans：常用「仅繁体」字换成简体（`hans-chars.ts`，只收无歧义的字）；zh-Hant / ko / en 不做字形转换；
 * - ja 八字：中文通变星名换成日本四柱推命的叫法（正印→印綬、七殺→偏官；紫微的主星七殺不动）。2026-11-21 日语真实评测 24 份中
 *   2 份因写了「正印」硬性失败，提示词已明令禁止仍偶发，且两词在日语报告里没有其他含义；
 * - 绑定公历年份的干支（`### 2027 丁未`、`2027年（丁未）`、`### 2027 정미(丁未)`、`2027년 정미년`）
 *   与该年流年干支不一致时改正；数字命理 `### 2027 · Personal Year 5` 的个人年数同理。
 *   标题里有两个以上不同的干支、无法判断改哪一个时不改，计入 unresolved 由调用方记录。
 * 纯函数、可重复调用（已修正的文本再次调用不变）。只对 v4 起的提示词生效，v1–v3 报告保持原样
 * （它们没有逐年小节，基线评测与回滚也需要与改动前一致）。
 */

/** 窗口内某年的期望值：流年干支（八字 / 사주 / 紫微）或个人年数（数字命理） */
export interface GuardYear {
  readonly year: number
  readonly ganzhi?: { readonly hanzi: string; readonly hangul: string }
  readonly personalYear?: number
}

export interface GuardReport {
  /** zh-Hans 中换成简体的繁体字个数 */
  readonly glyphs: number
  /** 改正的年份干支处数（标题与正文，含补上缺失的标题干支） */
  readonly ganzhi: number
  /** 改正的个人年数处数 */
  readonly personalYear: number
  /** 无法安全改正的年份标题处数 */
  readonly unresolved: number
  /** ja 中换成日本叫法的中文术语处数 */
  readonly terms: number
}

export interface GuardResult {
  readonly text: string
  readonly report: GuardReport
}

const EMPTY: GuardReport = { glyphs: 0, ganzhi: 0, personalYear: 0, unresolved: 0, terms: 0 }

/** ja：中文写法 → 日本四柱推命写法（只收一一对应、日语里无其他含义的词） */
const JA_TERMS: readonly (readonly [string, string])[] = [
  ['正印', '印綬'],
  ['七殺', '偏官'],
]

function toJapaneseTerms(text: string): { text: string; count: number } {
  let count = 0
  let result = text
  for (const [from, to] of JA_TERMS) {
    const parts = result.split(from)
    count += parts.length - 1
    result = parts.join(to)
  }
  return { text: result, count }
}

const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const STEM_HANGUL = '갑을병정무기경신임계'
const BRANCH_HANGUL = '자축인묘진사오미신유술해'
const HANZI_PAIR = `[${STEM_HANZI}][${BRANCH_HANZI}]`
const HANGUL_PAIR = `[${STEM_HANGUL}][${BRANCH_HANGUL}]`
/** 干支后接这些词时指大运 / 大限 / 柱，不是该年流年，不改 */
const NOT_YEAR_AFTER = '(?!\\s*[)）]?\\s*(?:大运|大運|大限|대운|柱))'
/** 年份前后紧接区间符号（如「2021–2030」）时是大运等起止年，不是单独的年份 */
const NOT_RANGE_BEFORE = '(?<![\\d~～\\-–—至到])'
const NOT_RANGE_AFTER = '(?!\\s*[~～\\-–—至到]\\s*\\d)'

/** 某公历年对应的流年干支（与 `@xuanxue/bazi` 的 annualOutlook / 紫微流年一致，guard.test.ts 对照） */
export function yearGanzhi(year: number): { hanzi: string; hangul: string } {
  const stem = (((year - 4) % 10) + 10) % 10
  const branch = (((year - 4) % 12) + 12) % 12
  return {
    hanzi: `${STEM_HANZI[stem]}${BRANCH_HANZI[branch]}`,
    hangul: `${STEM_HANGUL[stem]}${BRANCH_HANGUL[branch]}`,
  }
}

/** 兜底只对 v4 起的提示词生效（`<kind>.vN`，N ≥ 4）；新版本沿用 v4 的逐年标题格式 */
export function guardApplies(promptVersion: string | null | undefined): boolean {
  const match = promptVersion?.match(/\.v(\d+)$/)
  return Boolean(match && Number(match[1]) >= 4)
}

const GANZHI_KINDS = new Set(['bazi-full', 'saju-full', 'ziwei-full'])

/**
 * 线上报告的期望年份：窗口起点与复算一致（请求时的 UTC 年，见 catalog.ts recompute），
 * 干支按公历年推算；数字命理按保存的出生日期算个人年。输入不完整时返回空数组（只做字形兜底）。
 */
export function readingGuardYears(
  kind: string,
  startYear: number,
  input: Record<string, unknown>,
): GuardYear[] {
  const years = Array.from({ length: READING_ANNUAL_YEARS }, (_, i) => startYear + i)
  if (GANZHI_KINDS.has(kind)) return years.map((year) => ({ year, ganzhi: yearGanzhi(year) }))
  if (kind === 'numerology-full') {
    const { year, month, day } = input
    if (![year, month, day].every((value) => Number.isInteger(value))) return []
    try {
      return personalYears(
        { year: year as number, month: month as number, day: day as number },
        startYear,
        READING_ANNUAL_YEARS,
      ).map((item) => ({ year: item.year, personalYear: item.value }))
    } catch {
      return []
    }
  }
  return []
}

let hansTable: Map<string, string> | undefined
function hansMap() {
  if (!hansTable) {
    hansTable = new Map()
    for (let i = 0; i < HANS_PAIRS.length; i += 2)
      hansTable.set(HANS_PAIRS.charAt(i), HANS_PAIRS.charAt(i + 1))
  }
  return hansTable
}

/** 简中正文里的常用繁体字换成简体，返回替换个数 */
export function toSimplified(text: string): { text: string; count: number } {
  const map = hansMap()
  let count = 0
  const result = text.replace(/[㐀-鿿]/g, (char) => {
    const simplified = map.get(char)
    if (!simplified) return char
    count++
    return simplified
  })
  return { text: result, count }
}

interface Counter {
  ganzhi: number
  personalYear: number
  unresolved: number
}

const distinct = (values: Iterable<string>) => [...new Set(values)]

const DECADE_WORD = '(?:大运|大運|大限|대운)'
/** 标题中的流年干支候选：排除「庚申大运」「大運庚申」「계축(癸丑) 대운」这类指大运 / 大限的干支 */
const HEADING_HANZI = new RegExp(
  `(?<!${DECADE_WORD}\\s*[（(]?\\s*)(${HANZI_PAIR})(?!\\s*[)）]?\\s*(?:${DECADE_WORD}|柱))`,
  'g',
)
const HEADING_HANGUL = new RegExp(
  `(${HANGUL_PAIR})(?=\\s*[(（]|\\s|년|$)(?!\\s*(?:[(（]\\s*${HANZI_PAIR}\\s*[)）])?\\s*${DECADE_WORD})`,
  'g',
)
/**
 * 数字命理逐年标题中的「个人年」写法：英文 `Personal Year`，西班牙语 `Año personal`
 * （numerology-full.v5，add-locales-eu-ja tasks 5.8）；其他语言沿用英文写法。
 */
const PERSONAL_YEAR_LABELS: Readonly<Record<string, string>> = { es: 'Año personal' }
const personalYearLabel = (locale: string) => PERSONAL_YEAR_LABELS[locale] ?? 'Personal Year'

/** 标题只有年份（可带「年 / 년」）时才补写干支或个人年数；带其他文字时不猜位置，记为 unresolved */
const BARE_HEADING = /^\s*[年년]?\s*$/

/** `### 2027 …` 年份标题（不含「2021–2030」这类区间标题） */
function fixHeading(
  line: string,
  byYear: Map<number, GuardYear>,
  locale: string,
  counter: Counter,
): string {
  const match = line.match(/^(###[ \t]*)(\d{4})(?!\s*[~～\-–—至到]\s*\d)(.*)$/)
  if (!match) return line
  const [, prefix = '', yearText = '', restText = ''] = match
  const want = byYear.get(Number(yearText))
  if (!want) return line
  let rest = restText
  if (want.ganzhi) {
    const { hanzi, hangul } = want.ganzhi
    const hanziFound = distinct([...rest.matchAll(HEADING_HANZI)].map((m) => m[1] as string))
    // 韩文干支只认后接括号、空白、「년」或行尾的两字，避免误伤普通词
    const hangulFound =
      locale === 'ko' ? distinct([...rest.matchAll(HEADING_HANGUL)].map((m) => m[1] as string)) : []
    if (hanziFound.length === 0 && hangulFound.length === 0) {
      if (new RegExp(DECADE_WORD).test(rest)) return line
      if (!BARE_HEADING.test(rest)) {
        counter.unresolved++
        return line
      }
      // 标题只有年份：按提示词格式补上干支
      counter.ganzhi++
      return `${prefix}${yearText} ${locale === 'ko' ? `${hangul}(${hanzi})` : hanzi}`
    }
    if (hanziFound.length > 1 || hangulFound.length > 1) {
      if (!hanziFound.includes(hanzi) || (hangulFound.length > 0 && !hangulFound.includes(hangul)))
        counter.unresolved++
      return line
    }
    const [foundHanzi] = hanziFound
    if (foundHanzi && foundHanzi !== hanzi) {
      rest = rest.replace(HEADING_HANZI, (all, found: string) =>
        found === foundHanzi ? hanzi : all,
      )
      counter.ganzhi++
    }
    const [foundHangul] = hangulFound
    if (foundHangul && foundHangul !== hangul) {
      rest = rest.replace(HEADING_HANGUL, (all, found: string) =>
        found === foundHangul ? hangul : all,
      )
      counter.ganzhi++
    }
  }
  if (want.personalYear !== undefined) {
    const label = personalYearLabel(locale)
    const found = rest.match(new RegExp(`${label}\\s*(\\d{1,2})\\b`, 'i'))
    if (!found) {
      if (!BARE_HEADING.test(rest)) {
        counter.unresolved++
        return line
      }
      counter.personalYear++
      return `${prefix}${yearText} · ${label} ${want.personalYear}`
    }
    if (Number(found[1]) !== want.personalYear) {
      rest = rest.replace(new RegExp(`(${label}\\s*)\\d{1,2}\\b`, 'i'), `$1${want.personalYear}`)
      counter.personalYear++
    }
  }
  return `${prefix}${yearText}${rest}`
}

/** 正文中紧跟公历年份的干支 / 个人年数 */
function fixBody(
  line: string,
  byYear: Map<number, GuardYear>,
  locale: string,
  counter: Counter,
): string {
  const ganzhiOf = (year: string) => byYear.get(Number(year))?.ganzhi
  // 「2027年（丁未）」「2027 年丁未」「2027（丁未）」；与评测 bodyGanzhiMismatches 同一写法
  let result = line.replace(
    new RegExp(
      `${NOT_RANGE_BEFORE}(\\d{4})${NOT_RANGE_AFTER}(\\s*年?\\s*[（(「]?\\s*)(${HANZI_PAIR})${NOT_YEAR_AFTER}`,
      'g',
    ),
    (all, year: string, gap: string, found: string) => {
      const want = ganzhiOf(year)
      if (!want || found === want.hanzi) return all
      counter.ganzhi++
      return `${year}${gap}${want.hanzi}`
    },
  )
  // 「丁未年（2027）」：干支后必须有「年」，与大运「庚申（2025–2034）」区分
  result = result.replace(
    new RegExp(`(${HANZI_PAIR})(年\\s*[（(]\\s*)(\\d{4})(\\s*年?\\s*[)）])`, 'g'),
    (all, found: string, gap: string, year: string, close: string) => {
      const want = ganzhiOf(year)
      if (!want || found === want.hanzi) return all
      counter.ganzhi++
      return `${want.hanzi}${gap}${year}${close}`
    },
  )
  if (locale === 'ko')
    // 「2027년 정미년」「2027년(정미년)」「2027년 정미(丁未)」：韩文干支后须接「년」或括号，避免误伤普通词
    result = result.replace(
      new RegExp(
        `${NOT_RANGE_BEFORE}(\\d{4})${NOT_RANGE_AFTER}(\\s*년?\\s*[(（]?\\s*)(${HANGUL_PAIR})(?:(\\s*[(（]\\s*)(${HANZI_PAIR}))?(?=\\s*년|\\s*[)）])${NOT_YEAR_AFTER}`,
        'g',
      ),
      (
        all,
        year: string,
        gap: string,
        found: string,
        open: string | undefined,
        foundHanzi: string | undefined,
      ) => {
        const want = ganzhiOf(year)
        if (!want) return all
        let changed = 0
        if (found !== want.hangul) changed++
        if (foundHanzi && foundHanzi !== want.hanzi) changed++
        if (changed === 0) return all
        counter.ganzhi += changed
        return `${year}${gap}${want.hangul}${foundHanzi ? `${open}${want.hanzi}` : ''}`
      },
    )
  // 「2027 (Personal Year 5)」「2027 is a Personal Year 5」
  result = result.replace(
    /\b(\d{4})(\s*[(（·,:–—-]?\s*(?:is\s+(?:a|your)\s+)?Personal Year\s+)(\d{1,2})\b/gi,
    (all, year: string, gap: string, found: string) => {
      const want = byYear.get(Number(year))?.personalYear
      if (want === undefined || Number(found) === want) return all
      counter.personalYear++
      return `${year}${gap}${want}`
    },
  )
  // 西班牙语「2027 (Año personal 5)」「2027 es tu año personal 5」
  if (locale === 'es')
    result = result.replace(
      /\b(\d{4})(\s*[(（·,:–—-]?\s*(?:es\s+(?:un|tu)\s+)?año personal\s+)(\d{1,2})\b/gi,
      (all, year: string, gap: string, found: string) => {
        const want = byYear.get(Number(year))?.personalYear
        if (want === undefined || Number(found) === want) return all
        counter.personalYear++
        return `${year}${gap}${want}`
      },
    )
  return result
}

/** 按数据改正年份干支 / 个人年数；years 为空时原样返回 */
export function fixYears(
  text: string,
  years: readonly GuardYear[],
  locale: string,
): { text: string } & Counter {
  const counter: Counter = { ganzhi: 0, personalYear: 0, unresolved: 0 }
  if (years.length === 0) return { text, ...counter }
  const byYear = new Map(years.map((y) => [y.year, y]))
  const lines = text
    .split('\n')
    .map((line) =>
      /^###[ \t]/.test(line) || /^###\d/.test(line)
        ? fixHeading(line, byYear, locale, counter)
        : fixBody(line, byYear, locale, counter),
    )
  return { text: lines.join('\n'), ...counter }
}

/** v4 兜底：zh-Hans 字形、ja 术语 + 年份数据一致；不适用的版本原样返回 */
export function guardReading(
  text: string,
  options: {
    readonly locale: string
    readonly promptVersion: string
    readonly years: readonly GuardYear[]
  },
): GuardResult {
  if (!guardApplies(options.promptVersion)) return { text, report: EMPTY }
  let current = text
  let glyphs = 0
  let terms = 0
  if (options.locale === 'zh-Hans') {
    const simplified = toSimplified(current)
    current = simplified.text
    glyphs = simplified.count
  }
  // 只对八字：紫微斗数里「七殺」是主星名，不能换
  if (options.locale === 'ja' && options.promptVersion.startsWith('bazi-full.')) {
    const japanese = toJapaneseTerms(current)
    current = japanese.text
    terms = japanese.count
  }
  const fixed = fixYears(current, options.years, options.locale)
  return {
    text: fixed.text,
    report: {
      glyphs,
      ganzhi: fixed.ganzhi,
      personalYear: fixed.personalYear,
      unresolved: fixed.unresolved,
      terms,
    },
  }
}

/**
 * 使用者看到的正文：繁中补字形（所有版本，generate.ts 原有行为）后做 v4 兜底。
 * 线上保存（finalizeReading）与评测检查共用，保证评测衡量的就是保存的正文。
 */
export function deliveredReadingText(
  text: string,
  options: {
    readonly locale: string
    readonly promptVersion: string
    readonly years: readonly GuardYear[]
  },
): GuardResult {
  return guardReading(toTraditional(text, options.locale), options)
}

export function guardChanged(report: GuardReport): boolean {
  return report.glyphs + report.ganzhi + report.personalYear + report.terms > 0
}
