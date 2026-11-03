import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyPrimarySite, collectPreflight } from './split-accounts-preflight.mjs'

test('report totals choose the majority before payment and user locale evidence', () => {
  for (const [reports, site] of [
    [
      { 'bazi-full': 1, 'ziwei-full': 1, 'saju-full': 1, 'saju-compat': 1, 'numerology-full': 3 },
      'east',
    ],
    [{ 'bazi-full': 1, 'numerology-full': 2 }, 'west'],
  ]) {
    assert.deepEqual(
      classifyPrimarySite({
        reports,
        payments: [{ locale: site === 'east' ? 'en-US' : 'zh-TW' }],
        locale: site === 'east' ? 'en' : 'ko',
      }),
      { site, rule: 1, bothSitesActive: true },
    )
  }
})

test('positive report ties choose west and flag activity on both sites', () => {
  assert.deepEqual(
    classifyPrimarySite({ reports: { 'bazi-full': 2, 'numerology-full': 2 }, locale: 'ko' }),
    { site: 'west', rule: 1, bothSitesActive: true },
  )
})

test('zero report totals and tarot counts leave payment evidence available', () => {
  assert.deepEqual(
    classifyPrimarySite({
      reports: { 'bazi-full': 0, 'numerology-full': 0, 'tarot-spread': 100 },
      payments: [{ description: 'Ganjiday' }],
      locale: 'en',
    }),
    { site: 'east', rule: 2, bothSitesActive: false },
  )
})

test('payment locales and brand descriptions take priority over user locale', () => {
  for (const [payment, site] of [
    [{ locale: 'en-US' }, 'west'],
    [{ locale: 'zh-TW' }, 'east'],
    [{ locale: 'zh-CN' }, 'east'],
    [{ locale: 'ko-KR' }, 'east'],
    [{ description: 'Arcanumber credits' }, 'west'],
    [{ description: 'Ganjiday credits' }, 'east'],
    [{ description: '干支日积分' }, 'east'],
    [{ description: '간지데이 크레딧' }, 'east'],
  ]) {
    assert.deepEqual(
      classifyPrimarySite({ payments: [payment], locale: site === 'east' ? 'en' : 'ko' }),
      { site, rule: 2, bothSitesActive: false },
      JSON.stringify(payment),
    )
  }
})

test('conflicting payment evidence remains unresolved instead of falling through', () => {
  for (const payments of [
    [{ locale: 'en-US' }, { description: '干支日' }],
    [{ locale: 'en-US', description: 'Ganjiday' }],
  ]) {
    assert.deepEqual(classifyPrimarySite({ payments, locale: 'ko' }), {
      site: null,
      rule: 2,
      bothSitesActive: false,
    })
  }
})

test('user locale supplies rule 3 and absent recognized evidence defaults west at rule 4', () => {
  for (const [locale, site, rule] of [
    ['zh-Hant', 'east', 3],
    ['zh-Hans', 'east', 3],
    ['ko', 'east', 3],
    ['en', 'west', 3],
    ['fr', 'west', 4],
    [null, 'west', 4],
  ]) {
    assert.deepEqual(
      classifyPrimarySite({
        reports: { 'tarot-spread': 3 },
        payments: [{ description: 'Generic credits' }],
        locale,
      }),
      { site, rule, bothSitesActive: false },
    )
  }
})

test('permission denial restores the savepoint and reports unavailable counts as null', async () => {
  const statements = []
  const report = await collectPreflight({
    async unsafe(statement) {
      statements.push(statement)
      if (statement.includes('FROM public.reading')) {
        throw Object.assign(new Error('permission denied'), { code: '42501' })
      }
      if (statement.includes('count(*)::int AS count')) {
        return [{ count: 0, amountTotal: '0', remainingTotal: '0', activeRemainingTotal: '0' }]
      }
      if (statement.includes('sum(delta)')) return [{ total: '0' }]
      return []
    },
  })
  const deniedIndex = statements.findIndex((statement) => statement.includes('FROM public.reading'))
  assert.deepEqual(statements.slice(deniedIndex + 1, deniedIndex + 3), [
    'ROLLBACK TO SAVEPOINT preflight_item',
    'RELEASE SAVEPOINT preflight_item',
  ])
  assert.deepEqual(report.skipped, [{ item: 'readings', code: '42501' }])
  assert.equal(report.complete, false)
  assert.equal(report.primarySites, null)
  assert.equal(report.baseline.reportsByKind, null)
  assert.equal(report.baseline.payments, 0)
})
