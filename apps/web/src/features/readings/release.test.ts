import { describe, expect, it } from 'vitest'
import {
  READING_EVAL_PENDING,
  readingDefinition,
  readingEvalPassed,
  readingMessages,
  readingPromptVersions,
} from './catalog.ts'
import { checkCompliance } from './compliance.ts'
import { followUpQuestions } from './follow-up-questions.ts'
import { readingSite } from './release.ts'

// add-locales-eu-ja 5b.3：东方站根路径英文的八字 / 紫微详批，与按「类型 × 语言」判定的所属站点

const NOW = new Date('2026-11-21T00:00:00Z')
const BIRTH = {
  calendar: 'solar',
  year: 1991,
  month: 3,
  day: 9,
  time: { hour: 14, minute: 20 },
  gender: 'female',
  location: { city: 'taipei' },
} as const

describe('详批的所属站点', () => {
  it('东方站与西方站共用 en：八字 / 紫微属东方站，数字命理属西方站，塔罗按语言归属', () => {
    expect(readingSite('bazi-full', 'en')).toBe('east')
    expect(readingSite('ziwei-full', 'en')).toBe('east')
    expect(readingSite('bazi-full', 'zh-Hant')).toBe('east')
    expect(readingSite('saju-full', 'ko')).toBe('east')
    expect(readingSite('numerology-full', 'en')).toBe('west')
    expect(readingSite('tarot-spread', 'en')).toBe('west')
    expect(readingSite('tarot-spread', 'zh-Hans')).toBe('east')
    expect(readingSite('tarot-spread', 'xx')).toBeUndefined()
  })
})

describe('评测门槛', () => {
  it('东方站英文八字与紫微待真实评测（READING_EVAL_PENDING）：不出售；其余组合照常', () => {
    expect(READING_EVAL_PENDING.has('bazi-full.en')).toBe(true)
    expect(READING_EVAL_PENDING.has('ziwei-full.en')).toBe(true)
    expect(readingEvalPassed('bazi-full', 'en')).toBe(false)
    expect(readingEvalPassed('ziwei-full', 'en')).toBe(false)
    expect(readingEvalPassed('bazi-full', 'zh-Hant')).toBe(true)
    // 西方站英文与东方站英文共用 `en`，门槛按「类型 × 语言」区分，西方站不受影响
    expect(readingEvalPassed('numerology-full', 'en')).toBe(true)
    expect(readingEvalPassed('tarot-spread', 'en')).toBe(true)
  })
})

describe('东方站英文提示词（v4 的英文）', () => {
  const cases = [
    { kind: 'bazi-full', years: 'annual', terms: ['Day Master', 'Seven Killings', 'Luck Pillar'] },
    {
      kind: 'ziwei-full',
      years: 'horoscope',
      terms: ['Life Palace', 'Body Palace', 'Hua Ji', 'Tian Ji'],
    },
  ] as const

  for (const item of cases)
    it(`${item.kind}：注册为 v4 的英文，已有语言的 v4 不变；章节、就医提示、数据档与术语`, () => {
      const definition = readingDefinition(item.kind, 'en')
      if (!definition) throw new Error('definition missing')
      expect(readingDefinition(item.kind)?.prompt.version).not.toBe(definition.prompt.version)
      expect(
        readingPromptVersions(item.kind).find((v) => v.version === `${item.kind}.v4`)?.locales,
        // 日语（main 的 ja 变体）同样只有 v4 一代
      ).toEqual(['en', 'ja', 'zh-Hant', 'zh-Hans'])
      const { system, sections } = definition.prompt
      for (const title of sections) expect(system).toContain(`## ${title}`)
      expect(sections).toContain(definition.healthSection?.title)
      expect(system).toContain(definition.healthSection?.notice)
      for (const term of item.terms) expect(system).toContain(term)
      expect(system).toContain('does not predict the future')
      expect(system).toContain('entertainment or always accurate')
      expect(system).toContain('Do not use the word guarantee in any form')
      // 逐年标题保留汉字干支，guard.ts 的年份兜底与评测的数据一致检查依赖它
      expect(system).toContain('### 2026 丙午 · Bing Wu')
      const recomputed = definition.recompute(BIRTH, NOW)
      const [systemMessage, user] = readingMessages(definition, recomputed)
      expect(systemMessage?.text).not.toMatch(/1991|taipei/)
      const chart = JSON.parse(user?.text ?? '{}').chart
      const years = item.years === 'annual' ? chart.annual.years : chart.horoscope.years
      expect(years.map((y: { year: number }) => y.year)).toEqual([2026, 2027, 2028, 2029, 2030])
    })

  it('声明写明传统规则、仅供参考与自我反思、不预测未来；样例通过合规检查；有英文开场问题', () => {
    for (const kind of ['bazi-full', 'ziwei-full']) {
      const definition = readingDefinition(kind, 'en')
      if (!definition) throw new Error('definition missing')
      expect(definition.disclaimer).toMatch(/traditional rules/)
      expect(definition.disclaimer).toMatch(/reference and self-reflection only/)
      expect(definition.disclaimer).toMatch(/does not predict the future/)
      for (const text of [definition.disclaimer, definition.sample])
        expect(text).not.toMatch(/entertainment|guaranteed|always accurate/i)
      expect(checkCompliance(definition.sample, 'en').violations).toEqual([])
      expect(followUpQuestions(kind, 'en')[0]).toMatch(
        kind === 'bazi-full' ? /Day Master/ : /Life Palace/,
      )
    }
  })
})
