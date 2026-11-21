import { type Check, type CheckContext, type CheckResult, z } from '@xuanxue/evals'
import {
  type CompiledGlossary,
  compileGlossary,
  loadGlossaries,
  scanText,
} from '../../apps/web/scripts/check-locale-glossary.mjs'
import { missingSections, sectionTitles } from '../../apps/web/src/features/readings/catalog.ts'
import { checkCompliance } from '../../apps/web/src/features/readings/compliance.ts'
import { HANT_PAIRS } from '../../apps/web/src/features/readings/hant-chars.ts'
import {
  comboOf,
  type ReadingSampleInput,
  type ResolvedReading,
  resolveReading,
} from './prompts.ts'

/**
 * 确定性检查（spec「确定性检查」），自 apps/web/scripts/eval-readings/checks.ts 迁移，判定逻辑不变：
 * 硬性检查（章节、章节顺序、流年年份、数据一致、合规、字形、就医提示）为 error 级；
 * 长度与夹杂拉丁字母只作提示，保持 warn 级，不提升为硬性失败。
 * 被评正文已经过 prepare.ts（与线上保存的正文相同），这里不再做字形补正。
 * add-locales-eu-ja tasks 5.8 追加两项 error 级检查（只对新语言生效，旧组合记为 not applicable）：
 * `script`（es 不得出现汉字、假名、谚文）与 `glossary`（术语表 apps/web/i18n/glossary/<locale>.json 的禁用写法，
 * 含「entretenimiento」定位与 vosotros）。
 */

/** v4 各详批的逐年章节标题；v1–v3 没有该章，年份检查只在定义包含该章时进行 */
export const ANNUAL_SECTION_TITLES = [
  '流年逐年',
  '연도별 세운',
  '大限與流年',
  '大限与流年',
  'Year by Year',
  'Año por año',
  '大限と年運',
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

/** 中文、韩文、日文正文中夹杂的拉丁字母单词（Markdown 标记与数字不算）；拉丁字母语言不检查 */
export function latinWords(text: string, locale: string): string[] {
  if (LATIN_LOCALES.has(locale)) return []
  return [...new Set(text.match(/[A-Za-z]{2,}/g) ?? [])]
}

const LATIN_LOCALES: ReadonlySet<string> = new Set(['en', 'es'])

/** 拉丁字母语言正文中的汉字、假名与谚文（模型夹杂外文字符） */
export function cjkChars(text: string, locale: string): string[] {
  if (!LATIN_LOCALES.has(locale)) return []
  return [
    ...new Set(
      text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [],
    ),
  ]
}

/** 启用术语表检查的语言（新语言各有一份术语表；旧语言没有，旧录制的检查结果不变） */
export const GLOSSARY_CHECK_LOCALES: ReadonlySet<string> = new Set(['es'])

let glossaries: Map<string, CompiledGlossary> | undefined
function glossaryOf(locale: string): CompiledGlossary | undefined {
  if (!glossaries)
    glossaries = new Map(
      loadGlossaries().map(({ locale: code, glossary }) => [code, compileGlossary(glossary)]),
    )
  return glossaries.get(locale)
}

/** 正文中术语表的禁用写法（术语、文风与合规）；未启用的语言返回 null */
export function glossaryHits(text: string, locale: string): string[] | null {
  if (!GLOSSARY_CHECK_LOCALES.has(locale)) return null
  const compiled = glossaryOf(locale)
  if (!compiled) throw new Error(`glossary for ${locale} is missing`)
  return scanText(text, compiled, { file: 'reading-output' }).map(
    (hit) =>
      `${hit.banned}${hit.use ? ` → ${hit.use}` : ''} (${hit.line}:${hit.column}) …${hit.excerpt}…`,
  )
}

/** 不计空白的字符数 */
export function charCount(text: string): number {
  return [...text.replace(/\s/g, '')].length
}

export const DEFAULT_LENGTH: Readonly<Record<string, readonly [number, number]>> = {
  'zh-Hant': [2000, 12000],
  'zh-Hans': [2000, 12000],
  ko: [2500, 15000],
  en: [8000, 40000],
  // 日语假名多，同样内容的字数高于中文
  ja: [3000, 16000],
}

/**
 * 按组合覆盖语言默认区间（优先于 DEFAULT_LENGTH）：西语比英文长约 15%；
 * 塔罗只有五章、三张牌的牌阵较短，下限放低。仍是 warn 级。
 */
export const COMBO_LENGTH: Readonly<Record<string, readonly [number, number]>> = {
  'numerology-full.es': [9000, 46000],
  'tarot-spread.es': [2500, 30000],
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
      // 英文 `Personal Year 5`，西班牙语 `Año personal 5`（numerology-full.v5）
      const number = heading.rest.match(/(?:Personal Year|Año personal)\s*(\d{1,2})/i)?.[1]
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

// 同一次运行中，一个样本的多项检查共用同一份复算结果
const resolved = new WeakMap<object, Map<string, ResolvedReading>>()
function readingOf(ctx: CheckContext): ResolvedReading & { readonly locale: string } {
  const input = ctx.sample.input as unknown as ReadingSampleInput
  const byVersion = resolved.get(ctx.sample) ?? new Map<string, ResolvedReading>()
  resolved.set(ctx.sample, byVersion)
  let reading = byVersion.get(ctx.prompt.promptVersion)
  if (!reading) {
    reading = resolveReading(ctx.prompt.promptVersion, input)
    byVersion.set(ctx.prompt.promptVersion, reading)
  }
  return { ...reading, locale: input.locale }
}

const result = (pass: boolean, detail?: unknown): CheckResult =>
  detail === undefined
    ? { pass }
    : { pass, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }

/** 该版本的逐年章节标题；v1–v3 没有该章时为 undefined */
function annualTitle(reading: ResolvedReading): string | undefined {
  return reading.definition.prompt.sections.find((s) =>
    (ANNUAL_SECTION_TITLES as readonly string[]).includes(s),
  )
}

const NOT_APPLICABLE = 'not applicable: this prompt version has no year-by-year section'

export const sectionsCheck: Check = {
  id: 'sections',
  run(ctx) {
    const missing = missingSections(ctx.output, readingOf(ctx).definition.prompt.sections)
    return result(missing.length === 0, { missing })
  },
}

export const sectionOrderCheck: Check = {
  id: 'sectionOrder',
  run: (ctx) => result(sectionsInOrder(ctx.output, readingOf(ctx).definition.prompt.sections)),
}

export const annualYearsCheck: Check = {
  id: 'annualYears',
  run(ctx) {
    const reading = readingOf(ctx)
    const title = annualTitle(reading)
    if (!title) return result(true, NOT_APPLICABLE)
    const years = expectedYears(reading.recomputed.result)
    const y = checkYears(sectionBody(ctx.output, title) ?? '', years, reading.locale)
    return result(years.length > 0 && y.missing.length === 0 && y.extra.length === 0 && y.ordered, {
      missing: y.missing,
      extra: y.extra,
      ordered: y.ordered,
    })
  },
}

export const dataConsistencyCheck: Check = {
  id: 'dataConsistency',
  run(ctx) {
    const reading = readingOf(ctx)
    const title = annualTitle(reading)
    if (!title) return result(true, NOT_APPLICABLE)
    const years = expectedYears(reading.recomputed.result)
    const y = checkYears(sectionBody(ctx.output, title) ?? '', years, reading.locale)
    const inBody = bodyGanzhiMismatches(ctx.output, years)
    return result(y.mismatched.length === 0 && inBody.length === 0, {
      headings: y.mismatched,
      body: inBody,
    })
  },
}

export const complianceCheck: Check = {
  id: 'compliance',
  run(ctx) {
    const violations = checkCompliance(ctx.output, readingOf(ctx).locale).violations
    return result(violations.length === 0, violations)
  },
}

export const glyphsCheck: Check = {
  id: 'glyphs',
  run(ctx) {
    const glyphs = wrongGlyphs(ctx.output, readingOf(ctx).locale)
    return result(glyphs.length === 0, glyphs)
  },
}

export const healthNoticeCheck: Check = {
  id: 'healthNotice',
  run(ctx) {
    const health = readingOf(ctx).definition.healthSection
    if (!health) return result(true, 'not applicable: no health section')
    const body = sectionBody(ctx.output, health.title) ?? ''
    const core = health.notice.replace(/[。.!！\s]+$/u, '')
    return result(body.includes(core))
  },
}

const lengthExpect = z.object({
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive().optional(),
  severity: z.enum(['error', 'warn']).optional(),
})

/** 不计空白的字符数在语言默认区间内；样本可用 `expect.length` 覆盖区间 */
export const lengthCheck: Check = {
  id: 'length',
  severity: 'warn',
  expectSchema: lengthExpect,
  run(ctx) {
    const chars = charCount(ctx.output)
    const combo = comboOf(ctx.sample.input as unknown as ReadingSampleInput)
    const [defaultMin, defaultMax] = COMBO_LENGTH[combo] ??
      DEFAULT_LENGTH[readingOf(ctx).locale] ?? [0, Number.POSITIVE_INFINITY]
    const override = (ctx.expect ?? {}) as { min?: number; max?: number }
    const min = override.min ?? defaultMin
    const max = override.max ?? defaultMax
    return result(chars >= min && chars <= max, { chars, min, max })
  },
}

export const latinCheck: Check = {
  id: 'latin',
  severity: 'warn',
  run(ctx) {
    const latin = latinWords(ctx.output, readingOf(ctx).locale)
    return result(latin.length === 0, latin)
  },
}

export const scriptCheck: Check = {
  id: 'script',
  run(ctx) {
    const locale = readingOf(ctx).locale
    if (!LATIN_LOCALES.has(locale)) return result(true, 'not applicable: non-Latin locale')
    const chars = cjkChars(ctx.output, locale)
    return result(chars.length === 0, chars)
  },
}

// id 与 readings-ja 套件的日语术语检查区分（readings-ja 组合本套件的检查）
export const glossaryCheck: Check = {
  id: 'esGlossary',
  run(ctx) {
    const hits = glossaryHits(ctx.output, readingOf(ctx).locale)
    if (hits === null) return result(true, 'not applicable: no glossary check for this locale')
    return result(hits.length === 0, hits)
  },
}

/** 顺序与旧脚本 `checkReading` 一致；新语言的两项检查追加在末尾 */
export const readingChecks: readonly Check[] = [
  sectionsCheck,
  sectionOrderCheck,
  annualYearsCheck,
  dataConsistencyCheck,
  complianceCheck,
  glyphsCheck,
  healthNoticeCheck,
  lengthCheck,
  latinCheck,
  scriptCheck,
  glossaryCheck,
]

/** warn 级（提示类）检查：评测门槛的「硬性检查」不含它们 */
export const WARN_CHECK_IDS: ReadonlySet<string> = new Set(['length', 'latin'])
