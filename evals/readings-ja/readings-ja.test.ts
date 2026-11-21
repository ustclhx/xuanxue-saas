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
  READING_EVAL_PENDING,
  readingDefinition,
  readingMessages,
} from '../../apps/web/src/features/readings/catalog.ts'
import { JUDGE_DIMENSIONS } from '../readings/gates.ts'
import {
  JA_SUITE_VERSION,
  JA_VERSIONS,
  READING_JA_COMBOS,
  type ReadingSampleInput,
  realVersion,
  renderReading,
} from '../readings/prompts.ts'
import {
  complianceStatementIssues,
  glossaryHits,
  JA_CHECKS,
  kanaRatio,
  MIN_KANA_RATIO,
  readingJaChecks,
  simplifiedGlyphs,
} from './checks.ts'
import { evaluateReadingsJa, REFERENCE_JUDGE_MEANS } from './gates.ts'
import { prepareJaReading } from './prepare.ts'
import suite from './suite.ts'

// readings-ja 套件的离线单测（openspec add-locales-eu-ja tasks 4.8）：`pnpm test:evals`，不发起模型调用

const DIR = import.meta.dirname
const samples = JSON.parse(readFileSync(join(DIR, 'samples.json'), 'utf8')) as (Sample & {
  input: ReadingSampleInput & { request: Record<string, unknown> }
})[]
const sample = (id: string) => samples.find((s) => s.id === id) as (typeof samples)[number]

describe('样本', () => {
  it('三个日语组合各 8 个样本，符合套件 inputSchema，标签含组合', () => {
    assert.equal(samples.length, 24)
    for (const combo of READING_JA_COMBOS)
      assert.equal(
        samples.filter((s) => `${s.input.kind}.${s.input.locale}` === combo).length,
        8,
        combo,
      )
    for (const s of samples) {
      assert.ok(suite.inputSchema?.safeParse(s.input).success, s.id)
      assert.ok(s.tags?.includes(`${s.input.kind}.ja`), s.id)
    }
  })

  it('样本的 data 与按样本请求时间复算的结果一致（评委核对用）', () => {
    for (const s of samples) {
      const definition = readingDefinition(s.input.kind, 'ja')
      assert.ok(definition, s.id)
      const recomputed = definition.recompute(s.input.request, new Date(s.input.requestDate))
      assert.deepEqual(JSON.parse(JSON.stringify(recomputed.result)), s.input.data, s.id)
    }
  })

  it('覆盖日本出生地、1948–1951 夏令时出生、不知道时辰与日语塔罗问题', () => {
    const cities = new Set(
      samples.map((s) => (s.input.request.location as { city?: string } | undefined)?.city),
    )
    for (const city of ['tokyo', 'osaka', 'sapporo', 'fukuoka']) assert.ok(cities.has(city), city)
    const summerTime = samples.filter((s) => {
      const { year, month } = s.input.request as { year?: number; month?: number }
      return (
        s.input.kind !== 'tarot-spread' &&
        (year ?? 0) >= 1948 &&
        (year ?? 0) <= 1951 &&
        (month ?? 0) >= 5 &&
        (month ?? 0) <= 9
      )
    })
    assert.ok(summerTime.some((s) => s.input.kind === 'bazi-full'))
    assert.ok(samples.some((s) => s.input.kind === 'bazi-full' && s.input.request.time === null))
    const questions = samples
      .filter((s) => s.input.kind === 'tarot-spread' && s.input.request.question)
      .map((s) => String(s.input.request.question))
    assert.ok(questions.length >= 6)
    for (const q of questions) assert.ok(kanaRatio(q) >= MIN_KANA_RATIO, q)
  })
})

describe('提示词分派', () => {
  it('readings-ja@v2 按组合取 catalog 中 ja 的真实版本，消息与线上 readingMessages 相同', () => {
    for (const combo of READING_JA_COMBOS) {
      const s = samples.find((x) => `${x.input.kind}.${x.input.locale}` === combo)
      assert.ok(s)
      assert.equal(realVersion(JA_SUITE_VERSION, s.input), JA_VERSIONS[combo])
      const definition = readingDefinition(s.input.kind, 'ja', {
        promptVersion: JA_VERSIONS[combo],
      })
      assert.ok(definition)
      const [system, user] = readingMessages(
        definition,
        definition.recompute(s.input.request, new Date(s.input.requestDate)),
      )
      assert.deepEqual(renderReading(JA_SUITE_VERSION, s.input), {
        system: system?.text,
        user: user?.text,
      })
      // 真实评测通过（readings-ja@v2，2026-11-21）后已从待评测集合删去
      assert.ok(!READING_EVAL_PENDING.has(combo))
    }
  })

  it('两个套件互不接受对方的组合', () => {
    assert.throws(() => realVersion('readings@v4', sample('bazi-ja-01').input))
    assert.throws(() =>
      realVersion(JA_SUITE_VERSION, { ...sample('bazi-ja-01').input, locale: 'zh-Hant' }),
    )
  })
})

describe('日语确定性检查', () => {
  const JA_TEXT = '命式の中心は日干の庚金で、月柱の十二運星は長生です。'
  it('假名占比：日语通过，中文不通过', () => {
    assert.ok(kanaRatio(JA_TEXT) >= MIN_KANA_RATIO)
    assert.ok(kanaRatio('命盘的中心是日主庚金，月柱为长生。') < MIN_KANA_RATIO)
  })

  it('简体专用字形取自术语表', () => {
    assert.deepEqual(simplifiedGlyphs('今年の运気と们'), ['运', '们'])
    assert.deepEqual(simplifiedGlyphs('今年の運気'), [])
  })

  it('术语表禁用写法：十神、四柱推命里的命盤、正位、娯楽；正位置与紫微的命盤不算', () => {
    const banned = (text: string, kind = 'bazi-full') =>
      glossaryHits(text, kind).map((h) => h.banned)
    assert.deepEqual(banned('十神のバランス'), ['十神'])
    assert.ok(banned('あなたの命盤では').length > 0)
    assert.deepEqual(banned('あなたの命盤では', 'ziwei-full'), [])
    assert.deepEqual(banned('隠者が正位置で出ました', 'tarot-spread'), [])
    assert.ok(banned('隠者が正位で出ました', 'tarot-spread').includes('正位'))
    assert.ok(banned('占いは娯楽として楽しんで', 'tarot-spread').some((b) => b.includes('娯楽')))
    assert.ok(banned('この鑑定は娯楽です', 'tarot-spread').some((b) => b.includes('娯楽')))
    // 一般用法（娯楽費、娯楽や気分転換の出費）不算定位
    assert.deepEqual(banned('娯楽や気分転換の出費が増えやすい'), [])
    // 简体字形只由 simplifiedGlyphs 报告
    assert.deepEqual(banned('运'), [])
  })

  it('被评正文首尾带日语合规声明；模型原文没有声明时报告缺失', () => {
    const s = sample('tarot-ja-03')
    const raw = '## 全体のメッセージ\n\n内容です。'
    const prepared = prepareJaReading(raw, JA_SUITE_VERSION, s.input)
    assert.deepEqual(complianceStatementIssues(prepared.output), [])
    assert.equal(prepared.annotations?.promptVersion, 'tarot-spread.v3')
    assert.ok(complianceStatementIssues(raw).includes('missing opening statement'))
  })

  async function runAll(id: string, raw: string) {
    const s = sample(id)
    const output = prepareJaReading(raw, JA_SUITE_VERSION, s.input).output
    const prompt = { promptVersion: JA_SUITE_VERSION } as CheckContext['prompt']
    const outcomes: Record<string, boolean> = {}
    for (const check of readingJaChecks)
      outcomes[check.id] = (await check.run({ output, sample: s, prompt, expect: undefined })).pass
    return outcomes
  }

  const tarotReport = (extra = '') =>
    [
      '## 全体のメッセージ',
      `このスプレッドは、立ち止まって考える時間の大切さを伝えています。${extra}`,
      '## カードごとのリーディング',
      '- 過去：女教皇（正位置）。静かに考えをまとめてきた時期です。',
      '- 現在：ソードの8（逆位置）。思い込みがゆるみ始めています。',
      '- 未来：ペンタクルのエース（正位置）。小さな一歩を形にする方向です。',
      '## カード同士のつながり',
      '内側の整理から、具体的な行動へと流れがつながっています。',
      '## ふり返りたいテーマ',
      '今いちばん手放したい思い込みは何でしょうか。',
      '## 具体的な次の一歩',
      '- 今週、気になっていることを一つ書き出してみましょう。',
    ].join('\n\n')

  it('合格的日语报告通过全部 error 级检查；混入中文用语或简体字时失败', async () => {
    const good = await runAll('tarot-ja-03', tarotReport())
    for (const check of readingJaChecks)
      if ((check.severity ?? 'error') === 'error') assert.equal(good[check.id], true, check.id)
    const bad = await runAll('tarot-ja-03', tarotReport('这张牌的牌阵很重要。'))
    assert.equal(bad.simplifiedGlyphs, false)
    assert.equal(bad.glossary, false)
  })

  it('日语检查都是 error 级', () => {
    for (const check of JA_CHECKS) assert.equal(check.severity ?? 'error', 'error')
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
    checks: readingJaChecks.map((c) => ({ id: c.id, pass: true, severity: c.severity ?? 'error' })),
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
  const top = Object.fromEntries(JUDGE_DIMENSIONS.map((d) => [d, 5]))
  const group = (
    promptVersion: string,
    make: (id: string, index: number) => EvaluationResult,
  ): EvaluationGroup => ({
    promptVersion,
    source: 'run',
    prepareVersion: 'guard.v4-disclaimer.1',
    generator: null,
    judge: null,
    results: ids.map(make),
  })
  const gates = async (candidate: EvaluationGroup, filtered = false) => {
    const ctx: EvaluateRunContext = {
      samples,
      scope: { totalSamples: 24, selectedSamples: 24, filtered },
      mode: 'replay',
      rubric: null,
      candidate,
      baseline: null,
    }
    return Object.fromEntries(
      ((await evaluateReadingsJa(ctx)).gates as RunGate[]).map((g) => [g.id, g]),
    ) as Record<string, RunGate>
  }

  it('全部满分时必需门槛通过，每个组合的分组结果也通过', async () => {
    const g = await gates(group(JA_SUITE_VERSION, (id) => result(id, top)))
    for (const gate of Object.values(g))
      if (gate.required !== false) assert.equal(gate.status, 'passed', gate.id)
    for (const combo of READING_JA_COMBOS) assert.equal(g[`combo-${combo}`]?.status, 'passed')
  })

  it('对照 readings@v4 均值：低于参考值 0.1 以上失败，且只拖累对应组合', async () => {
    const g = await gates(
      group(JA_SUITE_VERSION, (id) =>
        result(id, id.startsWith('tarot') ? { ...top, readability: 3 } : top),
      ),
    )
    assert.equal(g['judge-readability-vs-reference']?.status, 'failed')
    assert.equal(g['combo-tarot-spread.ja']?.status, 'failed')
    assert.equal(g['combo-bazi-full.ja']?.status, 'passed')
  })

  it('日语检查失败计入硬性检查；缺评分或筛选运行为 incomplete；版本不对失败', async () => {
    const failing = await gates(
      group(JA_SUITE_VERSION, (id, i) =>
        result(id, top, {
          checks: readingJaChecks.map((c) => ({
            id: c.id,
            pass: !(i === 0 && c.id === 'kana'),
            severity: c.severity ?? 'error',
          })),
        }),
      ),
    )
    assert.equal(failing['hard-checks']?.status, 'failed')
    const missing = await gates(
      group(JA_SUITE_VERSION, (id, i) => result(id, i === 0 ? null : top)),
    )
    assert.equal(missing['judge-accuracy-min']?.status, 'incomplete')
    const filtered = await gates(
      group(JA_SUITE_VERSION, (id) => result(id, top)),
      true,
    )
    assert.equal(filtered.coverage?.status, 'incomplete')
    const wrong = await gates(group('readings@v4', (id) => result(id, top)))
    assert.equal(wrong.versions?.status, 'failed')
  })

  it('参考均值与 readings@v4 的评委录制一致', () => {
    const dir = join(DIR, '../readings/recordings/readings@v4/deepseek-flash')
    const scores: Record<string, number[]> = {}
    for (const file of readdirSync(dir).filter((f) => f.includes('.judge.'))) {
      const recording = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { output: string }
      const criteria = JSON.parse(recording.output).criteria as Record<string, { score: number }>
      for (const [key, value] of Object.entries(criteria))
        scores[key] = [...(scores[key] ?? []), value.score]
    }
    for (const dimension of JUDGE_DIMENSIONS) {
      const values = scores[dimension] ?? []
      assert.equal(values.length, 48)
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      assert.ok(Math.abs(mean - REFERENCE_JUDGE_MEANS[dimension]) < 1e-5, dimension)
    }
  })
})
