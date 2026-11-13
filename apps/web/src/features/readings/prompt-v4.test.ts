import { describe, expect, it } from 'vitest'
import { readingDefinition, readingMessages } from './catalog.ts'
import { checkCompliance } from './compliance.ts'

// readings-prompt-v4-yearly tasks.md 3.2–3.4：v4 章节表、数据档与 system 固定前缀。
const NOW = new Date('2026-10-19T00:00:00Z')
const BIRTH = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 17,
  time: { hour: 8, minute: 30 },
  gender: 'female',
  location: { city: 'taipei' },
} as const

const cases = [
  { kind: 'bazi-full', locale: 'zh-Hant', annual: '流年逐年', input: BIRTH, years: 'annual' },
  { kind: 'bazi-full', locale: 'zh-Hans', annual: '流年逐年', input: BIRTH, years: 'annual' },
  { kind: 'saju-full', locale: 'ko', annual: '연도별 세운', input: BIRTH, years: 'annual' },
  { kind: 'ziwei-full', locale: 'zh-Hant', annual: '大限與流年', input: BIRTH, years: 'horoscope' },
  { kind: 'ziwei-full', locale: 'zh-Hans', annual: '大限与流年', input: BIRTH, years: 'horoscope' },
  {
    kind: 'numerology-full',
    locale: 'en',
    annual: 'Year by Year',
    input: { year: 1987, month: 11, day: 29 },
    years: 'personalYears',
  },
] as const

describe('v4 提示词', () => {
  for (const item of cases)
    it(`${item.kind}（${item.locale}）`, () => {
      const v4 = readingDefinition(item.kind, item.locale, { promptVersion: `${item.kind}.v4` })
      const current = readingDefinition(item.kind, item.locale)
      if (!v4 || !current) throw new Error('definition missing')
      expect(v4.prompt.version).toBe(`${item.kind}.v4`)
      // 默认版本未变：上线前线上仍用 v2/v3
      expect(current.prompt.version).not.toBe(v4.prompt.version)
      expect(v4.prompt.sections).toContain(item.annual)
      if (v4.healthSection) {
        expect(v4.prompt.sections).toContain(v4.healthSection.title)
        expect(v4.prompt.system).toContain(v4.healthSection.notice.replace(/[。.]$/, ''))
      }
      for (const title of v4.prompt.sections) expect(v4.prompt.system).toContain(`## ${title}`)
      // system 是固定前缀，不含用户数据；用户消息才带逐年数据
      const recomputed = v4.recompute(item.input, NOW)
      const [system, user] = readingMessages(v4, recomputed)
      expect(system?.text).not.toMatch(/1987|1990|taipei/)
      const chart = JSON.parse(user?.text ?? '{}').chart
      const years =
        item.years === 'annual'
          ? chart.annual.years
          : item.years === 'horoscope'
            ? chart.horoscope.years
            : chart.personalYears
      expect(years.map((y: { year: number }) => y.year)).toEqual([2026, 2027, 2028, 2029, 2030])
      // 解锁卡样例段落与语言绑定，切换版本后仍通过合规检查
      expect(checkCompliance(v4.sample, item.locale).violations).toEqual([])
    })
})
