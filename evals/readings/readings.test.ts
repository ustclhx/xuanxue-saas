import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type {
  CheckContext,
  EvaluateRunContext,
  EvaluationGroup,
  EvaluationResult,
  RunGate,
  Sample,
} from '@xuanxue/evals'
import {
  readingDefinition,
  recomputeReading,
} from '../../apps/web/src/features/readings/catalog.ts'
import { readingGuardYears } from '../../apps/web/src/features/readings/guard.ts'
import {
  bodyGanzhiMismatches,
  checkYears,
  expectedYears,
  latinWords,
  readingChecks,
  wrongGlyphs,
} from './checks.ts'
import { evaluateReadings, JUDGE_DIMENSIONS } from './gates.ts'
import { prepareReading } from './prepare.ts'
import {
  PRE_V4_VERSIONS,
  READING_COMBOS,
  READING_MAX_OUTPUT_TOKENS,
  type ReadingSampleInput,
  realVersion,
  renderReading,
} from './prompts.ts'

// readings 套件的离线单测（readings-prompt-v4-yearly tasks 4.7）：`pnpm test:evals`，不发起模型调用

const DIR = import.meta.dirname
const ROOT = join(DIR, '../..')
const samples = JSON.parse(readFileSync(join(DIR, 'samples.json'), 'utf8')) as (Sample & {
  input: ReadingSampleInput
})[]
const byId = new Map(samples.map((sample) => [sample.id, sample]))
const sample = (id: string) => byId.get(id) as Sample & { input: ReadingSampleInput }

/** 迁移的生成录制（模型原文） */
const recording = (promptVersion: string, id: string) =>
  JSON.parse(
    readFileSync(join(DIR, 'recordings', promptVersion, 'deepseek-flash', `${id}.json`), 'utf8'),
  ) as { output: string; renderedHash: string; durationMs?: number; source: string }

/** 某版本、某样本的被评正文上运行全部检查 */
async function runAll(promptVersion: string, id: string, output: string) {
  const s = sample(id)
  const prompt = { promptVersion } as CheckContext['prompt']
  const outcomes = []
  for (const check of readingChecks) {
    const r = await check.run({ output, sample: s, prompt, expect: undefined })
    outcomes.push({
      id: check.id,
      pass: r.pass,
      severity: check.severity ?? 'error',
      detail: r.detail,
    })
  }
  return outcomes
}

/** 只关心 `subset` 的每个叶子在 `superset` 中同值 */
function assertDeepSubset(subset: unknown, superset: unknown, path = '$') {
  if (subset === null || typeof subset !== 'object') {
    assert.deepEqual(superset, subset, path)
    return
  }
  assert.ok(superset !== null && typeof superset === 'object', `${path} missing`)
  if (Array.isArray(subset)) {
    assert.ok(Array.isArray(superset), `${path} not an array`)
    assert.equal((superset as unknown[]).length, subset.length, `${path} length`)
  }
  for (const [key, value] of Object.entries(subset))
    assertDeepSubset(value, (superset as Record<string, unknown>)[key], `${path}.${key}`)
}

describe('样本与提示词', () => {
  it('六个组合各 8 个样本，样本 ID 唯一', () => {
    assert.equal(samples.length, 48)
    for (const combo of READING_COMBOS)
      assert.equal(
        samples.filter((s) => `${s.input.kind}.${s.input.locale}` === combo).length,
        8,
        combo,
      )
  })

  it('pre-v4 的真实版本就是代码默认版本，v4 均已注册；输出上限与 generate.ts 一致', () => {
    for (const combo of READING_COMBOS) {
      const [kind, locale] = combo.split('.') as [string, string]
      assert.equal(readingDefinition(kind, locale)?.prompt.version, PRE_V4_VERSIONS[combo])
      assert.ok(readingDefinition(kind, locale, { promptVersion: `${kind}.v4` }))
    }
    const source = readFileSync(join(ROOT, 'apps/web/src/features/readings/generate.ts'), 'utf8')
    assert.match(source, new RegExp(`READING_MAX_OUTPUT_TOKENS = ${READING_MAX_OUTPUT_TOKENS}\\b`))
  })

  it('评委用的 data 与 v4 数据档复算一致，旧数据档被 data + preV4Fields 覆盖；生成消息现场复算', () => {
    for (const s of samples) {
      const { kind, locale, request, requestDate, data } = s.input
      const now = new Date(requestDate)
      const annual = recomputeReading(kind, request, now, { locale, profile: 'annual' })
      assert.deepEqual(data, annual.result, s.id)
      const base = recomputeReading(kind, request, now, { locale, profile: 'base' })
      assertDeepSubset(base.result, { ...data, ...s.input.preV4Fields }, s.id)
      assert.equal(
        renderReading('readings@v4', s.input).user,
        JSON.stringify({ kind, chart: annual.result }),
      )
      assert.equal(
        renderReading('readings@pre-v4', s.input).user,
        JSON.stringify({ kind, chart: base.result }),
      )
    }
  })

  it('套件版本按组合分派到真实版本，不把 v2 记成 v3', () => {
    assert.equal(realVersion('readings@pre-v4', sample('bazi-hant-01').input), 'bazi-full.v2')
    assert.equal(realVersion('readings@pre-v4', sample('bazi-hans-01').input), 'bazi-full.v3')
    assert.equal(realVersion('readings@pre-v4', sample('saju-ko-01').input), 'saju-full.v2')
    assert.equal(realVersion('readings@v4', sample('numerology-en-01').input), 'numerology-full.v4')
    assert.throws(() => realVersion('readings@v5', sample('saju-ko-01').input))
  })
})

describe('迁移的生成录制', () => {
  it('两个版本各 48 份，来源为真实录制，带可追溯的 durationMs，渲染摘要与版本锁一致', () => {
    const lock = JSON.parse(readFileSync(join(DIR, 'prompts.lock.json'), 'utf8'))
    for (const version of ['readings@v4', 'readings@pre-v4']) {
      const files = readdirSync(join(DIR, 'recordings', version, 'deepseek-flash'))
      assert.equal(files.filter((f) => !f.includes('.judge.')).length, 48, version)
      for (const s of samples) {
        const r = recording(version, s.id)
        assert.equal(r.source, 'recorded')
        assert.ok(Number.isInteger(r.durationMs), `${version} ${s.id} durationMs`)
        assert.equal(r.renderedHash, lock[version][s.id].rendered)
      }
    }
  })
})

describe('被评正文转换', () => {
  it('线上兜底按公历年推算的期望年份与复算数据（八字 annual、紫微 horoscope、个人年）逐样本一致', () => {
    for (const s of samples) {
      const { kind, locale, request, requestDate } = s.input
      const now = new Date(requestDate)
      const recomputed = recomputeReading(kind, request, now, { locale, profile: 'annual' })
      const fromData = expectedYears(recomputed.result)
      assert.equal(fromData.length, 5, s.id)
      assert.deepEqual(
        readingGuardYears(kind, now.getUTCFullYear(), recomputed.input),
        fromData,
        s.id,
      )
    }
  })

  it('v4 简中：繁体字换成简体、年份标题干支按数据改正；结果可重复', () => {
    const raw = '## 流年逐年\n\n### 2026 丙午\n\n變化。\n\n### 2027 丁酉\n\n平穩。'
    const input = sample('bazi-hans-01').input
    const first = prepareReading(raw, 'readings@v4', input)
    assert.deepEqual(first, prepareReading(raw, 'readings@v4', input))
    assert.match(first.output, /### 2027 丁未/)
    assert.match(first.output, /变化/)
    assert.equal(first.annotations?.promptVersion, 'bazi-full.v4')
    assert.equal(first.annotations?.requestYear, 2026)
    assert.ok((first.annotations?.glyphs as number) >= 1)
    assert.equal(first.annotations?.ganzhi, 1)
  })

  it('pre-v4 不做 v4 兜底，繁中只做字形补正并计数', () => {
    const hans = prepareReading(
      '### 2027 丁酉 变化',
      'readings@pre-v4',
      sample('bazi-hans-01').input,
    )
    assert.equal(hans.output, '### 2027 丁酉 变化')
    assert.equal(hans.annotations?.promptVersion, 'bazi-full.v3')
    const hant = prepareReading('变化', 'readings@pre-v4', sample('bazi-hant-01').input)
    assert.equal(hant.output, '變化')
    assert.equal(hant.annotations?.hantGlyphs, 1)
  })

  it('窗口起点取样本请求年份，而非当前时间', () => {
    const input = { ...sample('numerology-en-01').input, requestDate: '2031-03-01T00:00:00Z' }
    const prepared = prepareReading('x', 'readings@v4', input as ReadingSampleInput)
    assert.equal(prepared.annotations?.requestYear, 2031)
  })
})

describe('确定性检查', () => {
  it('迁移录制经转换后全部硬性检查通过；删掉一年的小节则列出缺少的年份', async () => {
    const raw = recording('readings@v4', 'saju-ko-07').output
    const { output } = prepareReading(raw, 'readings@v4', sample('saju-ko-07').input)
    const ok = await runAll('readings@v4', 'saju-ko-07', output)
    assert.deepEqual(
      ok.filter((c) => !c.pass && c.severity === 'error').map((c) => c.id),
      [],
    )
    const without = output.replace(/^### 2028[^\n]*$/m, '')
    const bad = await runAll('readings@v4', 'saju-ko-07', without)
    const annual = bad.find((c) => c.id === 'annualYears')
    assert.equal(annual?.pass, false)
    assert.deepEqual(JSON.parse(annual?.detail as string).missing, [2028])
  })

  it('没有流年章节的 pre-v4 不做年份检查；长度与夹杂拉丁字母保持 warn', async () => {
    const outcomes = await runAll('readings@pre-v4', 'bazi-hant-01', '## 總論\n\nshort text')
    assert.equal(outcomes.find((c) => c.id === 'annualYears')?.pass, true)
    assert.equal(outcomes.find((c) => c.id === 'sections')?.pass, false)
    const warn = outcomes.filter((c) => c.severity === 'warn').map((c) => c.id)
    assert.deepEqual(warn, ['length', 'latin'])
    assert.equal(outcomes.find((c) => c.id === 'latin')?.pass, false)
  })

  it('年份标题与正文干支、字形与拉丁词的判定与旧脚本一致', () => {
    const years = [
      { year: 2026, ganzhi: { hanzi: '丙午', hangul: '병오' } },
      { year: 2027, ganzhi: { hanzi: '丁未', hangul: '정미' } },
    ]
    assert.deepEqual(checkYears('### 2026 병오\n### 2027 丁未', years, 'ko').mismatched, [])
    assert.equal(checkYears('### 2027 丁酉', years, 'zh-Hant').mismatched.length, 1)
    assert.deepEqual(bodyGanzhiMismatches('2027年（丁酉）', years), [
      { year: 2027, found: '丁酉', expected: '丁未' },
    ])
    assert.deepEqual(wrongGlyphs('整体變化', 'zh-Hans'), ['變'])
    assert.deepEqual(latinWords('支持 supportPercent', 'zh-Hant'), ['supportPercent'])
  })
})

describe('评测后门槛', () => {
  const ids = samples.map((s) => s.id)
  const result = (
    id: string,
    scores: Partial<Record<string, number>> | null,
    overrides: Partial<EvaluationResult> = {},
  ): EvaluationResult => ({
    id,
    tags: [],
    status: 'passed',
    checks: readingChecks.map((c) => ({ id: c.id, pass: true, severity: c.severity ?? 'error' })),
    judge: scores
      ? {
          status: 'scored',
          model: 'deepseek-v4-pro',
          criteria: Object.fromEntries(
            Object.entries(scores).map(([k, v]) => [k, { score: v as number, reason: '' }]),
          ),
        }
      : { status: 'no-recording', model: 'deepseek-v4-pro' },
    usage: { generation: { outputTokens: 3000, durationMs: 30_000 } },
    ...overrides,
  })
  const all = (score: number) => Object.fromEntries(JUDGE_DIMENSIONS.map((d) => [d, score]))
  const group = (
    promptVersion: string,
    make: (id: string, index: number) => EvaluationResult,
  ): EvaluationGroup => ({
    promptVersion,
    source: 'run',
    prepareVersion: 'guard.v4',
    generator: null,
    judge: null,
    results: ids.map(make),
  })
  const context = (
    candidate: EvaluationGroup,
    baseline: EvaluationGroup | null,
    filtered = false,
  ): EvaluateRunContext => ({
    samples,
    scope: { totalSamples: 48, selectedSamples: 48, filtered },
    mode: 'replay',
    rubric: null,
    candidate,
    baseline,
  })
  const gates = async (ctx: EvaluateRunContext) =>
    Object.fromEntries(
      ((await evaluateReadings(ctx)).gates as RunGate[]).map((g) => [g.id, g]),
    ) as Record<string, RunGate>

  it('整批均值：差值 −0.1 达成（含浮点余量），低于 −0.1 失败；accuracy 绝对分 ≥ 4', async () => {
    // 候选 accuracy 均值 = 4.4 − 0.1，其余维度持平
    const base = group('readings@pre-v4', (id) => result(id, all(4.4)))
    const pass = group('readings@v4', (id) => result(id, { ...all(4.4), accuracy: 4.3 }))
    const ok = await gates(context(pass, base))
    assert.equal(ok['judge-accuracy-vs-baseline']?.status, 'passed')
    assert.equal(ok['judge-accuracy-min']?.status, 'passed')
    assert.equal(ok.coverage?.status, 'passed')
    assert.equal(ok.versions?.status, 'passed')
    const worse = group('readings@v4', (id) => result(id, { ...all(4.4), readability: 4.28 }))
    assert.equal(
      (await gates(context(worse, base)))['judge-readability-vs-baseline']?.status,
      'failed',
    )
    const low = group('readings@v4', (id) => result(id, all(3.9)))
    assert.equal(
      (
        await gates(
          context(
            low,
            group('readings@pre-v4', (id) => result(id, all(3.9))),
          ),
        )
      )['judge-accuracy-min']?.status,
      'failed',
    )
  })

  it('任一侧缺评分就 incomplete，不在缩小的分母上求均值', async () => {
    const base = group('readings@pre-v4', (id) => result(id, all(4)))
    const candidate = group('readings@v4', (id, i) => result(id, i === 0 ? null : all(5)))
    const g = await gates(context(candidate, base))
    for (const d of JUDGE_DIMENSIONS)
      assert.equal(g[`judge-${d}-vs-baseline`]?.status, 'incomplete')
    assert.equal(g['judge-accuracy-min']?.status, 'incomplete')
    assert.equal(
      (
        await gates(
          context(
            group('readings@v4', (id) => result(id, all(5))),
            null,
          ),
        )
      )['judge-accuracy-vs-baseline']?.status,
      'incomplete',
    )
  })

  it('硬性检查失败判 failed，缺检查判 incomplete；warn 级失败不算', async () => {
    const base = group('readings@pre-v4', (id) => result(id, all(4)))
    const warnOnly = group('readings@v4', (id) =>
      result(id, all(4), {
        checks: readingChecks.map((c) => ({
          id: c.id,
          pass: c.id !== 'latin',
          severity: c.severity ?? 'error',
        })),
      }),
    )
    assert.equal((await gates(context(warnOnly, base)))['hard-checks']?.status, 'passed')
    const hardFail = group('readings@v4', (id, i) =>
      result(id, all(4), {
        checks: readingChecks.map((c) => ({
          id: c.id,
          pass: !(i === 3 && c.id === 'glyphs'),
          severity: c.severity ?? 'error',
        })),
      }),
    )
    assert.equal((await gates(context(hardFail, base)))['hard-checks']?.status, 'failed')
    const noRecording = group('readings@v4', (id, i) =>
      result(id, null, i === 0 ? { checks: [], status: 'no-recording', usage: {} } : {}),
    )
    const g = await gates(context(noRecording, base))
    assert.equal(g['hard-checks']?.status, 'incomplete')
    assert.equal(g['p95-output-tokens']?.status, 'incomplete')
  })

  it('P95 输出 token ≤ 8400、P95 时长 ≤ 240 秒；缺 durationMs 判 incomplete', async () => {
    const base = group('readings@pre-v4', (id) => result(id, all(4)))
    const slow = group('readings@v4', (id, i) =>
      result(id, all(4), {
        usage: { generation: { outputTokens: i < 45 ? 3000 : 8500, durationMs: 241_000 } },
      }),
    )
    const g = await gates(context(slow, base))
    assert.equal(g['p95-output-tokens']?.status, 'failed')
    assert.equal(g['p95-duration']?.status, 'failed')
    const noDuration = group('readings@v4', (id, i) =>
      result(id, all(4), {
        usage: { generation: { outputTokens: 3000, ...(i ? { durationMs: 1 } : {}) } },
      }),
    )
    assert.equal((await gates(context(noDuration, base)))['p95-duration']?.status, 'incomplete')
  })

  it('筛选运行样本量 incomplete；人工审阅与 staging 永不自动通过且非必需', async () => {
    const base = group('readings@pre-v4', (id) => result(id, all(4)))
    const g = await gates(
      context(
        group('readings@v4', (id) => result(id, all(4))),
        base,
        true,
      ),
    )
    assert.equal(g.coverage?.status, 'incomplete')
    for (const id of ['human-review', 'staging-acceptance']) {
      assert.equal(g[id]?.status, 'incomplete')
      assert.equal(g[id]?.required, false)
    }
  })
})
