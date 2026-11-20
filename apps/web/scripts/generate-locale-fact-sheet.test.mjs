// node --test apps/web/scripts/generate-locale-fact-sheet.test.mjs
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { lifePath } from '@xuanxue/numerology'
import {
  assertNoSourceText,
  baziFacts,
  cardName,
  loadGlossary,
  pagesFor,
  renderFactSheet,
  sampleDatesFor,
  sourceSentences,
} from './generate-locale-fact-sheet.mjs'

const ja = loadGlossary('ja')
const es = loadGlossary('es')
const page = (locale, id) => pagesFor(locale).find((p) => p.id === id)

describe('页面清单与牌名', () => {
  test('第一期页面：es 含 7 个工具、12 个数字页与 78 张牌；ja 含四柱推命、紫微与 78 张牌', () => {
    const esPages = pagesFor('es')
    assert.equal(esPages.filter((p) => p.kind === 'tool').length, 7)
    assert.equal(esPages.filter((p) => p.kind === 'numerology-number').length, 12)
    assert.equal(esPages.filter((p) => p.kind === 'tarot-card').length, 78)
    const jaPages = pagesFor('ja')
    assert.deepEqual(
      jaPages.filter((p) => p.kind === 'tool').map((p) => p.path),
      ['/ja/四柱推命', '/ja/紫微斗数'],
    )
    assert.equal(page('ja', 'card:the-sun').path, '/ja/タロット/カード/the-sun')
    assert.equal(page('es', 'tarot:yes-or-no').path, '/es/tarot/si-o-no')
  })

  test('牌名取术语表：大阿尔卡那按术语，小阿尔卡那按 cardName 组合', () => {
    assert.equal(cardName(ja, page('ja', 'card:the-sun').card), '太陽')
    assert.equal(cardName(es, page('es', 'card:ace-of-pentacles').card), 'As de Oros')
    assert.equal(cardName(ja, page('ja', 'card:page-of-cups').card), 'カップのペイジ')
    assert.equal(cardName(es, page('es', 'card:queen-of-swords').card), 'Reina de Espadas')
  })
})

describe('引擎事实', () => {
  test('候选示例日期经引擎复算等于该数（含大师数）', () => {
    for (const n of [1, 7, 11, 22, 33]) {
      const dates = sampleDatesFor(n)
      assert.ok(dates.length > 0, String(n))
      for (const d of dates) {
        const [year, month, day] = d.split('-').map(Number)
        assert.equal(lifePath({ year, month, day }).value, n, d)
      }
    }
  })

  test('四柱推命示例：东京 1950 年サマータイム按钟表减 1 小时，通变星用术语表写法', () => {
    const facts = baziFacts(
      { date: '1950-06-15', time: '10:30', city: 'tokyo', gender: 'female' },
      ja,
    )
    assert.equal(facts.dst, true)
    assert.equal(facts.used, '1950-06-15 09:30')
    assert.match(facts.pillars, /^year=庚寅 month=壬午 day=辛巳/)
    assert.match(facts.tenGods, /劫財/)
    assert.doesNotMatch(facts.tenGods, /jieCai/)
  })
})

describe('事实单', () => {
  const fixed = new Date('2026-11-20T00:00:00Z')

  test('牌义页：含固定关键词、是或否倾向、术语、合规与锚文本，没有未替换的占位符', () => {
    const sheet = renderFactSheet({
      locale: 'es',
      page: page('es', 'card:the-sun'),
      glossary: es,
      now: fixed,
    })
    assert.match(sheet, /# 写作事实单：El Sol/)
    assert.match(sheet, /固定关键词（正位）\*\*：joy, clarity/)
    assert.match(sheet, /al derecho Yes/)
    assert.match(sheet, /\| Pentacles \| Oros \|/)
    assert.match(sheet, /no predice el futuro/)
    assert.match(sheet, /指向本页时的锚文本：「\{card\}」/)
    assert.doesNotMatch(sheet, /\{\{\w+\}\}/)
  })

  test('事实单不含源语言正文；混入一句正文即报错', () => {
    const p = page('es', 'card:the-sun')
    const sentences = sourceSentences(p, 'es')
    assert.ok(sentences.length > 10, '应读到英文牌义正文句子用于核对')
    const sheet = renderFactSheet({ locale: 'es', page: p, glossary: es, now: fixed })
    assertNoSourceText(sheet, sentences)
    assert.throws(() => assertNoSourceText(`${sheet}\n${sentences[3]}`, sentences), /源语言正文/)
  })

  test('ja 工具页与数字页事实单可生成', () => {
    const shichu = renderFactSheet({
      locale: 'ja',
      page: page('ja', 'tool:shichu'),
      glossary: ja,
      now: fixed,
    })
    assert.match(shichu, /サマータイム示例/)
    assert.match(shichu, /\| Ten Gods \| 通変星 \|/)
    const seven = renderFactSheet({
      locale: 'es',
      page: page('es', 'number:7'),
      glossary: es,
      now: fixed,
    })
    assert.match(seven, /challenging 6、33/)
    assert.match(seven, /--compute life-path/)
  })
})
