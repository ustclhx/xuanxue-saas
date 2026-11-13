import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReadingDefinition } from '../../src/features/readings/catalog.ts'
import { Budget, EvalUsageError, parseArgs } from './args.ts'
import {
  bodyGanzhiMismatches,
  checkReading,
  expectedYears,
  latinWords,
  wrongGlyphs,
} from './checks.ts'
import { parseJudge } from './judge.ts'
import { resolveVersion, runEval } from './runner.ts'
import { percentile, type SampleOutcome, summarize } from './stats.ts'

// readings-prompt-v4-yearly tasks.md 2.5：检查器、汇总与预算保护的离线单测（只用虚构文本）。

/** 带流年章节的虚构定义，检查器不依赖 v4 提示词是否已登记 */
const definition = {
  kind: 'bazi-full',
  locales: ['zh-Hant'],
  prompt: {
    version: 'test.v4',
    system: '',
    sections: ['總論', '健康作息提示', '流年逐年', '建議'],
  },
  disclaimer: '',
  healthSection: { title: '健康作息提示', notice: '如有不適請諮詢專業醫師。' },
  sample: '',
  recompute: () => {
    throw new Error('unused')
  },
} as unknown as ReadingDefinition

const result = {
  annual: {
    years: [
      { year: 2026, stem: 'bing', branch: 'wu' },
      { year: 2027, stem: 'ding', branch: 'wei' },
    ],
  },
}

const report = (years: string) => `## 總論

日主乙木，整體平穩。

## 健康作息提示

作息規律。如有不適請諮詢專業醫師。

## 流年逐年

${years}

## 建議

- 每週整理一次計畫。
`

const GOOD_YEARS = '### 2026 丙午\n\n上半年宜穩。\n\n### 2027 丁未\n\n下半年宜動。'

const failed = (text: string, locale = 'zh-Hant') =>
  checkReading({ text, definition, locale, result })
    .checks.filter((c) => c.hard && !c.passed)
    .map((c) => c.name)

describe('确定性检查', () => {
  it('完整的报告通过全部硬性检查', () => {
    expect(failed(report(GOOD_YEARS))).toEqual([])
  })

  it('缺少窗口内某一年的小节时失败并列出缺少的年份', () => {
    const check = checkReading({
      text: report('### 2026 丙午\n\n內容'),
      definition,
      locale: 'zh-Hant',
      result,
    })
    expect(check.passed).toBe(false)
    expect(check.checks.find((c) => c.name === 'annualYears')?.detail).toMatchObject({
      missing: [2027],
    })
  })

  it('多出窗口外年份、干支与数据不一致都判失败', () => {
    expect(failed(report(`${GOOD_YEARS}\n\n### 2028 戊申\n\n內容`))).toContain('annualYears')
    expect(failed(report('### 2026 丙午\n\n內容\n\n### 2027 戊申\n\n內容'))).toContain(
      'dataConsistency',
    )
    expect(
      bodyGanzhiMismatches('2027 年丁未宜穩，2026（甲午）不對', expectedYears(result)),
    ).toEqual([{ year: 2026, found: '甲午', expected: '丙午' }])
  })

  it('合规命中、缺就医提示与章节缺失判失败', () => {
    const dated = report(GOOD_YEARS).replace('上半年宜穩。', '2026年3月5日一定會升職。')
    expect(failed(dated)).toContain('compliance')
    expect(failed(report(GOOD_YEARS).replace('如有不適請諮詢專業醫師。', ''))).toContain(
      'healthNotice',
    )
    expect(failed(report(GOOD_YEARS).replace('## 建議', '## 其他'))).toContain('sections')
  })

  it('繁简字形与夹杂外文', () => {
    // 繁中正文先按线上规则转换，混入的简体字不算失败；简中正文出现繁体字判失败
    expect(failed(report(GOOD_YEARS).replace('整體', '整体'))).toEqual([])
    expect(wrongGlyphs('这是與后', 'zh-Hans')).toEqual(['與'])
    expect(latinWords('今年 career 不錯 2026', 'zh-Hant')).toEqual(['career'])
    expect(latinWords('Hello', 'en')).toEqual([])
  })

  it('사주：标题写韩文干支也算一致；数字命理按个人年数比对', () => {
    const ko = {
      ...definition,
      prompt: { ...definition.prompt, sections: ['연도별 세운'] },
      healthSection: null,
    } as ReadingDefinition
    const koText = '## 연도별 세운\n\n### 2026 병오(丙午)\n\n내용\n\n### 2027 정미\n\n내용'
    expect(checkReading({ text: koText, definition: ko, locale: 'ko', result }).passed).toBe(true)
    const en = { ...ko, prompt: { ...ko.prompt, sections: ['Year by Year'] } } as ReadingDefinition
    const personal = {
      personalYears: [
        { year: 2026, value: 11 },
        { year: 2027, value: 3 },
      ],
    }
    const enText =
      '## Year by Year\n\n### 2026 · Personal Year 11\n\nText\n\n### 2027 · Personal Year 4\n\nText'
    const check = checkReading({ text: enText, definition: en, locale: 'en', result: personal })
    expect(check.checks.find((c) => c.name === 'dataConsistency')?.passed).toBe(false)
  })

  it('没有流年章节的基线版本不做年份检查', () => {
    const base = {
      ...definition,
      prompt: { ...definition.prompt, sections: ['總論'] },
      healthSection: null,
    } as ReadingDefinition
    const check = checkReading({
      text: '## 總論\n\n內容',
      definition: base,
      locale: 'zh-Hant',
      result,
    })
    expect(check.checks.map((c) => c.name)).not.toContain('annualYears')
  })
})

describe('汇总与评委', () => {
  it('分位数与基线、候选的差值', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5)
    expect(percentile([], 50)).toBeNull()
    const outcome = (
      role: SampleOutcome['role'],
      accuracy: number,
      passed: boolean,
    ): SampleOutcome => ({
      sampleId: `s-${role}-${accuracy}`,
      kind: 'bazi-full',
      locale: 'zh-Hant',
      version: role,
      role,
      status: 'checked',
      report: { passed, chars: 100, checks: [{ name: 'sections', hard: true, passed }] },
      outputTokens: 1000,
      durationMs: 1000,
      judge: {
        scores: { accuracy, specificity: 3, actionability: 3, tone: 3, readability: 3 },
        reasons: {},
      },
    })
    const s = summarize([
      outcome('baseline', 3, true),
      outcome('baseline', 4, false),
      outcome('candidate', 5, true),
    ])
    expect(s.baseline.passRate).toBe(0.5)
    expect(s.baseline.failures).toEqual({ sections: 1 })
    expect(s.judgeDelta.accuracy).toBe(1.5)
    expect(s.judgeDelta.tone).toBe(0)
  })

  it('解析评委 JSON，分数越界时报错', () => {
    const scores = { accuracy: 4, specificity: 3, actionability: 5, tone: 4, readability: 4 }
    expect(
      parseJudge(`\`\`\`json\n${JSON.stringify({ scores, reasons: { tone: 'ok' } })}\n\`\`\``),
    ).toEqual({
      scores,
      reasons: { tone: 'ok' },
    })
    expect(() => parseJudge(JSON.stringify({ scores: { ...scores, tone: 6 } }))).toThrow()
  })
})

describe('参数与预算保护', () => {
  it('--live 缺少预算参数时报错；离线模式不接受预算与评委参数', () => {
    expect(() => parseArgs(['--live', '--model', 'deepseek:chat'])).toThrow(EvalUsageError)
    expect(() => parseArgs(['--live', '--model', 'deepseek:chat', '--max-calls', '3'])).toThrow(
      EvalUsageError,
    )
    expect(() => parseArgs(['--judge', 'openai:gpt'])).toThrow(EvalUsageError)
    expect(parseArgs([])).toMatchObject({ baseline: 'default', candidate: null, live: null })
    const live = parseArgs([
      '--live',
      '--model',
      'deepseek:chat',
      '--max-calls',
      '4',
      '--max-usd',
      '1',
      '--price-in',
      '0.001',
      '--price-out',
      '0.002',
    ]).live
    expect(live).toMatchObject({ maxCalls: 4, maxUsd: 1, maxOutputTokens: 12000, judge: null })
  })

  it('按最坏情况估算，超过次数或金额即停', () => {
    const budget = new Budget({ maxCalls: 2, maxUsd: 0.04, priceIn: 0.001, priceOut: 0.002 })
    expect(budget.allows(1000, 12000)).toBe(true) // 0.001 + 0.024
    budget.record(1000, 12000)
    expect(budget.allows(1000, 12000)).toBe(false) // 累计将超过 0.04
    expect(budget.allows(1000, 1000)).toBe(true)
    budget.record(10, 10)
    expect(budget.allows(1, 1)).toBe(false) // 次数用尽
  })

  it('版本简写只对同一详批展开', () => {
    expect(resolveVersion('bazi-full', 'default')).toBe('')
    expect(resolveVersion('bazi-full', 'v4')).toBe('bazi-full.v4')
    expect(resolveVersion('ziwei-full', 'bazi-full.v4')).toBeNull()
  })
})

describe('运行器（离线）', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('不带 --live 时只读录制、不构造模型也不发起网络请求，结果写入证据目录', async () => {
    const evidence = mkdtempSync(join(tmpdir(), 'eval-readings-'))
    dirs.push(evidence)
    cpSync(
      new URL('./fixtures/recordings/', import.meta.url).pathname,
      join(evidence, 'eval-readings/recordings'),
      { recursive: true },
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const createGenerator = vi.fn()
    const run = await runEval(parseArgs(['--kind', 'bazi-full', '--locale', 'zh-Hant']), {
      evidenceDir: evidence,
      createGenerator,
      now: () => new Date('2026-11-13T00:00:00Z'),
      log: () => {},
    })
    expect(createGenerator).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    const checked = run.outcomes.filter((o) => o.status === 'checked')
    expect(checked.map((o) => [o.sampleId, o.version])).toEqual([['bazi-hant-01', 'bazi-full.v2']])
    expect(checked[0]?.report?.checks.filter((c) => c.hard && !c.passed)).toEqual([])
    // 没有录制的样本跳过并说明
    expect(run.outcomes.find((o) => o.sampleId === 'bazi-hant-02')?.skipReason).toBe('缺少录制')
    expect(run.outDir.startsWith(evidence)).toBe(true)
    expect(readFileSync(join(run.outDir, 'summary.md'), 'utf8')).toContain('bazi-hant-01')
    expect(existsSync(join(run.outDir, 'bazi-full.v2/bazi-hant-01.check.json'))).toBe(true)
  })
})
