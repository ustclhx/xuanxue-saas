import type { Check, CheckResult } from '@xuanxue/evals'
import { withDisclaimer } from '../../apps/web/src/features/readings/catalog.ts'
import { natalChartWithSummary } from '../../apps/web/src/features/readings/natal-chart.ts'
import { createReadingChecks } from '../readings/checks.ts'
import type { ReadingSampleInput } from '../readings/prompts.ts'
import { CANDIDATE_VERSION, resolveReading } from './prompts.ts'

/**
 * 出生星盘详批的确定性检查：`readings` 的通用检查（章节、顺序、合规替换、长度、拉丁语言无汉字）
 * 加星盘专属检查。判定词与预测类措辞列为失败项（design 决策 14、17）。
 * - `wording`：交付正文（加上声明后）含「传统占星 / 仅供参考与自我反思 / 不预测未来」；模型原文不提 AI、不用娱乐定位。
 * - `placements`：正文写出的「行星 in 星座」「行星 in the Nth house」与复算数据一致（无时间态跨座的点两个星座都算对）。
 * - `rising`：有时间时写出的上升星座与数据一致；无时间时不得写出上升星座。
 * - `verdicts`：不出现关系判定与命定类措辞。
 * - `extraPoints`：不出现数据之外的点（凯龙、莉莉丝、福点、小行星等）。
 * - `chartSummary`：宫位、元素和模式的汇总逐行照抄，不在解读中重新统计。
 */

type Point = { point: string; sign: string; house: string | null }
type NatalData = {
  birthTimeKnown: boolean
  bigThree: { sun: string; moon: string; rising: string | null }
  points: Point[]
}

const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]
const SIGN = `(${SIGNS.join('|')})`
const ORDINAL = '(\\d{1,2}(?:st|nd|rd|th))'

export const REQUIRED_WORDING: Readonly<Record<string, readonly RegExp[]>> = {
  'traditional-astrology': [/traditional (?:Western )?astrology/i],
  'reference-only': [/for reference and self-reflection/i],
  'no-prediction': [/do(?:es)? not predict the future/i],
}

export const BANNED_WORDING: readonly RegExp[] = [
  /\bAI\b/,
  /\bartificial intelligence\b/i,
  /\bentertainment\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\balways accurate\b/i,
]

export const VERDICT_WORDING: readonly RegExp[] = [
  /\bsoul ?mates?\b/i,
  /\b(?:should|must) (?:not|never) marry\b/i,
  /\bwill (?:divorce|break up|separate)\b/i,
  /\b(?:doomed|destined to|fated to|meant to be)\b/i,
  /\b(?:perfect|ideal|worst|bad) match\b/i,
]

export const EXTRA_POINTS =
  /\b(?:Chiron|Lilith|Part of Fortune|asteroids?|Vertex|Juno|Ceres|Pallas|Vesta|South Node|True Node|quincunx|semi-?sextile|sesquiquadrate)\b/i

const dataOf = (input: ReadingSampleInput) => input.data as unknown as NatalData

/** 星座文字（可能是「X or Y」）允许的星座 */
const allowed = (text: string) => new Set(text.split(' or '))

/** 正文中「Planet in Sign」「Planet in the Nth house」与数据不符之处 */
export function placementIssues(output: string, data: NatalData) {
  const issues: string[] = []
  for (const point of data.points) {
    const name = point.point.replace(' ', '\\s+')
    const signs = allowed(point.sign)
    for (const match of output.matchAll(
      new RegExp(`\\b${name}\\s+(?:is\\s+|sits\\s+|falls\\s+|placed\\s+)?in\\s+${SIGN}\\b`, 'g'),
    )) {
      if (!signs.has(match[1] as string))
        issues.push(`${point.point} in ${match[1]} (data: ${point.sign})`)
    }
    for (const match of output.matchAll(
      new RegExp(
        `\\b${name}\\s+(?:in\\s+${SIGN}\\s+)?(?:is\\s+|sits\\s+|falls\\s+)?in\\s+(?:your\\s+|the\\s+)?${ORDINAL}\\s+house\\b`,
        'g',
      ),
    )) {
      const house = match[2] as string
      if (point.house === null)
        issues.push(`${point.point} in the ${house} house (data: no houses)`)
      else if (point.house !== house)
        issues.push(`${point.point} in the ${house} house (data: ${point.house})`)
    }
  }
  return issues
}

/** 上升星座的写法：Sign rising、Sign Ascendant、Ascendant/rising sign in|is Sign */
export function risingClaims(output: string): string[] {
  const claims = new Set<string>()
  for (const re of [
    new RegExp(`\\b${SIGN}\\s+(?:rising|rises|Ascendant)\\b`, 'g'),
    new RegExp(
      `\\b(?:Ascendant|rising sign)\\s+(?:is\\s+|in\\s+|of\\s+)(?:in\\s+)?${SIGN}\\b`,
      'g',
    ),
  ])
    for (const match of output.matchAll(re)) claims.add(match[1] as string)
  return [...claims]
}

const result = (pass: boolean, detail?: unknown): CheckResult =>
  detail === undefined ? { pass } : { pass, detail: JSON.stringify(detail) }

const inputOf = (sample: { input: unknown }) => sample.input as ReadingSampleInput

export const wordingCheck: Check = {
  id: 'wording',
  run(ctx) {
    const { definition } = resolveReading(ctx.prompt.promptVersion, inputOf(ctx.sample))
    const delivered = withDisclaimer(ctx.output, definition)
    const missing = Object.entries(REQUIRED_WORDING)
      .filter(([, patterns]) => !patterns.some((pattern) => pattern.test(delivered)))
      .map(([id]) => id)
    const banned = BANNED_WORDING.filter((pattern) => pattern.test(ctx.output)).map((p) => p.source)
    return result(missing.length === 0 && banned.length === 0, { missing, banned })
  },
}

export const placementsCheck: Check = {
  id: 'placements',
  run(ctx) {
    const issues = placementIssues(ctx.output, dataOf(inputOf(ctx.sample)))
    return result(issues.length === 0, issues)
  },
}

export const risingCheck: Check = {
  id: 'rising',
  run(ctx) {
    const data = dataOf(inputOf(ctx.sample))
    const claims = risingClaims(ctx.output)
    const expected = data.bigThree.rising
    const wrong = expected ? claims.filter((sign) => sign !== expected) : claims
    return result(wrong.length === 0, { expected, claims })
  },
}

export const verdictsCheck: Check = {
  id: 'verdicts',
  run(ctx) {
    const hits = VERDICT_WORDING.flatMap((re) => ctx.output.match(re)?.[0] ?? [])
    return result(hits.length === 0, hits)
  },
}

export const extraPointsCheck: Check = {
  id: 'extraPoints',
  run(ctx) {
    const hits = [...new Set(ctx.output.match(new RegExp(EXTRA_POINTS, 'gi')) ?? [])]
    return result(hits.length === 0, hits)
  },
}

const SUMMARY_LINE = /^- (?:Planets by house|Elements|Modalities|Counted planets):/
// 解释传统含义可以自由行文，汇总数字与成员只出现在可逐行核对的清单。
const HOUSE_AGGREGATE =
  /\b(?:busiest houses?|single planets?|(?:holds?|holding|contains?|containing|with) (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten) planets?)\b/i
const GROUP = '(?:fire|earth|air|water|cardinal|fixed|mutable)'
const GROUP_AGGREGATE = new RegExp(
  `\\b(?:dominant (?:element|modality)|${GROUP} (?:appears|occurs) (?:once|twice|through)|${GROUP} (?:\\d+|\\(\\d+)|${GROUP} (?:includes?|contains?|comprises?|consists of))\\b`,
  'i',
)

export const chartSummaryCheck: Check = {
  id: 'chartSummary',
  run(ctx) {
    if (ctx.prompt.promptVersion !== CANDIDATE_VERSION) return result(true)
    const restated = ctx.output
      .split('\n')
      .filter((line) => !SUMMARY_LINE.test(line))
      .flatMap((line) =>
        [HOUSE_AGGREGATE, GROUP_AGGREGATE].flatMap((pattern) => line.match(pattern)?.[0] ?? []),
      )
    const { recomputed } = resolveReading(ctx.prompt.promptVersion, inputOf(ctx.sample))
    const expected = natalChartWithSummary(recomputed.result).summaryLines
    const lines = ctx.output.split(/\r?\n/)
    const actual = lines.filter((line) => SUMMARY_LINE.test(line))
    const start = lines.indexOf('## Houses and Emphasis') + 2
    const exact =
      actual.length === expected.length &&
      expected.every((line, i) => line === actual[i] && line === lines[start + i])
    return result(exact && restated.length === 0, { exact, restated })
  },
}

export const natalChecks: readonly Check[] = [
  ...createReadingChecks(resolveReading),
  wordingCheck,
  placementsCheck,
  risingCheck,
  verdictsCheck,
  extraPointsCheck,
  chartSummaryCheck,
]

export const NATAL_WARN_CHECK_IDS: ReadonlySet<string> = new Set(
  natalChecks.filter((check) => check.severity === 'warn').map((check) => check.id),
)
