import {
  collect,
  type EvaluateRun,
  type EvaluationGroup,
  type EvaluationResult,
  mean,
  percentile,
  type RunGate,
} from '@xuanxue/evals'
import { readingChecks } from './checks.ts'
import {
  comboOf,
  READING_COMBOS,
  READING_MAX_OUTPUT_TOKENS,
  type ReadingSampleInput,
} from './prompts.ts'

/**
 * 上线门槛（readings-prompt-v4-yearly design 决策 7，2026-11-15 版）在评测命令中能自动判定的部分。
 * 口径与旧脚本 `summarize` 相同：六个组合合并为一批计算（逐组合判定需使用者另行确认，未采用）；
 * 但缺任何一个样本的值都判 `incomplete`，不在缩小的分母上求均值。
 * 人工审阅与 staging 真实链路是外部证据，这里只列为 incomplete（非必需），从不自动通过。
 */

/** 评委维度（rubric.ts 的 criteria） */
export const JUDGE_DIMENSIONS = [
  'accuracy',
  'specificity',
  'actionability',
  'tone',
  'readability',
] as const

/** 候选各维度均值 ≥ 基线 − 0.1（2026-11-15 使用者决定放宽；评委运行间波动约 ±0.2） */
export const JUDGE_TOLERANCE = 0.1
/** 均值差在浮点下可能出现 -0.10000000000000053，留极小余量 */
export const FLOAT_SLACK = 1e-9
/** 候选「数据准确」均值下限 */
export const MIN_ACCURACY = 4
/**
 * 生效输出上限 = min(READING_MAX_OUTPUT_TOKENS, 模型行 maxOutputTokens)；
 * staging deepseek-flash 模型行为 12000（tasks 4.5 只读确认），故为 12000
 */
export const EFFECTIVE_OUTPUT_LIMIT = READING_MAX_OUTPUT_TOKENS
/** P95 输出 token ≤ 生效上限的 70% */
export const OUTPUT_TOKEN_RATIO = 0.7
/** P95 生成时长 ≤ 240 秒 */
export const MAX_P95_DURATION_MS = 240_000
/** 每个组合至少 8 个样本 */
export const MIN_SAMPLES_PER_COMBO = 8
/** 基线必须是 v4 之前的真实默认版本 */
export const BASELINE_VERSION = 'readings@pre-v4'
export const CANDIDATE_VERSION = 'readings@v4'

const CHECK_IDS = readingChecks.map((check) => check.id)

/** 评委该维度的原始分；评委未成功评分时为 undefined（collect 记为缺口） */
export const judgeScore = (dimension: string) => (result: EvaluationResult) =>
  result.judge?.status === 'scored' ? result.judge.criteria?.[dimension]?.score : undefined

/** 硬性（error 级）检查全部通过为 1，否则 0；检查没有完整运行（如缺生成录制）时为 undefined */
export function hardChecksPassed(result: EvaluationResult): number | undefined {
  const ran = new Set(result.checks.map((check) => check.id))
  if (!CHECK_IDS.every((id) => ran.has(id))) return undefined
  return result.checks.every((check) => check.pass || check.severity === 'warn') ? 1 : 0
}

const missingDetail = (missing: readonly string[]) =>
  `missing ${missing.length}: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`

const round = (value: number) => Math.round(value * 1000) / 1000

function judgeGates(
  ids: readonly string[],
  candidate: EvaluationGroup,
  baseline: EvaluationGroup | null,
): RunGate[] {
  const gates: RunGate[] = []
  for (const dimension of JUDGE_DIMENSIONS) {
    const id = `judge-${dimension}-vs-baseline`
    if (!baseline) {
      gates.push({
        id,
        status: 'incomplete',
        detail: `no baseline; run with --baseline ${BASELINE_VERSION}`,
      })
      continue
    }
    const now = collect(candidate, ids, judgeScore(dimension))
    const before = collect(baseline, ids, judgeScore(dimension))
    if (now.missing.length || before.missing.length) {
      gates.push({
        id,
        status: 'incomplete',
        detail: `candidate ${missingDetail(now.missing)}; baseline ${missingDetail(before.missing)}`,
        metrics: {
          candidateMissing: now.missing,
          baselineMissing: before.missing,
          expected: ids.length,
        },
      })
      continue
    }
    const candidateMean = mean(now.values) as number
    const baselineMean = mean(before.values) as number
    const delta = candidateMean - baselineMean
    gates.push({
      id,
      status: delta >= -JUDGE_TOLERANCE - FLOAT_SLACK ? 'passed' : 'failed',
      detail: `batch of ${ids.length}: ${candidateMean.toFixed(3)} vs ${baselineMean.toFixed(3)} (Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}, need ≥ −${JUDGE_TOLERANCE})`,
      metrics: {
        candidateMean: round(candidateMean),
        baselineMean: round(baselineMean),
        delta: round(delta),
        tolerance: JUDGE_TOLERANCE,
        samples: ids.length,
      },
    })
  }
  const accuracy = collect(candidate, ids, judgeScore('accuracy'))
  if (accuracy.missing.length)
    gates.push({
      id: 'judge-accuracy-min',
      status: 'incomplete',
      detail: missingDetail(accuracy.missing),
      metrics: { missing: accuracy.missing, expected: ids.length },
    })
  else {
    const value = mean(accuracy.values) as number
    gates.push({
      id: 'judge-accuracy-min',
      status: value >= MIN_ACCURACY - FLOAT_SLACK ? 'passed' : 'failed',
      detail: `batch of ${ids.length}: accuracy mean ${value.toFixed(3)} (need ≥ ${MIN_ACCURACY})`,
      metrics: { mean: round(value), min: MIN_ACCURACY, samples: ids.length },
    })
  }
  return gates
}

export const evaluateReadings: EvaluateRun = ({ samples, scope, candidate, baseline }) => {
  const ids = samples.map((sample) => sample.id)
  const gates: RunGate[] = []

  // 样本量：未筛选，且六个组合各 ≥ 8 个样本
  const counts = Object.fromEntries(READING_COMBOS.map((combo) => [combo, 0]))
  for (const sample of samples) {
    const combo = comboOf(sample.input as unknown as ReadingSampleInput)
    counts[combo] = (counts[combo] ?? 0) + 1
  }
  const short = READING_COMBOS.filter((combo) => (counts[combo] ?? 0) < MIN_SAMPLES_PER_COMBO)
  gates.push(
    scope.filtered
      ? {
          id: 'coverage',
          status: 'incomplete',
          detail: `filtered run: ${scope.selectedSamples} of ${scope.totalSamples} samples; full-batch gates need an unfiltered run`,
          metrics: { counts },
        }
      : {
          id: 'coverage',
          status: short.length ? 'incomplete' : 'passed',
          detail: short.length
            ? `fewer than ${MIN_SAMPLES_PER_COMBO} samples: ${short.join(', ')}`
            : `${READING_COMBOS.length} combos × ≥ ${MIN_SAMPLES_PER_COMBO} samples (${ids.length})`,
          metrics: { counts },
        },
  )

  // 版本：候选为 v4、基线为 v4 之前的真实默认版本
  gates.push({
    id: 'versions',
    status:
      candidate.promptVersion !== CANDIDATE_VERSION
        ? 'failed'
        : baseline?.promptVersion === BASELINE_VERSION
          ? 'passed'
          : 'incomplete',
    detail: `candidate ${candidate.promptVersion}, baseline ${baseline?.promptVersion ?? 'none'} (expected ${CANDIDATE_VERSION} vs ${BASELINE_VERSION})`,
  })

  // 候选硬性检查 100% 通过
  const hard = collect(candidate, ids, hardChecksPassed)
  if (hard.missing.length)
    gates.push({
      id: 'hard-checks',
      status: 'incomplete',
      detail: missingDetail(hard.missing),
      metrics: { missing: hard.missing, expected: ids.length },
    })
  else {
    const failedIds = ids.filter((_, i) => hard.values[i] === 0)
    gates.push({
      id: 'hard-checks',
      status: failedIds.length ? 'failed' : 'passed',
      detail: `${ids.length - failedIds.length}/${ids.length} passed${failedIds.length ? `; failed: ${failedIds.join(', ')}` : ''}`,
      metrics: { passed: ids.length - failedIds.length, expected: ids.length, failed: failedIds },
    })
  }

  gates.push(...judgeGates(ids, candidate, baseline))

  // P95 输出 token ≤ 生效上限 × 70%
  const tokenLimit = EFFECTIVE_OUTPUT_LIMIT * OUTPUT_TOKEN_RATIO
  const tokens = collect(candidate, ids, (r) => r.usage.generation?.outputTokens)
  const p95Tokens = percentile(tokens.values, 95)
  gates.push(
    tokens.missing.length || p95Tokens === null
      ? {
          id: 'p95-output-tokens',
          status: 'incomplete',
          detail: missingDetail(tokens.missing),
          metrics: { missing: tokens.missing, expected: ids.length },
        }
      : {
          id: 'p95-output-tokens',
          status: p95Tokens <= tokenLimit ? 'passed' : 'failed',
          detail: `P95 ${p95Tokens} tokens over ${ids.length} (limit ${EFFECTIVE_OUTPUT_LIMIT} × ${OUTPUT_TOKEN_RATIO} = ${tokenLimit})`,
          metrics: { p95: p95Tokens, limit: tokenLimit, samples: ids.length },
        },
  )

  // P95 生成时长 ≤ 240 秒（录制缺 durationMs 时 incomplete，不用回放耗时代替）
  const durations = collect(candidate, ids, (r) => r.usage.generation?.durationMs)
  const p95Duration = percentile(durations.values, 95)
  gates.push(
    durations.missing.length || p95Duration === null
      ? {
          id: 'p95-duration',
          status: 'incomplete',
          detail: missingDetail(durations.missing),
          metrics: { missing: durations.missing, expected: ids.length },
        }
      : {
          id: 'p95-duration',
          status: p95Duration <= MAX_P95_DURATION_MS ? 'passed' : 'failed',
          detail: `P95 ${(p95Duration / 1000).toFixed(1)} s over ${ids.length} (limit ${MAX_P95_DURATION_MS / 1000} s)`,
          metrics: { p95Ms: p95Duration, limitMs: MAX_P95_DURATION_MS, samples: ids.length },
        },
  )

  // 外部证据：评测命令不判定，只提示；非必需，不影响退出码
  gates.push(
    {
      id: 'human-review',
      status: 'incomplete',
      required: false,
      detail:
        'external evidence: user review of ≥ 2 v4 samples per combo, recorded in the private acceptance record (tasks 4.4); not evaluated here',
    },
    {
      id: 'staging-acceptance',
      status: 'incomplete',
      required: false,
      detail:
        'external evidence: staging real-path generation per combo (tasks 4.5); not evaluated here',
    },
  )
  return { gates }
}
