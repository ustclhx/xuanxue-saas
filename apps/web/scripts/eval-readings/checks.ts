import {
  missingSections,
  type ReadingDefinition,
  sectionTitles,
} from '../../src/features/readings/catalog.ts'
import { checkCompliance } from '../../src/features/readings/compliance.ts'
import { toTraditional } from '../../src/features/readings/hant.ts'
import { HANT_PAIRS } from '../../src/features/readings/hant-chars.ts'

/**
 * 评测的确定性检查（spec「确定性检查」）：只用正文与服务端复算的 JSON，不调用模型。
 * 硬性检查（章节、流年年份、合规、字形、就医提示、数据一致）任一失败即样本失败；
 * 长度与夹杂拉丁字母只作提示，供人工判断。
 */

/** v4 各详批的逐年章节标题；v1–v3 没有该章，年份检查只在定义包含该章时进行 */
export const ANNUAL_SECTION_TITLES = [
  '流年逐年',
  '연도별 세운',
  '大限與流年',
  '大限与流年',
  'Year by Year',
] as const

const STEM_KEYS = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui']
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
]
const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const STEM_HANGUL = '갑을병정무기경신임계'
const BRANCH_HANGUL = '자축인묘진사오미신유술해'

/** 窗口内每年的期望值：干支（八字 / 紫微）或个人年数（数字命理） */
export interface ExpectedYear {
  readonly year: number
  readonly ganzhi?: { readonly hanzi: string; readonly hangul: string }
  readonly personalYear?: number
}

function ganzhiOf(stem: unknown, branch: unknown): ExpectedYear['ganzhi'] {
  const s = STEM_KEYS.indexOf(String(stem))
  const b = BRANCH_KEYS.indexOf(String(branch))
  if (s === -1 || b === -1) return undefined
  return {
    hanzi: `${STEM_HANZI[s]}${BRANCH_HANZI[b]}`,
    hangul: `${STEM_HANGUL[s]}${BRANCH_HANGUL[b]}`,
  }
}

/** 从复算结果取窗口年份：八字 `annual.years`、紫微 `horoscope.years`、数字命理 `personalYears` */
export function expectedYears(result: Record<string, unknown>): ExpectedYear[] {
  const annual = (result.annual as { years?: unknown[] } | undefined)?.years
  const horoscope = (result.horoscope as { years?: unknown[] } | undefined)?.years
  const rows = (annual ?? horoscope) as { year: number; stem: string; branch: string }[] | undefined
  if (rows)
    return rows.map((y) => {
      const ganzhi = ganzhiOf(y.stem, y.branch)
      return ganzhi ? { year: y.year, ganzhi } : { year: y.year }
    })
  const personal = result.personalYears as { year: number; value: number }[] | undefined
  if (personal) return personal.map((y) => ({ year: y.year, personalYear: y.value }))
  return []
}

/** `## 标题` 所在章节的正文（到下一个二级标题为止） */
export function sectionBody(markdown: string, title: string): string | null {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => /^##[ \t]/.test(line) && line.includes(title))
  if (start === -1) return null
  const next = lines.slice(start + 1).findIndex((line) => /^##[ \t]/.test(line))
  return lines.slice(start + 1, next === -1 ? undefined : start + 1 + next).join('\n')
}

/** 章节按定义顺序出现（标题允许带编号前缀） */
export function sectionsInOrder(markdown: string, sections: readonly string[]): boolean {
  const titles = sectionTitles(markdown)
  const positions = sections
    .map((section) => titles.findIndex((title) => title.includes(section)))
    .filter((index) => index !== -1)
  return positions.every((value, i) => i === 0 || value > (positions[i - 1] as number))
}

let pairs: { simplified: Set<string>; traditional: Set<string> } | undefined
function glyphSets() {
  if (!pairs) {
    pairs = { simplified: new Set(), traditional: new Set() }
    for (let i = 0; i < HANT_PAIRS.length; i += 2) {
      pairs.simplified.add(HANT_PAIRS.charAt(i))
      pairs.traditional.add(HANT_PAIRS.charAt(i + 1))
    }
  }
  return pairs
}

/** 繁中正文里的简体字，或简中正文里的繁体字（只用一对一无歧义的字表，避免误判） */
export function wrongGlyphs(text: string, locale: string): string[] {
  if (locale !== 'zh-Hant' && locale !== 'zh-Hans') return []
  const set = locale === 'zh-Hant' ? glyphSets().simplified : glyphSets().traditional
  return [...new Set([...text].filter((char) => set.has(char)))]
}

/** 中文、韩文正文中夹杂的拉丁字母单词（Markdown 标记与数字不算） */
export function latinWords(text: string, locale: string): string[] {
  if (locale === 'en') return []
  return [...new Set(text.match(/[A-Za-z]{2,}/g) ?? [])]
}

/** 不计空白的字符数 */
export function charCount(text: string): number {
  return [...text.replace(/\s/g, '')].length
}

const DEFAULT_LENGTH: Record<string, readonly [number, number]> = {
  'zh-Hant': [2000, 12000],
  'zh-Hans': [2000, 12000],
  ko: [2500, 15000],
  en: [8000, 40000],
}

export interface CheckResult {
  readonly name: string
  readonly hard: boolean
  readonly passed: boolean
  readonly detail?: unknown
}

export interface CheckReport {
  readonly passed: boolean
  readonly chars: number
  readonly checks: readonly CheckResult[]
}

/** 年份小节与数据一致：标题年份集合等于窗口、按年份排序，标题中的干支或个人年数与 JSON 一致 */
export function checkYears(body: string, years: readonly ExpectedYear[], locale: string) {
  const headings = [...body.matchAll(/^###[ \t]*(\d{4})(.*)$/gm)].map((m) => ({
    year: Number(m[1]),
    rest: m[2] ?? '',
  }))
  const found = headings.map((h) => h.year)
  const expected = years.map((y) => y.year)
  const missing = expected.filter((year) => !found.includes(year))
  const extra = found.filter((year) => !expected.includes(year))
  const ordered = found.every((year, i) => i === 0 || year > (found[i - 1] as number))
  const mismatched: { year: number; expected: string; heading: string }[] = []
  for (const heading of headings) {
    const want = years.find((y) => y.year === heading.year)
    if (!want) continue
    if (want.ganzhi) {
      const ok =
        heading.rest.includes(want.ganzhi.hanzi) ||
        (locale === 'ko' && heading.rest.includes(want.ganzhi.hangul))
      if (!ok)
        mismatched.push({ year: heading.year, expected: want.ganzhi.hanzi, heading: heading.rest })
    }
    if (want.personalYear !== undefined) {
      const number = heading.rest.match(/Personal Year\s*(\d{1,2})/i)?.[1]
      if (Number(number) !== want.personalYear)
        mismatched.push({
          year: heading.year,
          expected: `Personal Year ${want.personalYear}`,
          heading: heading.rest,
        })
    }
  }
  return { missing, extra, ordered, mismatched }
}

/**
 * 正文中「年份 + 干支」的写法（如「2027 年丁未」「2027（丁未）」）与 JSON 不一致的位置；
 * 只检查窗口内年份，大运起止年等其他年份不在此列。
 */
export function bodyGanzhiMismatches(text: string, years: readonly ExpectedYear[]) {
  const pattern = new RegExp(
    `(\\d{4})\\s*年?\\s*[（(「]?\\s*([${STEM_HANZI}][${BRANCH_HANZI}])`,
    'g',
  )
  const result: { year: number; found: string; expected: string }[] = []
  for (const match of text.matchAll(pattern)) {
    const want = years.find((y) => y.year === Number(match[1]))
    if (want?.ganzhi && match[2] !== want.ganzhi.hanzi)
      result.push({ year: want.year, found: match[2] as string, expected: want.ganzhi.hanzi })
  }
  return result
}

export function checkReading(options: {
  readonly text: string
  readonly definition: ReadingDefinition
  readonly locale: string
  readonly result: Record<string, unknown>
  readonly length?: { readonly min?: number; readonly max?: number } | undefined
}): CheckReport {
  const { definition, locale } = options
  // 繁中报告保存前会把夹杂的简体字换成繁体（generate.ts），检查与使用者看到的正文一致
  const text = toTraditional(options.text, locale)
  const sections = definition.prompt.sections
  const checks: CheckResult[] = []
  const missing = missingSections(text, sections)
  checks.push({ name: 'sections', hard: true, passed: missing.length === 0, detail: { missing } })
  checks.push({ name: 'sectionOrder', hard: true, passed: sectionsInOrder(text, sections) })

  const annualTitle = sections.find((s) => (ANNUAL_SECTION_TITLES as readonly string[]).includes(s))
  const years = expectedYears(options.result)
  if (annualTitle) {
    const body = sectionBody(text, annualTitle) ?? ''
    const y = checkYears(body, years, locale)
    checks.push({
      name: 'annualYears',
      hard: true,
      passed: years.length > 0 && y.missing.length === 0 && y.extra.length === 0 && y.ordered,
      detail: { missing: y.missing, extra: y.extra, ordered: y.ordered },
    })
    const inBody = bodyGanzhiMismatches(text, years)
    checks.push({
      name: 'dataConsistency',
      hard: true,
      passed: y.mismatched.length === 0 && inBody.length === 0,
      detail: { headings: y.mismatched, body: inBody },
    })
  }

  const violations = checkCompliance(text, locale).violations
  checks.push({
    name: 'compliance',
    hard: true,
    passed: violations.length === 0,
    detail: violations,
  })

  const glyphs = wrongGlyphs(text, locale)
  checks.push({ name: 'glyphs', hard: true, passed: glyphs.length === 0, detail: glyphs })

  if (definition.healthSection) {
    const body = sectionBody(text, definition.healthSection.title) ?? ''
    const core = definition.healthSection.notice.replace(/[。.!！\s]+$/u, '')
    checks.push({ name: 'healthNotice', hard: true, passed: body.includes(core) })
  }

  const chars = charCount(text)
  const [defaultMin, defaultMax] = DEFAULT_LENGTH[locale] ?? [0, Number.POSITIVE_INFINITY]
  const min = options.length?.min ?? defaultMin
  const max = options.length?.max ?? defaultMax
  checks.push({
    name: 'length',
    hard: false,
    passed: chars >= min && chars <= max,
    detail: { chars, min, max },
  })
  const latin = latinWords(text, locale)
  checks.push({ name: 'latin', hard: false, passed: latin.length === 0, detail: latin })

  return { passed: checks.every((c) => !c.hard || c.passed), chars, checks }
}
