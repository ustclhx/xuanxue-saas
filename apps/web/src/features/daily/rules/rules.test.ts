import { readFileSync } from 'node:fs'
import { TEN_GODS } from '@xuanxue/bazi'
import { describe, expect, it } from 'vitest'
import { EN_RULES } from './en.ts'
import { KO_RULES } from './ko.ts'
import { DAILY_COPY_VERSION, DAILY_NUMBERS, type EastRules, HIDDEN_TABOOS } from './types.ts'
import { ZH_HANS_RULES } from './zh-Hans.ts'
import { ZH_HANT_RULES } from './zh-Hant.ts'

/**
 * 每日文案合规检查（daily-horoscope spec「每日内容合规」，tasks 7.1）：
 * 不提 AI，不写吉凶断语，不给医疗、投资、法律方面的确定性建议，不预测具体事件。
 */
const BLOCKLIST = [
  /\bAI\b/i,
  /人工智[慧能]/,
  /인공지능/,
  // 吉凶断语
  /大吉|大凶|凶日|吉日|吉利|不吉|血光|災|灾|破財|破财|厄運|厄运/,
  /대길|대흉|흉일|길일|재앙|액운/,
  /\b(lucky|unlucky|doom|disaster|misfortune|curse)\b/i,
  // 确定性预测
  /一定會|一定会|必定|必然|保證|保证/,
  /반드시|틀림없이|보장/,
  /\b(will happen|guarantee[sd]?|certainly will|destined)\b/i,
  // 医疗、投资、法律
  /投資|投资|股票|基金|診斷|诊断|治療|治疗|藥物|药物|官司|訴訟|诉讼/,
  /투자|주식|진단|치료|약물|소송/,
  /\b(invest|stocks?|diagnos\w*|cure|medication|lawsuit|sue)\b/i,
]

function eastTexts(rules: EastRules): string[] {
  return [
    ...Object.values(rules.tenGod).flatMap((tips) =>
      tips.flatMap((tip) => [tip.theme, tip.advice, tip.caution]),
    ),
    ...Object.values(rules.tenGodKeyword),
    ...Object.values(rules.relation).flat(),
    ...rules.noRelation,
    ...Object.values(rules.duty).flatMap((duty) => [duty.name, duty.gloss]),
    ...Object.values(rules.tabooGloss).filter((text): text is string => Boolean(text)),
    ...rules.taboo.filter((_, index) => !HIDDEN_TABOOS.has(index)),
  ]
}

const EAST = [ZH_HANT_RULES, ZH_HANS_RULES, KO_RULES]

describe('东方站规则文案', () => {
  it.each(EAST)(
    '$locale：十神各 3 条以上，关系各 2 条以上，建除 12 项，宜忌词条 140 项',
    (rules) => {
      for (const god of TEN_GODS) expect(rules.tenGod[god].length).toBeGreaterThanOrEqual(3)
      for (const lines of Object.values(rules.relation))
        expect(lines.length).toBeGreaterThanOrEqual(2)
      for (const lines of Object.values(rules.relation))
        for (const line of lines) expect(line).toContain('{pillar}')
      expect(Object.keys(rules.duty)).toHaveLength(12)
      expect(rules.taboo).toHaveLength(140)
    },
  )

  it.each(EAST)('$locale：通过合规黑名单', (rules) => {
    for (const text of eastTexts(rules))
      for (const pattern of BLOCKLIST) expect(text, `${pattern}`).not.toMatch(pattern)
  })

  it('繁简宜忌词条逐项对应（下标即 tyme4ts Taboo 序号）', () => {
    expect(ZH_HANS_RULES.taboo[0]).toBe('祭祀')
    expect(ZH_HANS_RULES.taboo[113]).toBe('移徙')
    expect(ZH_HANT_RULES.taboo[46]).toBe('動土')
    expect(KO_RULES.taboo[113]).toBe('이사')
  })
})

describe('西方站规则文案', () => {
  it('1–9、11、22 各有关键词、至少 2 条个人日与宇宙日文案，并通过合规黑名单', () => {
    for (const number of DAILY_NUMBERS) {
      const entry = EN_RULES.number[number]
      expect(entry.personal.length).toBeGreaterThanOrEqual(2)
      expect(entry.universal.length).toBeGreaterThanOrEqual(2)
      const texts = [
        entry.keyword,
        ...entry.universal,
        ...entry.personal.flatMap((tip) => [tip.theme, tip.advice, tip.caution]),
      ]
      for (const text of texts)
        for (const pattern of BLOCKLIST) expect(text, `${number} ${pattern}`).not.toMatch(pattern)
    }
  })
})

describe('页面文案', () => {
  it('免费页面的文案不提 AI（只有今日面板的问 AI 入口与说明属于 Chat 场景）', () => {
    for (const locale of ['zh-Hant', 'zh-Hans', 'ko', 'en']) {
      const messages = JSON.parse(
        readFileSync(new URL(`../../../../messages/${locale}/daily.json`, import.meta.url), 'utf8'),
      ) as Record<string, string>
      for (const [key, text] of Object.entries(messages)) {
        if (key.startsWith('$') || key.startsWith('daily_panel_ask_ai')) continue
        expect(text, `${locale} ${key}`).not.toMatch(/\bAI\b/)
      }
    }
  })

  it('文案表带版本号', () => {
    expect(DAILY_COPY_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
