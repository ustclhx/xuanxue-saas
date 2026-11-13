import type { JsonValue } from '@xuanxue/db'
import { describe, expect, it } from 'vitest'
import { subjectSystemContextSchema, subjectSystemText } from '../ai/subject-context.ts'
import { readingDefinition } from './catalog.ts'
import { checkCompliance } from './compliance.ts'
import {
  FOLLOW_UP_QUESTION_TABLE,
  followUpQuestions,
  GENERIC_FOLLOW_UP_QUESTIONS,
} from './follow-up-questions.ts'
import { CHART_RESULT_CONTEXT_VERSION, chartResultContext, chartResultTitle } from './subjects.ts'

// adopt-subject-chat-readings tasks.md 2.1、2.3：开场推荐问题齐全且合规；chart-result 上下文
// 通过模板的格式校验、保留合规边界，且不含姓名与出生字段。
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

const definition = (kind: string, locale?: string) => {
  const found = readingDefinition(kind, locale)
  if (!found) throw new Error(`${kind} missing`)
  return found
}

describe('followUpQuestions', () => {
  const kinds = Object.keys(FOLLOW_UP_QUESTION_TABLE)

  it('详批注册表中每个 kind × locale 都有 3 条、≤ 200 字且通过合规检查的问题', () => {
    for (const kind of kinds) {
      for (const locale of definition(kind).locales) {
        const questions = followUpQuestions(kind, locale)
        expect(questions, `${kind} ${locale}`).toBe(
          FOLLOW_UP_QUESTION_TABLE[kind as 'bazi-full'][locale],
        )
        expect(questions).toHaveLength(3)
        for (const question of questions) {
          expect(question.length).toBeLessThanOrEqual(200)
          expect(checkCompliance(question, locale).violations, question).toEqual([])
        }
      }
    }
  })

  it('该类型没有页面语言时用该语言的通用问题，未知语言用英文', () => {
    for (const [locale, questions] of Object.entries(GENERIC_FOLLOW_UP_QUESTIONS)) {
      expect(questions).toHaveLength(3)
      for (const question of questions)
        expect(checkCompliance(question, locale).violations).toEqual([])
    }
    expect(followUpQuestions('bazi-full', 'en')).toBe(GENERIC_FOLLOW_UP_QUESTIONS.en)
    expect(followUpQuestions('numerology-full', 'ko')).toBe(GENERIC_FOLLOW_UP_QUESTIONS.ko)
    expect(followUpQuestions('unknown', 'fr')).toBe(GENERIC_FOLLOW_UP_QUESTIONS.en)
  })
})

describe('chartResultContext', () => {
  const cases: [string, string, unknown][] = [
    ['bazi-full', 'zh-Hant', BIRTH],
    ['ziwei-full', 'zh-Hans', BIRTH],
    [
      'tarot-spread',
      'en',
      { reading: 'three-card:major-00,major-01r,major-02', question: 'Work?' },
    ],
  ]

  it.each(cases)(
    '%s：通过 subjectSystemContextSchema，只含 { kind, result }，不含姓名与出生字段',
    (kind, locale, input) => {
      const recomputed = definition(kind, locale).recompute(
        { ...(input as object), name: 'Alice Wang' },
        NOW,
      )
      const result = JSON.parse(JSON.stringify(recomputed.result)) as Record<string, JsonValue>
      const context = chartResultContext(kind, result)
      expect(subjectSystemContextSchema.safeParse(context).success).toBe(true)
      expect(context.version).toBe(CHART_RESULT_CONTEXT_VERSION)
      expect(Object.keys(context.data as object)).toEqual(['kind', 'result'])
      const text = subjectSystemText('chart-result', context)
      expect(text).toMatch(/^\[context type=chart-result version=chart-result-v1\]/)
      expect(text).toContain('do not predict specific events')
      expect(text).toContain('Reply in the language the user writes in.')
      for (const leaked of [
        'Alice',
        'taipei',
        '1990-05-17',
        '"day":17',
        '"month":5',
        '"calendar"',
        '"location"',
      ])
        expect(text, leaked).not.toContain(leaked)
    },
  )

  it('标题为「类型 · 关键结论」，不超过 200 字符', () => {
    const recomputed = definition('bazi-full', 'zh-Hant').recompute(BIRTH, NOW)
    const result = JSON.parse(JSON.stringify(recomputed.result)) as Record<string, JsonValue>
    const title = chartResultTitle('bazi-full', result, 'zh-Hant')
    expect(title).toMatch(/^完整命盤分析 · \S{2} · \S{2} · \S{2} · \S{2}$/)
    const long = chartResultTitle('tarot-spread', { cards: [], question: 'x'.repeat(500) }, 'en')
    expect(long.length).toBeLessThanOrEqual(200)
  })
})
