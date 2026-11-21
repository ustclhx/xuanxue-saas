import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
import { prepareReading } from '../readings/prepare.ts'
import type { ReadingSampleInput } from '../readings/prompts.ts'
import { eastEnChecks, scriptStats } from './checks.ts'
import { evaluateEastEn, REFERENCE_MEANS, REFERENCE_TOLERANCE } from './gates.ts'
import {
  CANDIDATE_VERSION,
  EAST_EN_COMBOS,
  realVersion,
  renderReading,
  resolveReading,
} from './prompts.ts'
import suite from './suite.ts'

// readings-east-en 套件的离线单测（add-locales-eu-ja 5b.3）：`pnpm test:evals`，不发起模型调用

const DIR = import.meta.dirname
const samples = JSON.parse(readFileSync(join(DIR, 'samples.json'), 'utf8')) as (Sample & {
  input: ReadingSampleInput
})[]
const sample = (id: string) =>
  samples.find((s) => s.id === id) as Sample & { input: ReadingSampleInput }

/** 按样本数据拼一份合格的英文报告：全部章节、逐年标题（汉字干支 + 拼音）、就医提示与术语 */
function goodReport(id: string): string {
  const { definition, recomputed } = resolveReading(CANDIDATE_VERSION, sample(id).input)
  const result = recomputed.result as {
    annual?: { years: { year: number }[] }
    horoscope?: { years: { year: number }[] }
  }
  const years = (result.annual ?? result.horoscope)?.years ?? []
  const STEMS: Record<string, string> = {
    2026: '丙午',
    2027: '丁未',
    2028: '戊申',
    2029: '己酉',
    2030: '庚戌',
  }
  const body = (title: string) => {
    if (title.includes('Year by Year'))
      return [
        'Each annual pillar roughly matches the calendar year.',
        ...years.map((y) => `### ${y.year} ${STEMS[y.year]} · Pinyin\n\nA year to build steadily.`),
      ].join('\n\n')
    if (title === definition.healthSection?.title)
      return `Keep a regular sleep routine.\n\n${definition.healthSection.notice}`
    return `Your Day Master and Life Palace set the tone for ${title.toLowerCase()}, so lean into steady habits.`
  }
  return definition.prompt.sections.map((title) => `## ${title}\n\n${body(title)}`).join('\n\n')
}

async function runAll(id: string, output: string) {
  const prompt = { promptVersion: CANDIDATE_VERSION } as CheckContext['prompt']
  const outcomes: { id: string; pass: boolean; severity: string; detail?: string | undefined }[] =
    []
  for (const check of eastEnChecks) {
    const r = await check.run({ output, sample: sample(id), prompt, expect: undefined })
    outcomes.push({
      id: check.id,
      pass: r.pass,
      severity: check.severity ?? 'error',
      detail: r.detail,
    })
  }
  return outcomes
}
const failedErrors = (outcomes: Awaited<ReturnType<typeof runAll>>) =>
  outcomes.filter((c) => !c.pass && c.severity === 'error').map((c) => c.id)

describe('样本与提示词', () => {
  it('两个组合各 8 个样本，样本 ID 唯一，套件定义有效', () => {
    assert.equal(suite.name, 'readings-east-en')
    assert.equal(new Set(samples.map((s) => s.id)).size, samples.length)
    for (const combo of EAST_EN_COMBOS)
      assert.equal(
        samples.filter((s) => `${s.input.kind}.${s.input.locale}` === combo).length,
        8,
        combo,
      )
  })

  it('评委用的 data 与 annual 数据档复算一致；消息与线上 v4 英文提示词逐字相同', () => {
    for (const s of samples) {
      const { kind, locale, request, requestDate, data } = s.input
      const annual = recomputeReading(kind, request, new Date(requestDate), {
        locale,
        profile: 'annual',
      })
      assert.deepEqual(data, annual.result, s.id)
      const rendered = renderReading(CANDIDATE_VERSION, s.input)
      assert.equal(rendered.user, JSON.stringify({ kind, chart: annual.result }))
      assert.equal(rendered.system, readingDefinition(kind, 'en')?.prompt.system)
    }
  })

  it('套件版本分派到 <kind>.v4 的英文；其他组合与版本拒绝', () => {
    assert.equal(realVersion(CANDIDATE_VERSION, sample('bazi-en-01').input), 'bazi-full.v4')
    assert.equal(realVersion(CANDIDATE_VERSION, sample('ziwei-en-01').input), 'ziwei-full.v4')
    assert.throws(() => realVersion('readings-east-en@v1', sample('bazi-en-01').input))
    assert.throws(() =>
      realVersion(CANDIDATE_VERSION, { ...sample('bazi-en-01').input, locale: 'zh-Hant' }),
    )
  })

  it('版本锁含全部样本（新样本或改动提示词须先本地运行一次并提交锁）', () => {
    const lock = JSON.parse(readFileSync(join(DIR, 'prompts.lock.json'), 'utf8'))
    assert.deepEqual(Object.keys(lock), [CANDIDATE_VERSION])
    assert.deepEqual(Object.keys(lock[CANDIDATE_VERSION]).sort(), samples.map((s) => s.id).sort())
  })
})

describe('确定性检查', () => {
  it('合格的英文报告通过全部硬性检查', async () => {
    for (const id of ['bazi-en-01', 'ziwei-en-07'])
      assert.deepEqual(failedErrors(await runAll(id, goodReport(id))), [], id)
  })

  it('整句中文、假名或中文标点判 script 失败；短注释与年份标题不算', async () => {
    const good = goodReport('bazi-en-02')
    const stats = scriptStats(`${good}\n\nGeng 庚 (Yang Metal).`)
    assert.ok(stats.ratio > 0 && stats.ratio < 0.02)
    const chinese = `${good}\n\n${'這一年適合穩紮穩打，與人合作。'.repeat(8)}`
    assert.ok(failedErrors(await runAll('bazi-en-02', chinese)).includes('script'))
    const kana = `${good}\n\nこれは日本語です`
    assert.ok(failedErrors(await runAll('bazi-en-02', kana)).includes('script'))
    const runs = await runAll('bazi-en-02', `${good}\n\n天乙貴人文昌`)
    assert.equal(runs.find((c) => c.id === 'hanRuns')?.pass, false)
    assert.equal(runs.find((c) => c.id === 'hanRuns')?.severity, 'warn')
  })

  it('定位与承诺类禁用词、缺少术语判失败；声明由交付正文提供', async () => {
    const good = goodReport('ziwei-en-03')
    const banned = await runAll('ziwei-en-03', `${good}\n\nThis is just entertainment.`)
    assert.ok(failedErrors(banned).includes('wording'))
    const guaranteed = await runAll('ziwei-en-03', `${good}\n\nResults are guaranteed.`)
    assert.ok(failedErrors(guaranteed).includes('wording'))
    const noTerm = await runAll('ziwei-en-03', good.replaceAll('Life Palace', 'main house'))
    assert.ok(failedErrors(noTerm).includes('terminology'))
  })

  it('年份标题干支与数据不符时检查失败，经线上兜底（guard.v4）改正后通过', async () => {
    const wrong = goodReport('bazi-en-03').replace('### 2027 丁未', '### 2027 丁酉')
    assert.ok(failedErrors(await runAll('bazi-en-03', wrong)).includes('dataConsistency'))
    const prepared = prepareReading(
      wrong,
      CANDIDATE_VERSION,
      sample('bazi-en-03').input,
      resolveReading,
    )
    assert.equal(prepared.annotations?.promptVersion, 'bazi-full.v4')
    assert.equal(prepared.annotations?.ganzhi, 1)
    assert.deepEqual(failedErrors(await runAll('bazi-en-03', prepared.output)), [])
  })

  it('月份名 + will 的段落触发合规检查', async () => {
    const report = `${goodReport('bazi-en-04')}\n\nIn March 2027 you will change jobs.`
    assert.ok(failedErrors(await runAll('bazi-en-04', report)).includes('compliance'))
  })
})

describe('评测后门槛（逐组合）', () => {
  const ids = samples.map((s) => s.id)
  const dims = ['accuracy', 'specificity', 'actionability', 'tone', 'readability']
  const result = (
    id: string,
    score: number | null,
    overrides: Partial<EvaluationResult> = {},
  ): EvaluationResult => ({
    id,
    tags: [],
    status: 'passed',
    checks: eastEnChecks.map((c) => ({ id: c.id, pass: true, severity: c.severity ?? 'error' })),
    judge:
      score === null
        ? { status: 'no-recording', model: 'deepseek-v4-pro' }
        : {
            status: 'scored',
            model: 'deepseek-v4-pro',
            criteria: Object.fromEntries(dims.map((d) => [d, { score, reason: '' }])),
          },
    usage: { generation: { outputTokens: 4000, durationMs: 40_000 } },
    ...overrides,
  })
  const group = (make: (id: string) => EvaluationResult): EvaluationGroup => ({
    promptVersion: CANDIDATE_VERSION,
    source: 'run',
    prepareVersion: 'guard.v4',
    generator: null,
    judge: null,
    results: ids.map(make),
  })
  const gates = async (candidate: EvaluationGroup, filtered = false) => {
    const ctx: EvaluateRunContext = {
      samples,
      scope: { totalSamples: 16, selectedSamples: 16, filtered },
      mode: 'replay',
      rubric: null,
      candidate,
      baseline: null,
    }
    return Object.fromEntries(
      ((await evaluateEastEn(ctx)).gates as RunGate[]).map((g) => [g.id, g]),
    ) as Record<string, RunGate>
  }

  it('全部满分时两个组合的必需门槛都通过', async () => {
    const g = await gates(group((id) => result(id, 5)))
    const required = Object.values(g).filter((gate) => gate.required !== false)
    assert.deepEqual(
      required.filter((gate) => gate.status !== 'passed').map((gate) => gate.id),
      [],
    )
    assert.ok(g['bazi-full.en.judge-tone'] && g['ziwei-full.en.coverage'])
  })

  it('评委均值低于中文 v4 参照 − 容差判失败，只影响该组合', async () => {
    const floor = (REFERENCE_MEANS['ziwei-full']?.readability as number) - REFERENCE_TOLERANCE
    const low = group((id) =>
      id.startsWith('ziwei')
        ? result(id, 5, {
            judge: {
              status: 'scored',
              model: 'deepseek-v4-pro',
              criteria: Object.fromEntries(
                dims.map((d) => [d, { score: d === 'readability' ? 4 : 5, reason: '' }]),
              ),
            },
          })
        : result(id, 5),
    )
    const g = await gates(low)
    assert.ok(4 < floor)
    assert.equal(g['ziwei-full.en.judge-readability']?.status, 'failed')
    assert.equal(g['bazi-full.en.judge-readability']?.status, 'passed')
  })

  it('accuracy 低于 4 判失败；缺评分判 incomplete；硬性检查失败判 failed', async () => {
    assert.equal(
      (await gates(group((id) => result(id, 3.9))))['bazi-full.en.judge-accuracy-min']?.status,
      'failed',
    )
    const missing = await gates(group((id) => result(id, id === 'bazi-en-01' ? null : 5)))
    assert.equal(missing['bazi-full.en.judge-accuracy']?.status, 'incomplete')
    assert.equal(missing['ziwei-full.en.judge-accuracy']?.status, 'passed')
    const hard = await gates(
      group((id) =>
        result(id, 5, {
          checks: eastEnChecks.map((c) => ({
            id: c.id,
            pass: !(id === 'ziwei-en-02' && c.id === 'script'),
            severity: c.severity ?? 'error',
          })),
        }),
      ),
    )
    assert.equal(hard['ziwei-full.en.hard-checks']?.status, 'failed')
    assert.equal(hard['bazi-full.en.hard-checks']?.status, 'passed')
  })

  it('筛选运行样本量 incomplete；人工审阅与 staging 非必需', async () => {
    const g = await gates(
      group((id) => result(id, 5)),
      true,
    )
    assert.equal(g['bazi-full.en.coverage']?.status, 'incomplete')
    assert.equal(g['human-review']?.required, false)
    assert.equal(g['staging-acceptance']?.required, false)
  })
})
