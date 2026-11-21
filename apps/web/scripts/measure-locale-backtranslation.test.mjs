// node --test apps/web/scripts/measure-locale-backtranslation.test.mjs（不调用真实模型）
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { sectionsFromText } from './locale-similarity.mjs'
import {
  BACKTRANSLATION_MODEL,
  BudgetLedger,
  backTranslationScore,
  buildManifest,
  cachedCaller,
  calibrate,
  calibratedThreshold,
  estimateLocaleCost,
  LOCALE_PLANS,
  measureBackTranslation,
  pickControlPages,
  scoreExternal,
  serializeSections,
  splitSections,
  writeExport,
} from './measure-locale-backtranslation.mjs'

const mk = (sections, faqCount = 0) =>
  sectionsFromText(sections.map(([t, b], i) => (i ? `@@H2@@${t}@@\n${b}` : b)).join('\n'), faqCount)

const en = mk([
  ['', 'Your life path number is a reflection prompt, not a forecast.'],
  ['How to calculate it', 'Add the digits of the birth date and reduce them to one digit.'],
  ['Frequently asked questions', 'Is 11 a master number? Yes, it is kept unreduced here.'],
])

describe('分段序列化', () => {
  test('serialize / split 往返保持段序，intro 不加标题', () => {
    const text = serializeSections(en)
    assert.match(text, /^Your life path/)
    assert.match(text, /^## How to calculate it$/m)
    const back = splitSections(text)
    assert.equal(back.length, 3)
    assert.equal(back[1], 'Add the digits of the birth date and reduce them to one digit.')
  })

  test('回译逐字一致时 Dice 为 1，改写后显著下降；FAQ 段单独给出', () => {
    const same = backTranslationScore({
      sourcePage: en,
      backText: serializeSections(en),
      sourceLocale: 'en',
    })
    assert.equal(same.dice, 1)
    assert.equal(same.faqMax, 1)
    const rewritten = backTranslationScore({
      sourcePage: en,
      backText:
        'People in Mexico often ask what their number says.\n\n## Steps\nWrite down day, month and year separately first.\n\n## FAQ\nWhy does 11 stay as it is? Because this method treats it differently.',
      sourceLocale: 'en',
    })
    assert.ok(rewritten.dice < 0.3, String(rewritten.dice))
    assert.ok(rewritten.faqMax < 0.4)
  })
})

describe('阈值与对照组', () => {
  test('阈值取 min(0.50, 中位数 − 0.20)，无对照时用默认值', () => {
    assert.equal(calibratedThreshold([0.9, 0.8, 0.85]), 0.5)
    assert.equal(calibratedThreshold([0.55, 0.6, 0.62]), 0.4)
    assert.equal(calibratedThreshold([]), 0.5)
  })

  test('对照组优先取不同类型的最长页，结果确定', () => {
    const pages = [
      { path: '/a', kind: 'tarot-card', page: mk([['', 'short']]) },
      { path: '/b', kind: 'tarot-card', page: mk([['', 'a much longer card page text']]) },
      { path: '/c', kind: 'tool', page: mk([['', 'tool page']]) },
      { path: '/d', kind: 'other', page: mk([['', 'pricing']]) },
    ]
    assert.deepEqual(
      pickControlPages(pages).map((p) => p.path),
      ['/c', '/b', '/d'],
    )
  })
})

describe('调用、缓存与预算', () => {
  const fake = (transform = (s) => s) => {
    const calls = []
    const generate = async ({ system, prompt, maxOutputTokens }) => {
      calls.push({ system, prompt, maxOutputTokens })
      return { text: transform(prompt), usage: { inputTokens: 100, outputTokens: 50 } }
    }
    return { calls, generate }
  }

  test('同一输入只调用一次（证据目录缓存），并按实际用量记账', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bt-cache-'))
    try {
      const { calls, generate } = fake()
      const ledger = new BudgetLedger(1)
      const call = cachedCaller({ generate, ledger, cacheDir: dir })
      const req = { system: 's', prompt: 'hola', fromLocale: 'es', toLocale: 'en' }
      const first = await call(req)
      const second = await call(req)
      assert.equal(calls.length, 1)
      assert.equal(second.cached, true)
      assert.equal(first.text, 'hola')
      assert.equal(readdirSync(dir).length, 1)
      const price = BACKTRANSLATION_MODEL.priceUsd
      assert.ok(
        Math.abs(ledger.spent - (100 * price.inputPerMTok + 50 * price.outputPerMTok) / 1e6) <
          1e-12,
      )
      assert.equal(ledger.reserved, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('预留超出预算时不发出调用', async () => {
    const { calls, generate } = fake()
    const ledger = new BudgetLedger(1e-9)
    const call = cachedCaller({ generate, ledger, cacheDir: null })
    const res = await call({
      system: 's',
      prompt: 'x'.repeat(1000),
      fromLocale: 'es',
      toLocale: 'en',
    })
    assert.equal(res.budgetExhausted, true)
    assert.equal(calls.length, 0)
    assert.equal(ledger.exhausted, true)
    assert.throws(() => new BudgetLedger(0))
  })

  test('校准：对照页直译再回译（假模型原样返回）得到 1.0，阈值落在默认值', async () => {
    const { calls, generate } = fake()
    const call = cachedCaller({ generate, ledger: new BudgetLedger(5), cacheDir: null })
    const pages = [
      { path: '/x', kind: 'tool', page: en },
      {
        path: '/y',
        kind: 'tarot-card',
        page: mk([['', 'The Sun card is about joy and clarity today.']]),
      },
      {
        path: '/z',
        kind: 'home',
        page: mk([['', 'Welcome to the numerology tools for everyone.']]),
      },
    ]
    const result = await calibrate({ locale: 'es', source: 'en', pages, call })
    assert.equal(calls.length, 6)
    assert.match(calls[0].system, /literally/)
    assert.match(calls[1].system, /Spanish/)
    assert.equal(result.median, 1)
    assert.equal(result.threshold, 0.5)
    assert.equal(result.temperature, 0)
  })

  test('正式测量按阈值与 FAQ 0.40 判定', async () => {
    const { generate } = fake()
    const call = cachedCaller({ generate, ledger: new BudgetLedger(5), cacheDir: null })
    const result = await measureBackTranslation({
      locale: 'es',
      source: 'en',
      threshold: 0.4,
      call,
      pairs: [{ path: '/es/x', kind: 'tool', sourcePage: en, targetPage: en }],
    })
    assert.deepEqual(result.failing[0].failures, ['page 1 > 0.4', 'FAQ 1 > 0.4'])
  })
})

describe('费用估算', () => {
  test('按对照页长度 × 系数估算，工具页取长度下限；保守口径高于典型口径', () => {
    const estimate = estimateLocaleCost({
      locale: 'es',
      plan: LOCALE_PLANS.es,
      sources: {
        en: [
          { path: '/numerology-calculator', kind: 'tool', text: 'a'.repeat(1000) },
          { path: '/tarot/cards/the-sun', kind: 'tarot-card', text: 'b'.repeat(5000) },
        ],
      },
    })
    const row = estimate.sources.en
    assert.equal(row.pages, 2)
    assert.equal(row.targetChars, 3600 + 6000)
    assert.equal(row.run.conservative.calls, 2)
    assert.equal(row.calibration.conservative.calls, 4)
    assert.ok(estimate.totals.conservative.usd > estimate.totals.typical.usd)
    assert.ok(row.run.conservative.reserveUsd >= row.run.conservative.usd)
    assert.equal(estimate.totals.conservative.calls, 6)
  })
})

describe('外部回译（--export-input / --from-file）', () => {
  test('导出清单与正文，读取外部回译后按同一公式评分并校准阈值', () => {
    const ja = mk([
      ['', 'ライフパスナンバーは予言ではなく、ふり返りのヒントです。'],
      ['計算のしかた', '生年月日の数字を足して一桁にします。'],
      ['Frequently asked questions', '11 はマスターナンバーとしてそのまま扱います。'],
    ])
    const pages = [
      { locale: 'en', path: '/life-path-number', alts: {}, kind: 'tool', page: en },
      {
        locale: 'ja',
        path: '/ja/x',
        alts: { en: 'https://example.com/life-path-number' },
        kind: 'tool',
        page: ja,
      },
    ]
    const plan = { site: 'west', sources: ['en'] }
    const manifest = buildManifest({ locale: 'ja', plan, pages })
    assert.equal(manifest.items.length, 1)
    assert.equal(manifest.calibration.length, 1)
    const dir = mkdtempSync(join(tmpdir(), 'bt-ext-'))
    try {
      writeExport(dir, manifest)
      const saved = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
      assert.equal(saved.items[0].text, undefined)
      assert.ok(readFileSync(join(dir, saved.items[0].input), 'utf8').includes('ライフパス'))
      // 缺回译时报告缺失
      let r = scoreExternal({ dir, manifest: saved, pages }).en
      assert.equal(r.missing.length, 2)
      // 对照组回译与原文相同（直译基线 1.0）；正式回译为改写过的英文
      mkdirSync(join(dir, 'calibration/en'), { recursive: true })
      writeFileSync(join(dir, saved.calibration[0].output), serializeSections(en))
      mkdirSync(join(dir, 'back/en'), { recursive: true })
      writeFileSync(
        join(dir, saved.items[0].output),
        'A hint for looking back, not a prophecy.\n\n## Calculation\nSum the birthday digits down to one.\n\n## FAQ\nWe keep 11 as is.',
      )
      r = scoreExternal({ dir, manifest: saved, pages }).en
      assert.equal(r.missing.length, 0)
      assert.equal(r.calibration.median, 1)
      assert.equal(r.calibration.threshold, 0.5)
      assert.equal(r.rows.length, 1)
      assert.equal(r.rows[0].stale, false)
      assert.ok(r.rows[0].dice < 0.5)
      assert.equal(r.failing.length, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
