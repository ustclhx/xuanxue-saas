import type { CheckReport } from './checks.ts'
import { JUDGE_DIMENSIONS, type JudgeScore } from './judge.ts'

/** 单个样本在某个版本下的评测结果 */
export interface SampleOutcome {
  readonly sampleId: string
  readonly kind: string
  readonly locale: string
  /** 实际使用的提示词版本（default 已展开） */
  readonly version: string
  readonly role: 'baseline' | 'candidate'
  /** skipped：缺录制、版本未注册或预算用尽 */
  readonly status: 'checked' | 'skipped'
  readonly skipReason?: string
  readonly report?: CheckReport
  readonly outputTokens?: number | null
  readonly durationMs?: number | null
  readonly judge?: JudgeScore | null
}

/** 最近秩法分位数；空数组返回 null */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[rank - 1] as number
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length

export interface RoleSummary {
  readonly checked: number
  readonly skipped: number
  readonly passed: number
  readonly passRate: number | null
  /** 各硬性 / 提示检查的失败次数 */
  readonly failures: Record<string, number>
  readonly judge: Record<string, number | null>
  readonly outputTokens: { readonly p50: number | null; readonly p95: number | null }
  readonly durationMs: { readonly p50: number | null; readonly p95: number | null }
}

export function summarizeRole(outcomes: readonly SampleOutcome[]): RoleSummary {
  const checked = outcomes.filter((o) => o.status === 'checked' && o.report)
  const passed = checked.filter((o) => o.report?.passed).length
  const failures: Record<string, number> = {}
  for (const outcome of checked)
    for (const check of outcome.report?.checks ?? [])
      if (!check.passed) failures[check.name] = (failures[check.name] ?? 0) + 1
  const judged = checked.flatMap((o) => (o.judge ? [o.judge] : []))
  const judge = Object.fromEntries(
    JUDGE_DIMENSIONS.map((d) => [d, mean(judged.map((j) => j.scores[d]))]),
  )
  const numbers = (key: 'outputTokens' | 'durationMs') =>
    checked.flatMap((o) => (typeof o[key] === 'number' ? [o[key] as number] : []))
  const tokens = numbers('outputTokens')
  const durations = numbers('durationMs')
  return {
    checked: checked.length,
    skipped: outcomes.length - checked.length,
    passed,
    passRate: checked.length === 0 ? null : passed / checked.length,
    failures,
    judge,
    outputTokens: { p50: percentile(tokens, 50), p95: percentile(tokens, 95) },
    durationMs: { p50: percentile(durations, 50), p95: percentile(durations, 95) },
  }
}

export interface EvalSummary {
  readonly baseline: RoleSummary
  readonly candidate: RoleSummary | null
  /** 候选减基线的评委维度均值差；任一方缺分时为 null */
  readonly judgeDelta: Record<string, number | null>
}

export function summarize(outcomes: readonly SampleOutcome[]): EvalSummary {
  const baseline = summarizeRole(outcomes.filter((o) => o.role === 'baseline'))
  const candidateOutcomes = outcomes.filter((o) => o.role === 'candidate')
  const candidate = candidateOutcomes.length ? summarizeRole(candidateOutcomes) : null
  const judgeDelta = Object.fromEntries(
    JUDGE_DIMENSIONS.map((d) => {
      const a = baseline.judge[d]
      const b = candidate?.judge[d]
      return [d, a == null || b == null ? null : b - a]
    }),
  )
  return { baseline, candidate, judgeDelta }
}

const fmt = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(digits)
const pct = (value: number | null) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`)

function roleRows(label: string, s: RoleSummary): string {
  return `| ${label} | ${s.checked} | ${s.skipped} | ${pct(s.passRate)} | ${fmt(s.outputTokens.p50)} / ${fmt(s.outputTokens.p95)} | ${fmt(s.durationMs.p50 == null ? null : s.durationMs.p50 / 1000, 1)} / ${fmt(s.durationMs.p95 == null ? null : s.durationMs.p95 / 1000, 1)} |`
}

/** summary.md：通过率、检查失败分布、评委维度均值与差值、逐样本明细 */
export function renderSummary(
  meta: { readonly mode: string; readonly baseline: string; readonly candidate: string | null },
  outcomes: readonly SampleOutcome[],
  notes: readonly string[] = [],
): string {
  const s = summarize(outcomes)
  const lines = [
    '# 详批提示词评测',
    '',
    `- 模式：${meta.mode}`,
    `- 基线：${meta.baseline}；候选：${meta.candidate ?? '（无）'}`,
    '- 门槛见 openspec/changes/readings-prompt-v4-yearly/design.md 决策 7',
    '',
    '## 汇总',
    '',
    '| 版本 | 已检查 | 跳过 | 硬性检查通过率 | 输出 token P50 / P95 | 时长秒 P50 / P95 |',
    '|---|---|---|---|---|---|',
    roleRows('基线', s.baseline),
    ...(s.candidate ? [roleRows('候选', s.candidate)] : []),
    '',
    '## 检查失败次数',
    '',
    `- 基线：${JSON.stringify(s.baseline.failures)}`,
    ...(s.candidate ? [`- 候选：${JSON.stringify(s.candidate.failures)}`] : []),
    '',
    '## 评委维度均值',
    '',
    '| 维度 | 基线 | 候选 | 差值 |',
    '|---|---|---|---|',
    ...Object.keys(s.judgeDelta).map(
      (d) =>
        `| ${d} | ${fmt(s.baseline.judge[d])} | ${fmt(s.candidate?.judge[d])} | ${fmt(s.judgeDelta[d])} |`,
    ),
    '',
    '## 逐样本',
    '',
    '| 样本 | 角色 | 版本 | 结果 | 字数 | 失败的检查 | 评委 |',
    '|---|---|---|---|---|---|---|',
    ...outcomes.map((o) => {
      const result =
        o.status === 'skipped' ? `跳过：${o.skipReason ?? ''}` : o.report?.passed ? '通过' : '失败'
      const failed = (o.report?.checks ?? [])
        .filter((c) => !c.passed)
        .map((c) => (c.hard ? c.name : `${c.name}(提示)`))
        .join(', ')
      const judge = o.judge ? JUDGE_DIMENSIONS.map((d) => o.judge?.scores[d]).join('/') : '—'
      return `| ${o.sampleId} | ${o.role} | ${o.version} | ${result} | ${o.report?.chars ?? '—'} | ${failed || '—'} | ${judge} |`
    }),
  ]
  if (notes.length) lines.push('', '## 说明', '', ...notes.map((note) => `- ${note}`))
  return `${lines.join('\n')}\n`
}
