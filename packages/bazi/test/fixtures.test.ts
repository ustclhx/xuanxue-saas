import { describe, expect, it } from 'vitest'
import { computeChart } from '../src/chart.ts'
import type { BirthInput } from '../src/input.ts'
import fixtures from './fixtures/charts.json' with { type: 'json' }
import { engineRecord, lunarRecord } from './oracle.ts'

type Fixture = {
  id: string
  input: BirthInput
  expected: ReturnType<typeof engineRecord>
  engineOnly: Record<string, unknown>
}

const cases = fixtures.cases as unknown as Fixture[]

describe('双源一致样例（tyme4ts × lunar-javascript）', () => {
  it('至少 40 个样例且没有未处理的不一致', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40)
    expect(fixtures.disagreements).toEqual([])
  })

  it.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const chart = computeChart(c.input, { referenceYear: fixtures.referenceYear })
    expect(engineRecord(chart)).toEqual(c.expected)
    // lunar-javascript 现算一次，防止 fixtures 与 oracle 漂移
    expect(lunarRecord(c.input)).toEqual(c.expected)
    expect({
      shensha: chart.shensha.map(
        (s) => `${s.key}/${s.basis}:${s.targets.join(',')}=>${s.pillars.join(',')}`,
      ),
      startAfter: chart.fortune.startAfter,
      weight: chart.weight,
      strength: chart.strength.verdict,
      favorable: chart.useful.favorable,
    }).toEqual(c.engineOnly)
  })
})
