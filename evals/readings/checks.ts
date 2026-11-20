import { type Check, type CheckContext, type CheckResult, z } from '@xuanxue/evals'
import { missingSections, sectionTitles } from '../../apps/web/src/features/readings/catalog.ts'
import { checkCompliance } from '../../apps/web/src/features/readings/compliance.ts'
import { HANT_PAIRS } from '../../apps/web/src/features/readings/hant-chars.ts'
import { type ReadingSampleInput, type ResolvedReading, resolveReading } from './prompts.ts'

/**
 * 确定性检查（spec「确定性检查」），自 apps/web/scripts/eval-readings/checks.ts 迁移，判定逻辑不变：
 * 硬性检查（章节、章节顺序、流年年份、数据一致、合规、字形、就医提示）为 error 级；
 * 长度与夹杂拉丁字母只作提示，保持 warn 级，不提升为硬性失败。
 * 被评正文已经过 prepare.ts（与线上保存的正文相同），这里不再做字形补正。
 */

/** v4 各详批的逐年章节标题；v1–v3 没有该章，年份检查只在定义包含该章时进行 */
export const ANNUAL_SECTION_TITLES = [
  '流年逐年',
  '연도별 세운',
  '大限與流年',
  '大限与流年',
  'Year by Year',
  // 东方站英文紫微（readings-east-en）
  'Major Period and Year by Year',
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

export const DEFAULT_LENGTH: Readonly<Record<string, readonly [number, number]>> = {
  'zh-Hant': [2000, 12000],
  'zh-Hans': [2000, 12000],
  ko: [2500, 15000],
  en: [8000, 40000],
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

/** 套件版本 + 样本 → 真实版本与复算结果；各套件按自己的版本分派（本套件为 prompts.ts `resolveReading`） */
export type ResolveReading = (promptVersion: string, input: ReadingSampleInput) => ResolvedReading

type SampleReading = ResolvedReading & { readonly locale: string }

/** 同一次运行中，一个样本的多项检查共用同一份复算结果 */
function sampleReadings(resolve: ResolveReading): (ctx: CheckContext) => SampleReading {
  const resolved = new WeakMap<object, Map<string, ResolvedReading>>()
  return (ctx) => {
    const input = ctx.sample.input as unknown as ReadingSampleInput
    const byVersion = resolved.get(ctx.sample) ?? new Map<string, ResolvedReading>()
    resolved.set(ctx.sample, byVersion)
    let reading = byVersion.get(ctx.prompt.promptVersion)
    if (!reading) {
      reading = resolve(ctx.prompt.promptVersion, input)
      byVersion.set(ctx.prompt.promptVersion, reading)
    }
    return { ...reading, locale: input.locale }
  }
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

const lengthExpect = z.object({
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive().optional(),
  severity: z.enum(['error', 'warn']).optional(),
})

/** 按套件的版本分派函数构造全部检查；顺序与旧脚本 `checkReading` 一致 */
export function createReadingChecks(resolve: ResolveReading): readonly Check[] {
  const readingOf = sampleReadings(resolve)

  const sectionsCheck: Check = {
    id: 'sections',
    run(ctx) {
      const missing = missingSections(ctx.output, readingOf(ctx).definition.prompt.sections)
      return result(missing.length === 0, { missing })
    },
  }

  const sectionOrderCheck: Check = {
    id: 'sectionOrder',
    run: (ctx) => result(sectionsInOrder(ctx.output, readingOf(ctx).definition.prompt.sections)),
  }

  const annualYearsCheck: Check = {
    id: 'annualYears',
    run(ctx) {
      const reading = readingOf(ctx)
      const title = annualTitle(reading)
      if (!title) return result(true, NOT_APPLICABLE)
      const years = expectedYears(reading.recomputed.result)
      const y = checkYears(sectionBody(ctx.output, title) ?? '', years, reading.locale)
      return result(
        years.length > 0 && y.missing.length === 0 && y.extra.length === 0 && y.ordered,
        {
          missing: y.missing,
          extra: y.extra,
          ordered: y.ordered,
        },
      )
    },
  }

  const dataConsistencyCheck: Check = {
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

  const complianceCheck: Check = {
    id: 'compliance',
    run(ctx) {
      const violations = checkCompliance(ctx.output, readingOf(ctx).locale).violations
      return result(violations.length === 0, violations)
    },
  }

  const glyphsCheck: Check = {
    id: 'glyphs',
    run(ctx) {
      const glyphs = wrongGlyphs(ctx.output, readingOf(ctx).locale)
      return result(glyphs.length === 0, glyphs)
    },
  }

  const healthNoticeCheck: Check = {
    id: 'healthNotice',
    run(ctx) {
      const health = readingOf(ctx).definition.healthSection
      if (!health) return result(true, 'not applicable: no health section')
      const body = sectionBody(ctx.output, health.title) ?? ''
      const core = health.notice.replace(/[。.!！\s]+$/u, '')
      return result(body.includes(core))
    },
  }

  /** 不计空白的字符数在语言默认区间内；样本可用 `expect.length` 覆盖区间 */
  const lengthCheck: Check = {
    id: 'length',
    severity: 'warn',
    expectSchema: lengthExpect,
    run(ctx) {
      const chars = charCount(ctx.output)
      const [defaultMin, defaultMax] = DEFAULT_LENGTH[readingOf(ctx).locale] ?? [
        0,
        Number.POSITIVE_INFINITY,
      ]
      const override = (ctx.expect ?? {}) as { min?: number; max?: number }
      const min = override.min ?? defaultMin
      const max = override.max ?? defaultMax
      return result(chars >= min && chars <= max, { chars, min, max })
    },
  }

  const latinCheck: Check = {
    id: 'latin',
    severity: 'warn',
    run(ctx) {
      const latin = latinWords(ctx.output, readingOf(ctx).locale)
      return result(latin.length === 0, latin)
    },
  }

  return [
    sectionsCheck,
    sectionOrderCheck,
    annualYearsCheck,
    dataConsistencyCheck,
    complianceCheck,
    glyphsCheck,
    healthNoticeCheck,
    lengthCheck,
    latinCheck,
  ]
}

export const readingChecks: readonly Check[] = createReadingChecks(resolveReading)

/** warn 级（提示类）检查：评测门槛的「硬性检查」不含它们 */
export const WARN_CHECK_IDS: ReadonlySet<string> = new Set(['length', 'latin'])
