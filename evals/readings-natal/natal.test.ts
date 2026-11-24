import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type { CheckContext, Sample } from '@xuanxue/evals'
import { readingMessages } from '../../apps/web/src/features/readings/catalog.ts'
import { natalChartWithSummary } from '../../apps/web/src/features/readings/natal-chart.ts'
import type { ReadingSampleInput } from '../readings/prompts.ts'
import { natalChecks, placementIssues, risingClaims } from './checks.ts'
import {
  BASELINE_VERSION,
  CANDIDATE_VERSION,
  realVersion,
  renderReading,
  resolveReading,
} from './prompts.ts'
import suite from './suite.ts'

// readings-natal 套件的离线单测（content-growth-v2-tools 第 23 组）：`pnpm test:evals`，不发起模型调用

const DIR = import.meta.dirname
const samples = JSON.parse(readFileSync(join(DIR, 'samples.json'), 'utf8')) as (Sample & {
  input: ReadingSampleInput
})[]
const sample = (id: string) =>
  samples.find((s) => s.id === id) as Sample & { input: ReadingSampleInput }

/** 按样本数据拼一份合格的报告：全部章节，正文写出与数据一致的落座 */
function goodReport(id: string): string {
  const { definition, recomputed } = resolveReading(CANDIDATE_VERSION, sample(id).input)
  const data = sample(id).input.data as {
    points: { point: string; sign: string; house: string | null }[]
  }
  const sun = data.points.find((point) => point.point === 'Sun')
  return definition.prompt.sections
    .map((title) => {
      const line =
        title === 'The Big Three' && sun
          ? `Tradition reads the Sun in ${sun.sign.split(' or ')[0]}${sun.house ? `, in the ${sun.house} house,` : ''} as a steady theme.`
          : 'Astrologers often read this placement as a quiet emphasis on patient work.'
      const summary =
        title === 'Houses and Emphasis'
          ? `${natalChartWithSummary(recomputed.result).summaryLines.join('\n')}\n\n`
          : ''
      return `## ${title}\n\n${summary}${line}`
    })
    .join('\n\n')
}

async function runAll(id: string, output: string) {
  const prompt = { promptVersion: CANDIDATE_VERSION } as CheckContext['prompt']
  const outcomes: { id: string; pass: boolean; severity: string; detail?: string | undefined }[] =
    []
  for (const check of natalChecks) {
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
  it('6 个样本，ID 唯一，覆盖未知时间、高纬度、南半球、夏令时与 1970 年前', () => {
    assert.equal(suite.name, 'readings-natal')
    assert.equal(samples.length, 6)
    assert.equal(new Set(samples.map((s) => s.id)).size, samples.length)
    const requests = samples.map((s) => s.input.request as Record<string, unknown>)
    assert.ok(requests.some((r) => r.hour === undefined))
    assert.ok(requests.some((r) => (r.latitude as number) > 66))
    assert.ok(requests.some((r) => (r.latitude as number) < 0))
    assert.ok(requests.some((r) => (r.year as number) < 1970))
  })

  it('样本 data 与服务端复算一致（评委核对用）', () => {
    for (const s of samples) {
      const { recomputed } = resolveReading(CANDIDATE_VERSION, s.input)
      assert.deepEqual(recomputed.result, s.input.data, s.id)
    }
  })

  it('保留 v1 回放，v2 候选的消息与线上 readingMessages 相同', () => {
    const s = sample('natal-en-01')
    assert.equal(realVersion(BASELINE_VERSION, s.input), 'natal-full.v1')
    assert.equal(realVersion(CANDIDATE_VERSION, s.input), 'natal-full.v2')
    assert.throws(() => realVersion('readings-natal@v0', s.input))
    const { definition, recomputed } = resolveReading(CANDIDATE_VERSION, s.input)
    const [system, user] = readingMessages(definition, recomputed)
    assert.deepEqual(renderReading(CANDIDATE_VERSION, s.input), {
      system: system?.text,
      user: user?.text,
    })
  })
})

describe('检查', () => {
  it('合格报告通过全部 error 级检查', async () => {
    for (const s of samples)
      assert.deepEqual(failedErrors(await runAll(s.id, goodReport(s.id))), [], s.id)
  })

  it('汇总拦截原样例的宫内行星数与元素归属错误', async () => {
    const base = goodReport('natal-en-01')
    assert.match(base, /6th — 2 \(Uranus, Neptune\)/)
    assert.match(base, /Fire — 1 \(Venus\)/)
    for (const output of [
      base.replace('6th — 2 (Uranus, Neptune)', '6th — 1 (Uranus)'),
      base.replace('Fire — 1 (Venus)', 'Fire — 1 (Venus, Mars)'),
      `${base}\n\nWith single planets scattered through the 5th, 6th, 9th, 11th and 12th.`,
      `${base}\n\nFire appears once, through Venus in Aries and Mars in Pisces being the water-side of drive.`,
    ]) {
      assert.ok(failedErrors(await runAll('natal-en-01', output)).includes('chartSummary'))
    }
  })

  it('落座或宫位与数据不符时失败；跨座的两个星座都算对', () => {
    const data = sample('natal-en-01').input.data as Parameters<typeof placementIssues>[1]
    assert.deepEqual(placementIssues('The Sun in Taurus, in the 11th house.', data), [])
    assert.equal(placementIssues('The Sun in Gemini.', data).length, 1)
    assert.equal(placementIssues('Mars in Pisces in the 3rd house.', data).length, 1)
    const untimed = sample('natal-en-04').input.data as Parameters<typeof placementIssues>[1]
    assert.deepEqual(placementIssues('The Moon in Aquarius is possible.', untimed), [])
    assert.equal(placementIssues('Mercury in the 10th house.', untimed).length, 1)
  })

  it('上升星座：有时间须与数据一致，无时间不得写出', async () => {
    assert.deepEqual(risingClaims('With Cancer rising and the Ascendant in Cancer.'), ['Cancer'])
    const timed = await runAll('natal-en-01', `${goodReport('natal-en-01')}\n\nLeo rising.`)
    assert.ok(failedErrors(timed).includes('rising'))
    const untimed = await runAll('natal-en-04', `${goodReport('natal-en-04')}\n\nCancer rising.`)
    assert.ok(failedErrors(untimed).includes('rising'))
  })

  it('判定词、数据外的点与 AI 字样列为失败', async () => {
    const base = goodReport('natal-en-02')
    for (const [extra, id] of [
      ['You two are soulmates.', 'verdicts'],
      ['Chiron in the 4th house.', 'extraPoints'],
      ['This AI reading explains it.', 'wording'],
    ] as const)
      assert.ok(failedErrors(await runAll('natal-en-02', `${base}\n\n${extra}`)).includes(id), id)
  })
})
