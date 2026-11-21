import {
  collect,
  type EvaluateRun,
  type EvaluationGroup,
  type EvaluationResult,
  mean,
  percentile,
  type RunGate,
} from '@xuanxue/evals'
import {
  EFFECTIVE_OUTPUT_LIMIT,
  FLOAT_SLACK,
  JUDGE_DIMENSIONS,
  JUDGE_TOLERANCE,
  judgeScore,
  MAX_P95_DURATION_MS,
  MIN_ACCURACY,
  MIN_SAMPLES_PER_COMBO,
  OUTPUT_TOKEN_RATIO,
} from '../readings/gates.ts'
import {
  comboOf,
  JA_SUITE_VERSION,
  READING_JA_COMBOS,
  type ReadingSampleInput,
} from '../readings/prompts.ts'
import { readingJaChecks } from './checks.ts'

/**
 * 日语详批的上线门槛（openspec add-locales-eu-ja D-10：每个「详批 × 语言」过门槛才显示解锁卡）。
 * 沿用 readings 套件的全部门槛与阈值（evals/readings/gates.ts），差别只有两处：
 * 1. 评委维度「≥ 基线 − 0.1」：日语没有旧版本可作基线，改为对照已上线的 `readings@v4`
 *    （2026-11-16 录制，48 个样本，评委 deepseek-v4-pro）各维度整批均值，容差同为 0.1；
 * 2. 除整批门槛外，另给每个组合一组非必需的分组结果（`combo-<kind>.ja`），
 *    便于在整批未全过时判断哪几个组合可以单独开放；开放仍以整批或使用者确认为准。
 */

/** `readings@v4` 评委录制的各维度均值（evals/readings/recordings/readings@v4，readings-ja.test.ts 按录制复算核对） */
export const REFERENCE_JUDGE_MEANS: Readonly<Record<(typeof JUDGE_DIMENSIONS)[number], number>> = {
  accuracy: 4.3125,
  specificity: 4.979167,
  actionability: 4.979167,
  tone: 5,
  readability: 4.541667,
}
export const REFERENCE_VERSION = 'readings@v4'

const CHECK_IDS = readingJaChecks.map((check) => check.id)

/** 日语检查集中 error 级全部通过为 1；检查没有完整运行时为 undefined */
export function jaHardChecksPassed(result: EvaluationResult): number | undefined {
  const ran = new Set(result.checks.map((check) => check.id))
  if (!CHECK_IDS.every((id) => ran.has(id))) return undefined
  return result.checks.every((check) => check.pass || check.severity === 'warn') ? 1 : 0
}

const round = (value: number) => Math.round(value * 1000) / 1000
const missingDetail = (missing: readonly string[]) =>
  `missing ${missing.length}: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`

function judgeGates(ids: readonly string[], candidate: EvaluationGroup, prefix = ''): RunGate[] {
  const gates: RunGate[] = []
  for (const dimension of JUDGE_DIMENSIONS) {
    const id = `${prefix}judge-${dimension}-vs-reference`
    const now = collect(candidate, ids, judgeScore(dimension))
    if (now.missing.length) {
      gates.push({ id, status: 'incomplete', detail: missingDetail(now.missing) })
      continue
    }
    const value = mean(now.values) as number
    const reference = REFERENCE_JUDGE_MEANS[dimension]
    const delta = value - reference
    gates.push({
      id,
      status: delta >= -JUDGE_TOLERANCE - FLOAT_SLACK ? 'passed' : 'failed',
      detail: `${ids.length} samples: ${value.toFixed(3)} vs ${REFERENCE_VERSION} ${reference.toFixed(3)} (Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}, need ≥ −${JUDGE_TOLERANCE})`,
      metrics: { mean: round(value), reference, delta: round(delta), samples: ids.length },
    })
  }
  const accuracy = collect(candidate, ids, judgeScore('accuracy'))
  const accuracyMean = mean(accuracy.values)
  gates.push(
    accuracy.missing.length || accuracyMean === null
      ? {
          id: `${prefix}judge-accuracy-min`,
          status: 'incomplete',
          detail: missingDetail(accuracy.missing),
        }
      : {
          id: `${prefix}judge-accuracy-min`,
          status: accuracyMean >= MIN_ACCURACY - FLOAT_SLACK ? 'passed' : 'failed',
          detail: `${ids.length} samples: accuracy mean ${accuracyMean.toFixed(3)} (need ≥ ${MIN_ACCURACY})`,
          metrics: { mean: round(accuracyMean), min: MIN_ACCURACY },
        },
  )
  return gates
}

function hardGate(ids: readonly string[], candidate: EvaluationGroup, id: string): RunGate {
  const hard = collect(candidate, ids, jaHardChecksPassed)
  if (hard.missing.length) return { id, status: 'incomplete', detail: missingDetail(hard.missing) }
  const failed = ids.filter((_, i) => hard.values[i] === 0)
  return {
    id,
    status: failed.length ? 'failed' : 'passed',
    detail: `${ids.length - failed.length}/${ids.length} passed${failed.length ? `; failed: ${failed.join(', ')}` : ''}`,
    metrics: { passed: ids.length - failed.length, expected: ids.length, failed },
  }
}

/** 一组门槛的汇总：全部 passed 为 passed，有 failed 为 failed，否则 incomplete */
function summarize(gates: readonly RunGate[]): RunGate['status'] {
  if (gates.some((gate) => gate.status === 'failed')) return 'failed'
  return gates.every((gate) => gate.status === 'passed') ? 'passed' : 'incomplete'
}

export const evaluateReadingsJa: EvaluateRun = ({ samples, scope, candidate }) => {
  const ids = samples.map((sample) => sample.id)
  const byCombo = new Map<string, string[]>(READING_JA_COMBOS.map((combo) => [combo, []]))
  for (const sample of samples)
    byCombo.get(comboOf(sample.input as unknown as ReadingSampleInput))?.push(sample.id)
  const counts = Object.fromEntries([...byCombo].map(([combo, list]) => [combo, list.length]))
  const short = READING_JA_COMBOS.filter(
    (combo) => (byCombo.get(combo)?.length ?? 0) < MIN_SAMPLES_PER_COMBO,
  )
  const gates: RunGate[] = [
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
            : `${READING_JA_COMBOS.length} combos × ≥ ${MIN_SAMPLES_PER_COMBO} samples (${ids.length})`,
          metrics: { counts },
        },
    {
      id: 'versions',
      status: candidate.promptVersion === JA_SUITE_VERSION ? 'passed' : 'failed',
      detail: `candidate ${candidate.promptVersion} (expected ${JA_SUITE_VERSION}; judge compared with ${REFERENCE_VERSION} reference means)`,
    },
    hardGate(ids, candidate, 'hard-checks'),
    ...judgeGates(ids, candidate),
  ]

  const tokenLimit = EFFECTIVE_OUTPUT_LIMIT * OUTPUT_TOKEN_RATIO
  const tokens = collect(candidate, ids, (r) => r.usage.generation?.outputTokens)
  const p95Tokens = percentile(tokens.values, 95)
  gates.push(
    tokens.missing.length || p95Tokens === null
      ? { id: 'p95-output-tokens', status: 'incomplete', detail: missingDetail(tokens.missing) }
      : {
          id: 'p95-output-tokens',
          status: p95Tokens <= tokenLimit ? 'passed' : 'failed',
          detail: `P95 ${p95Tokens} tokens over ${ids.length} (limit ${tokenLimit})`,
          metrics: { p95: p95Tokens, limit: tokenLimit },
        },
  )
  const durations = collect(candidate, ids, (r) => r.usage.generation?.durationMs)
  const p95Duration = percentile(durations.values, 95)
  gates.push(
    durations.missing.length || p95Duration === null
      ? { id: 'p95-duration', status: 'incomplete', detail: missingDetail(durations.missing) }
      : {
          id: 'p95-duration',
          status: p95Duration <= MAX_P95_DURATION_MS ? 'passed' : 'failed',
          detail: `P95 ${(p95Duration / 1000).toFixed(1)} s over ${ids.length} (limit ${MAX_P95_DURATION_MS / 1000} s)`,
          metrics: { p95Ms: p95Duration, limitMs: MAX_P95_DURATION_MS },
        },
  )

  // 分组结果（非必需）：每个组合的样本量、硬性检查与评委门槛
  for (const [combo, list] of byCombo) {
    if (list.length === 0) continue
    const parts = [hardGate(list, candidate, 'hard-checks'), ...judgeGates(list, candidate)]
    const status =
      list.length < MIN_SAMPLES_PER_COMBO || scope.filtered ? 'incomplete' : summarize(parts)
    gates.push({
      id: `combo-${combo}`,
      status,
      required: false,
      detail: parts.map((gate) => `${gate.id}=${gate.status}`).join(', '),
      metrics: Object.fromEntries(parts.map((gate) => [gate.id, gate.metrics ?? gate.detail])),
    })
  }

  gates.push({
    id: 'staging-acceptance',
    status: 'incomplete',
    required: false,
    detail:
      'external evidence: staging real-path generation per ja combo (add-locales-eu-ja tasks 4.11); not evaluated here',
  })
  return { gates }
}
