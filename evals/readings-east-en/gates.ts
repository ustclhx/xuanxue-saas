import {
  collect,
  type EvaluateRun,
  type EvaluationResult,
  mean,
  percentile,
  type RunGate,
} from '@xuanxue/evals'
import {
  FLOAT_SLACK,
  JUDGE_DIMENSIONS,
  judgeScore,
  MAX_P95_DURATION_MS,
  MIN_ACCURACY,
  MIN_SAMPLES_PER_COMBO,
  OUTPUT_TOKEN_RATIO,
} from '../readings/gates.ts'
import { READING_MAX_OUTPUT_TOKENS, type ReadingSampleInput } from '../readings/prompts.ts'
import { eastEnChecks } from './checks.ts'
import { CANDIDATE_VERSION, comboOf, EAST_EN_COMBOS } from './prompts.ts'

/**
 * 东方站英文的上线门槛（add-locales-eu-ja design 决策 7：沿用 readings 的门槛，按组合判定）。
 * 解锁入口按「类型 × 语言」开放（apps/web/src/features/readings/catalog.ts READING_EVAL_PENDING），所以门槛逐组合计算，
 * 某组合全部 passed 才可从待评测列表中删除。
 *
 * 英文是新语言，没有同样本的旧版本可作基线，`readings` 的「候选 ≥ 基线 − 0.1」改为与同类型
 * 中文 v4 录制（readings@v4，各 16 个样本，2026-11-16）的评委均值比较：各维度 ≥ 参照 − 0.25。
 * 容差比 0.1 宽，因为两边样本不同、语言不同，评委运行间的波动约 ±0.2；accuracy 另有绝对下限 4.0。
 * 这一口径需使用者确认（PR 中列出）。
 */

/** 同类型中文 v4（zh-Hant + zh-Hans）录制的评委均值 */
export const REFERENCE_MEANS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'bazi-full': {
    accuracy: 4.3125,
    specificity: 4.9375,
    actionability: 4.9375,
    tone: 5,
    readability: 4.75,
  },
  'ziwei-full': {
    accuracy: 4.125,
    specificity: 5,
    actionability: 5,
    tone: 5,
    readability: 4.3125,
  },
}
export const REFERENCE_TOLERANCE = 0.25

const CHECK_IDS = eastEnChecks.map((check) => check.id)

/** 硬性（error 级）检查全部通过为 1，否则 0；检查没有完整运行时为 undefined */
export function hardChecksPassed(result: EvaluationResult): number | undefined {
  const ran = new Set(result.checks.map((check) => check.id))
  if (!CHECK_IDS.every((id) => ran.has(id))) return undefined
  return result.checks.every((check) => check.pass || check.severity === 'warn') ? 1 : 0
}

const missingDetail = (missing: readonly string[]) =>
  `missing ${missing.length}: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`

const round = (value: number) => Math.round(value * 1000) / 1000

export const evaluateEastEn: EvaluateRun = ({ samples, scope, candidate }) => {
  const gates: RunGate[] = []
  const byCombo = new Map<string, string[]>(EAST_EN_COMBOS.map((combo) => [combo, []]))
  for (const sample of samples)
    byCombo.get(comboOf(sample.input as unknown as ReadingSampleInput))?.push(sample.id)

  gates.push({
    id: 'versions',
    status: candidate.promptVersion === CANDIDATE_VERSION ? 'passed' : 'failed',
    detail: `candidate ${candidate.promptVersion} (expected ${CANDIDATE_VERSION}); no baseline: English has no earlier version`,
  })

  for (const combo of EAST_EN_COMBOS) {
    const ids = byCombo.get(combo) ?? []
    const kind = combo.split('.')[0] as string
    const gate = (id: string) => `${combo}.${id}`

    gates.push(
      scope.filtered
        ? {
            id: gate('coverage'),
            status: 'incomplete',
            detail: `filtered run: ${scope.selectedSamples} of ${scope.totalSamples} samples; gates need an unfiltered run`,
          }
        : {
            id: gate('coverage'),
            status: ids.length >= MIN_SAMPLES_PER_COMBO ? 'passed' : 'incomplete',
            detail: `${ids.length} samples (need ≥ ${MIN_SAMPLES_PER_COMBO})`,
          },
    )
    if (ids.length === 0) continue

    const hard = collect(candidate, ids, hardChecksPassed)
    if (hard.missing.length)
      gates.push({
        id: gate('hard-checks'),
        status: 'incomplete',
        detail: missingDetail(hard.missing),
      })
    else {
      const failed = ids.filter((_, i) => hard.values[i] === 0)
      gates.push({
        id: gate('hard-checks'),
        status: failed.length ? 'failed' : 'passed',
        detail: `${ids.length - failed.length}/${ids.length} passed${failed.length ? `; failed: ${failed.join(', ')}` : ''}`,
        metrics: { passed: ids.length - failed.length, expected: ids.length, failed },
      })
    }

    for (const dimension of JUDGE_DIMENSIONS) {
      const scores = collect(candidate, ids, judgeScore(dimension))
      const reference = REFERENCE_MEANS[kind]?.[dimension] as number
      const floor = reference - REFERENCE_TOLERANCE
      if (scores.missing.length) {
        gates.push({
          id: gate(`judge-${dimension}`),
          status: 'incomplete',
          detail: missingDetail(scores.missing),
        })
        continue
      }
      const value = mean(scores.values) as number
      gates.push({
        id: gate(`judge-${dimension}`),
        status: value >= floor - FLOAT_SLACK ? 'passed' : 'failed',
        detail: `${ids.length} samples: ${value.toFixed(3)} (need ≥ ${floor.toFixed(3)} = Chinese v4 ${reference} − ${REFERENCE_TOLERANCE})`,
        metrics: { mean: round(value), reference, floor: round(floor), samples: ids.length },
      })
    }

    const accuracy = collect(candidate, ids, judgeScore('accuracy'))
    const accuracyMean = accuracy.missing.length ? null : (mean(accuracy.values) as number)
    gates.push(
      accuracyMean === null
        ? {
            id: gate('judge-accuracy-min'),
            status: 'incomplete',
            detail: missingDetail(accuracy.missing),
          }
        : {
            id: gate('judge-accuracy-min'),
            status: accuracyMean >= MIN_ACCURACY - FLOAT_SLACK ? 'passed' : 'failed',
            detail: `accuracy mean ${accuracyMean.toFixed(3)} (need ≥ ${MIN_ACCURACY})`,
          },
    )

    const tokenLimit = READING_MAX_OUTPUT_TOKENS * OUTPUT_TOKEN_RATIO
    const tokens = collect(candidate, ids, (r) => r.usage.generation?.outputTokens)
    const p95Tokens = percentile(tokens.values, 95)
    gates.push(
      tokens.missing.length || p95Tokens === null
        ? {
            id: gate('p95-output-tokens'),
            status: 'incomplete',
            detail: missingDetail(tokens.missing),
          }
        : {
            id: gate('p95-output-tokens'),
            status: p95Tokens <= tokenLimit ? 'passed' : 'failed',
            detail: `P95 ${p95Tokens} tokens (limit ${tokenLimit})`,
          },
    )

    const durations = collect(candidate, ids, (r) => r.usage.generation?.durationMs)
    const p95Duration = percentile(durations.values, 95)
    gates.push(
      durations.missing.length || p95Duration === null
        ? {
            id: gate('p95-duration'),
            status: 'incomplete',
            detail: missingDetail(durations.missing),
          }
        : {
            id: gate('p95-duration'),
            status: p95Duration <= MAX_P95_DURATION_MS ? 'passed' : 'failed',
            detail: `P95 ${(p95Duration / 1000).toFixed(1)} s (limit ${MAX_P95_DURATION_MS / 1000} s)`,
          },
    )
  }

  gates.push(
    {
      id: 'human-review',
      status: 'incomplete',
      required: false,
      detail:
        'external evidence: user review of ≥ 2 samples per combo in the private acceptance record; not evaluated here',
    },
    {
      id: 'staging-acceptance',
      status: 'incomplete',
      required: false,
      detail: 'external evidence: staging real-path generation per combo; not evaluated here',
    },
  )
  return { gates }
}
