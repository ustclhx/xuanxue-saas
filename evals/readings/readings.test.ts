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
  cjkChars,
  expectedYears,
  glossaryHits,
  latinWords,
  readingChecks,
  wrongGlyphs,
} from './checks.ts'
import { evaluateReadings, JUDGE_DIMENSIONS, V4_REFERENCE_MEANS } from './gates.ts'
import { prepareReading } from './prepare.ts'
import {
  ALL_READING_COMBOS,
  ES_READING_COMBOS,
  ES_VERSIONS,
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
/** 原六个组合（v4 批次）与追加的西班牙语样本 */
const v4Batch = samples.filter((s) =>
  (READING_COMBOS as readonly string[]).includes(`${s.input.kind}.${s.input.locale}`),
)
const esSamples = samples.filter((s) => s.input.locale === 'es')
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
  it('六个组合与西语两个组合各 8 个样本，样本 ID 唯一', () => {
    assert.equal(v4Batch.length, 48)
    assert.equal(esSamples.length, 16)
    assert.equal(byId.size, samples.length)
    for (const combo of ALL_READING_COMBOS)
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
    for (const s of v4Batch) {
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
      for (const s of v4Batch) {
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
    // 塔罗没有逐年数据
    for (const s of samples.filter((x) => x.input.kind !== 'tarot-spread')) {
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

// add-locales-eu-ja tasks 5.8：西班牙语两个组合（numerology-full.es、tarot-spread.es）
describe('西班牙语组合', () => {
  const es = (id: string) => sample(id).input

  /** 按样本数据拼一份格式正确的西语数字命理报告（检查用，不是模型输出） */
  function numerologyReport(input: ReadingSampleInput, extra = '') {
    const years = input.data.personalYears as { year: number; value: number }[]
    return [
      '## Panorama general',
      'Tu número de vida marca el tono general de esta etapa.',
      '## Número de vida',
      'Un número que invita a crear con constancia.',
      '## Números principales',
      'Tu pináculo actual y tu desafío actual piden paciencia.',
      '## Año por año',
      ...years.flatMap((y) => [
        `### ${y.year} · Año personal ${y.value}`,
        'Es un buen momento para ordenar prioridades.',
      ]),
      '## Amor y relaciones',
      'Escuchar con calma puede acercarte a quienes quieres.',
      '## Trabajo y dinero',
      'Dedicar tiempo a un oficio tiende a dar frutos.',
      '## Hábitos de bienestar',
      'Duerme a horarios regulares y camina un poco cada día.',
      '',
      'Si no te sientes bien, consulta a un profesional de la salud.',
      '## Orientación',
      `- Escribe tus metas. ${extra}`,
    ].join('\n\n')
  }

  async function errors(promptVersion: string, id: string, output: string) {
    const s = sample(id)
    const prompt = { promptVersion } as CheckContext['prompt']
    const failed: string[] = []
    for (const check of readingChecks) {
      const r = await check.run({ output, sample: s, prompt, expect: undefined })
      if (!r.pass && (check.severity ?? 'error') === 'error') failed.push(check.id)
    }
    return failed
  }

  it('es-v1 把 es 组合分派到首个 es 版本、其余组合同 v4；历史版本渲染同一份 es 提示词', () => {
    assert.deepEqual(ES_VERSIONS, {
      'numerology-full.es': 'numerology-full.v5',
      'tarot-spread.es': 'tarot-spread.v4',
    })
    for (const version of ['readings@es-v1', 'readings@v4', 'readings@pre-v4']) {
      assert.equal(realVersion(version, es('numerology-es-01')), 'numerology-full.v5')
      assert.equal(realVersion(version, es('tarot-es-05')), 'tarot-spread.v4')
    }
    for (const s of v4Batch)
      assert.deepEqual(
        renderReading('readings@es-v1', s.input),
        renderReading('readings@v4', s.input),
      )
    for (const s of esSamples) {
      const rendered = renderReading('readings@es-v1', s.input)
      assert.match(rendered.system, /español neutro de Latinoamérica/)
      assert.doesNotMatch(rendered.system, /[\p{Script=Han}\p{Script=Hangul}]/u)
      assert.deepEqual(rendered, renderReading('readings@v4', s.input))
    }
  })

  it('样本：虚构西语输入，data 与线上复算一致，标签可按 es 筛选，评委说明注明目标语言', () => {
    for (const combo of ES_READING_COMBOS) {
      const [kind] = combo.split('.') as [string]
      const items = esSamples.filter((s) => s.input.kind === kind)
      assert.equal(items.length, 8, combo)
      for (const s of items) {
        const { request, requestDate, data } = s.input
        const recomputed = recomputeReading(kind, request, new Date(requestDate), {
          locale: 'es',
          profile: 'annual',
        })
        assert.deepEqual(data, recomputed.result, s.id)
        assert.equal(
          renderReading('readings@es-v1', s.input).user,
          JSON.stringify({ kind, chart: recomputed.result }),
        )
        assert.deepEqual(s.tags, [kind, 'es', combo])
        assert.match(s.input.judgeNotes ?? '', /Spanish/)
      }
    }
    const spreads = esSamples
      .filter((s) => s.input.kind === 'tarot-spread')
      .map((s) => (s.input.data as { spread: string }).spread)
    assert.equal(spreads.filter((x) => x === 'three-card').length, 4)
    assert.equal(spreads.filter((x) => x === 'celtic-cross').length, 4)
  })

  it('格式正确的西语报告通过全部硬性检查；拉丁字母不算夹杂', async () => {
    const input = es('numerology-es-03')
    const report = numerologyReport(input)
    const { output } = prepareReading(report, 'readings@es-v1', input)
    assert.deepEqual(await errors('readings@es-v1', 'numerology-es-03', output), [])
    assert.deepEqual(latinWords(output, 'es'), [])
    const tarot = [
      '## Panorama general',
      'La tirada muestra un camino de reflexión.',
      '## Las cartas en su posición',
      '- Pasado: Los Enamorados, al derecho.',
      '## Cómo se relacionan las cartas',
      'Las cartas dialogan entre sí.',
      '## Para reflexionar',
      '¿Qué necesitas decir con claridad?',
      '## Próximos pasos concretos',
      '- Conversa con calma esta semana.',
    ].join('\n\n')
    assert.deepEqual(await errors('readings@es-v1', 'tarot-es-01', tarot), [])
  })

  it('西语专项检查：汉字 / 假名、术语表禁用写法（娱乐定位、vosotros、英文术语）、个人年数不符', async () => {
    const input = es('numerology-es-01')
    const id = 'numerology-es-01'
    assert.deepEqual(cjkChars('Tu número 命 de vida', 'es'), ['命'])
    assert.deepEqual(cjkChars('命', 'zh-Hant'), [])
    assert.ok(
      (await errors('readings@es-v1', id, numerologyReport(input, '命運'))).includes('script'),
    )
    for (const phrase of [
      'Es solo entretenimiento.',
      'Vosotros podéis elegir.',
      'Tu Life Path es 22.',
    ])
      assert.ok(
        (await errors('readings@es-v1', id, numerologyReport(input, phrase))).includes(
          'esGlossary',
        ),
        phrase,
      )
    assert.equal(glossaryHits('Una carta de Pentáculos al derecho.', 'es')?.length, 1)
    assert.equal(glossaryHits('anything', 'en'), null)
    const wrong = numerologyReport(input).replace(/(### 2027 · Año personal )\d+/, '$19')
    assert.ok((await errors('readings@es-v1', id, wrong)).includes('dataConsistency'))
    // 线上兜底按数据改正西语逐年标题，被评正文随之通过
    const prepared = prepareReading(wrong, 'readings@es-v1', input)
    assert.equal(prepared.annotations?.personalYear, 1)
    assert.equal(prepared.annotations?.promptVersion, 'numerology-full.v5')
    assert.deepEqual(await errors('readings@es-v1', id, prepared.output), [])
    // 旧组合不受新检查影响
    const outcomes = await runAll('readings@pre-v4', 'bazi-hant-01', '## 總論\n\n命')
    assert.equal(outcomes.find((c) => c.id === 'script')?.pass, true)
    assert.equal(outcomes.find((c) => c.id === 'esGlossary')?.pass, true)
  })

  describe('门槛（逐组合）', () => {
    const esIds = esSamples.map((s) => s.id)
    const scored = (
      id: string,
      scores: Record<string, number> | null,
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
              Object.entries(scores).map(([k, v]) => [k, { score: v, reason: '' }]),
            ),
          }
        : { status: 'no-recording', model: 'deepseek-v4-pro' },
      usage: { generation: { outputTokens: 3000, durationMs: 30_000 } },
      ...overrides,
    })
    const groupOf = (make: (id: string) => EvaluationResult): EvaluationGroup => ({
      promptVersion: 'readings@es-v1',
      source: 'run',
      prepareVersion: 'guard.v4',
      generator: null,
      judge: null,
      results: esIds.map(make),
    })
    const run = async (candidate: EvaluationGroup, baseline: EvaluationGroup | null = null) =>
      Object.fromEntries(
        (
          (
            await evaluateReadings({
              samples: esSamples,
              scope: {
                totalSamples: samples.length,
                selectedSamples: 16,
                filtered: true,
                tag: 'es',
              },
              mode: 'replay',
              rubric: null,
              candidate,
              baseline,
            })
          ).gates as RunGate[]
        ).map((g) => [g.id, g]),
      ) as Record<string, RunGate>
    const top = Object.fromEntries(JUDGE_DIMENSIONS.map((d) => [d, 5]))

    it('筛选 es 运行：两个组合各自判定，参照 v4 均值 − 0.1', async () => {
      const g = await run(groupOf((id) => scored(id, top)))
      for (const combo of ES_READING_COMBOS) {
        assert.equal(g[`${combo}.coverage`]?.status, 'passed')
        assert.equal(g[`${combo}.hard-checks`]?.status, 'passed')
        for (const d of JUDGE_DIMENSIONS)
          assert.equal(g[`${combo}.judge-${d}-vs-v4`]?.status, 'passed', `${combo} ${d}`)
        assert.equal(g[`${combo}.judge-accuracy-min`]?.status, 'passed')
        assert.equal(g[`${combo}.p95-output-tokens`]?.status, 'passed')
        assert.equal(g[`${combo}.p95-duration`]?.status, 'passed')
      }
      assert.equal(g.versions?.status, 'passed')
      assert.equal(g['human-review']?.required, false)
      assert.equal(V4_REFERENCE_MEANS.tone, 5)
    })

    it('一个组合未达标不影响另一个；带基线判 versions failed', async () => {
      // 塔罗 tone 均值 4.75 < 5 − 0.1；数字命理全部满分
      const candidate = groupOf((id) =>
        scored(id, id.startsWith('tarot') && /0[1-4]$/.test(id) ? { ...top, tone: 4.5 } : top),
      )
      const g = await run(candidate)
      assert.equal(g['tarot-spread.es.judge-tone-vs-v4']?.status, 'failed')
      assert.equal(g['numerology-full.es.judge-tone-vs-v4']?.status, 'passed')
      const hard = groupOf((id) =>
        scored(id, top, {
          checks: readingChecks.map((c) => ({
            id: c.id,
            pass: !(id === 'numerology-es-02' && c.id === 'esGlossary'),
            severity: c.severity ?? 'error',
          })),
        }),
      )
      const h = await run(hard)
      assert.equal(h['numerology-full.es.hard-checks']?.status, 'failed')
      assert.equal(h['tarot-spread.es.hard-checks']?.status, 'passed')
      assert.equal((await run(candidate, candidate)).versions?.status, 'failed')
      const missing = await run(groupOf((id) => scored(id, null)))
      assert.equal(missing['tarot-spread.es.judge-accuracy-min']?.status, 'incomplete')
    })
  })
})

describe('样本适用范围（suite.appliesTo）', () => {
  it('西班牙语样本只属于 readings@es-v1，旧版本的整套回放不含它们', async () => {
    const { default: suite } = await import('./suite.ts')
    const applies = suite.appliesTo
    assert.ok(applies)
    const localeOf = (sample: Sample) => (sample.input as { locale?: string }).locale
    const es = samples.filter((sample) => localeOf(sample) === 'es')
    const others = samples.filter((sample) => localeOf(sample) !== 'es')
    assert.equal(es.length, 16)
    for (const version of ['readings@pre-v4', 'readings@v4']) {
      assert.ok(
        es.every((sample) => !applies(sample, version)),
        version,
      )
      assert.ok(
        others.every((sample) => applies(sample, version)),
        version,
      )
    }
    assert.ok(samples.every((sample) => applies(sample, 'readings@es-v1')))
  })
})
