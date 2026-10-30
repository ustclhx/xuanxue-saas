import { describe, expect, it } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { contextSummary } from './chat-context-summary.ts'

const bazi = {
  kind: 'bazi-full',
  result: {
    pillars: {
      year: { stem: 'jia', branch: 'zi' },
      month: { stem: 'bing', branch: 'yin' },
      day: { stem: 'wu', branch: 'chen' },
      hour: null,
    },
  },
}

describe('contextSummary', () => {
  it('八字显示四柱干支，时辰未知显示占位', () => {
    expect(contextSummary(bazi, 'zh-Hant')).toEqual([
      { label: m.ai_chat_context_pillars(), value: '甲子 · 丙寅 · 戊辰 · —' },
    ])
    expect(contextSummary(bazi, 'ko')[0]?.value).toBe('갑자 · 병인 · 무진 · —')
  })

  it('塔罗显示牌名与逆位，数字命理显示生命灵数', () => {
    const tarot = contextSummary(
      {
        kind: 'tarot-spread',
        result: {
          question: 'Career?',
          cards: [
            { card: 'The Fool', reversed: false },
            { card: 'The Tower', reversed: true },
          ],
        },
      },
      'en',
    )
    expect(tarot[0]?.value).toBe(`The Fool · ${m.ai_chat_context_reversed({ card: 'The Tower' })}`)
    expect(tarot[1]?.value).toBe('Career?')
    const numerology = contextSummary(
      {
        kind: 'numerology-full',
        result: {
          lifePath: { value: 11, master: true },
          personalYear: { value: 3, master: false },
        },
      },
      'en',
    )
    expect(numerology.map((item) => item.value)).toEqual(['11', '3'])
  })

  it('结构不符时不显示条目', () => {
    expect(contextSummary({ kind: 'bazi-full', result: { pillars: 'x' } }, 'en')).toEqual([])
  })
})
