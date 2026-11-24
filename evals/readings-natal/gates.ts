import {
  collect,
  type EvaluateRun,
  type EvaluationResult,
  percentile,
  type RunGate,
} from '@xuanxue/evals'
import { MAX_P95_DURATION_MS, OUTPUT_TOKEN_RATIO } from '../readings/gates.ts'
import { READING_MAX_OUTPUT_TOKENS } from '../readings/prompts.ts'
import { natalChecks } from './checks.ts'
import { CANDIDATE_VERSION } from './prompts.ts'

/**
 * 出生星盘详批的上线门槛（content-growth-v2-tools 第 23 组；口径同第 14 组与 readings-east-en）：
 * 样本覆盖、硬性检查 100% 通过、P95 输出 token 与时长。评委维度（accuracy ≥ 4 等）不再由模型评委给分，
 * 改由新开的 Claude 子代理按 rubric.ts 复核并记入私有证据目录（使用者 2026-11-22 规则），
 * 因此 `claude-review` 与 `user-review` 在这里始终为 incomplete：复核与使用者审阅通过后，
 * 协调者从 catalog.ts 的 READING_EVAL_PENDING 删去 `natal-full.en` 并在 release.ts 的 NATAL_READING_LOCALES 加入 `en`。
 */
export const MIN_SAMPLES = 6

const CHECK_IDS = natalChecks.map((check) => check.id)

export function hardChecksPassed(result: EvaluationResult): number | undefined {
  const ran = new Set(result.checks.map((check) => check.id))
  if (!CHECK_IDS.every((id) => ran.has(id))) return undefined
  return result.checks.every((check) => check.pass || check.severity === 'warn') ? 1 : 0
}

export const evaluateNatal: EvaluateRun = ({ samples, scope, candidate }) => {
  const ids = samples.map((sample) => sample.id)
  const gates: RunGate[] = [
    {
      id: 'versions',
      status: candidate.promptVersion === CANDIDATE_VERSION ? 'passed' : 'failed',
      detail: `candidate ${candidate.promptVersion} (expected ${CANDIDATE_VERSION})`,
    },
    scope.filtered
      ? {
          id: 'coverage',
          status: 'incomplete',
          detail: `filtered run: ${scope.selectedSamples} of ${scope.totalSamples} samples`,
        }
      : {
          id: 'coverage',
          status: ids.length >= MIN_SAMPLES ? 'passed' : 'incomplete',
          detail: `${ids.length} samples (need ≥ ${MIN_SAMPLES})`,
        },
  ]
  const hard = collect(candidate, ids, hardChecksPassed)
  if (hard.missing.length)
    gates.push({
      id: 'hard-checks',
      status: 'incomplete',
      detail: `missing ${hard.missing.length}: ${hard.missing.join(', ')}`,
    })
  else {
    const failed = ids.filter((_, i) => hard.values[i] === 0)
    gates.push({
      id: 'hard-checks',
      status: failed.length ? 'failed' : 'passed',
      detail: `${ids.length - failed.length}/${ids.length} passed${failed.length ? `; failed: ${failed.join(', ')}` : ''}`,
    })
  }
  const tokenLimit = READING_MAX_OUTPUT_TOKENS * OUTPUT_TOKEN_RATIO
  const tokens = collect(candidate, ids, (r) => r.usage.generation?.outputTokens)
  const p95Tokens = percentile(tokens.values, 95)
  gates.push(
    tokens.missing.length || p95Tokens === null
      ? { id: 'p95-output-tokens', status: 'incomplete', detail: 'no generation usage' }
      : {
          id: 'p95-output-tokens',
          status: p95Tokens <= tokenLimit ? 'passed' : 'failed',
          detail: `P95 ${p95Tokens} tokens (limit ${tokenLimit})`,
        },
  )
  const durations = collect(candidate, ids, (r) => r.usage.generation?.durationMs)
  const p95Duration = percentile(durations.values, 95)
  gates.push(
    durations.missing.length || p95Duration === null
      ? { id: 'p95-duration', status: 'incomplete', detail: 'no generation durations' }
      : {
          id: 'p95-duration',
          status: p95Duration <= MAX_P95_DURATION_MS ? 'passed' : 'failed',
          detail: `P95 ${(p95Duration / 1000).toFixed(1)} s (limit ${MAX_P95_DURATION_MS / 1000} s)`,
        },
    {
      id: 'claude-review',
      status: 'incomplete',
      detail:
        'external evidence: a fresh Claude reviewer scores each sample against rubric.ts (accuracy ≥ 4.0, other dimensions ≥ 4.0) in the private evidence directory',
    },
    {
      id: 'user-review',
      status: 'incomplete',
      detail: 'external evidence: the user approves the samples before the reading is opened',
    },
  )
  return { gates }
}
