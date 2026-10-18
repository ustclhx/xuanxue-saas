import { describe, expect, it } from 'vitest'
import {
  CARD_MEANINGS,
  CARDS,
  cutDeck,
  decodeReading,
  drawCards,
  encodeReading,
  SPREADS,
  shuffleDeck,
  yesNoAnswer,
} from './index.ts'

describe('RWS deck and readings', () => {
  it('provides 78 unique cards, complete localized meanings, mappings and spread positions', () => {
    expect(CARDS).toHaveLength(78)
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(78)
    expect(new Set(CARDS.map((card) => card.slug)).size).toBe(78)
    expect(CARDS.filter((card) => card.suit === 'major')).toHaveLength(22)
    for (const suit of ['wands', 'cups', 'swords', 'pentacles'])
      expect(CARDS.filter((card) => card.suit === suit)).toHaveLength(14)
    for (const locale of ['en', 'zh-Hant', 'ko'] as const) {
      expect(Object.keys(CARD_MEANINGS[locale])).toHaveLength(78)
      for (const card of CARDS) {
        const meaning = CARD_MEANINGS[locale][card.id]
        expect(meaning?.name).toBeTruthy()
        expect(meaning?.keywords.length).toBeGreaterThan(0)
        for (const orientation of ['upright', 'reversed'] as const) {
          expect(meaning?.[orientation]).toBeTruthy()
          expect(['Yes', 'No', 'Maybe']).toContain(card.yesNo[orientation])
          expect(meaning?.yesNoReason[orientation]).toContain(card.yesNo[orientation])
        }
      }
      expect(Object.values(SPREADS).map((spread) => spread.positions[locale].length)).toEqual([
        1, 1, 3, 10,
      ])
      for (const spread of Object.values(SPREADS))
        for (const position of spread.positions[locale]) {
          expect(position.name).toBeTruthy()
          expect(position.meaning).toBeTruthy()
        }
    }
    expect(yesNoAnswer({ cardId: 'major-19', reversed: false }, 'en')).toMatchObject({
      answer: 'Yes',
    })
  })
  it('cuts by the chosen position without mutating the deck and draws unique cards with reversals off', () => {
    const deck = shuffleDeck(false)
    const cut = cutDeck(deck, 17)
    expect(cut).toEqual([...deck.slice(17), ...deck.slice(0, 17)])
    const reading = drawCards('celtic-cross', cut)
    expect(new Set(reading.cards.map((card) => card.cardId)).size).toBe(10)
    expect(reading.cards.every((card) => !card.reversed)).toBe(true)
    expect(drawCards('three-card', cut, [7, 3, 0]).cards).toEqual([cut[7], cut[3], cut[0]])
    expect(() => drawCards('three-card', cut, [0, 0, 1])).toThrow()
    expect(() => cutDeck(deck, 78)).toThrow()
  })
  it('round-trips all spreads and rejects invalid shared results', () => {
    for (const spread of Object.keys(SPREADS) as (keyof typeof SPREADS)[]) {
      const reading = drawCards(spread, shuffleDeck())
      expect(decodeReading(encodeReading(reading))).toEqual(reading)
    }
    expect(
      decodeReading('three-card:major-00r,cups-01,swords-14r').cards.map((card) => card.reversed),
    ).toEqual([true, false, true])
    for (const encoded of [
      'unknown:major-00',
      'daily:major-99',
      'daily:major-00,major-01',
      'three-card:major-00,major-00,major-01',
      'daily:major-00rr',
      'daily:major-00:<script>',
      'x'.repeat(257),
    ])
      expect(() => decodeReading(encoded)).toThrow()
  })
  it('keeps every card within 5% of expected frequency over 100,000 ten-card draws', () => {
    // 每次抽十張，期望頻數約 12,821；避免單張抽取的正常噪聲使 5% 門檻不穩定。
    const counts = new Map(CARDS.map((card) => [card.id, 0]))
    let reversed = 0
    const runs = 100_000
    for (let i = 0; i < runs; i++) {
      const { cards } = drawCards('celtic-cross', shuffleDeck())
      for (const card of cards) {
        counts.set(card.cardId, (counts.get(card.cardId) as number) + 1)
        if (card.reversed) reversed++
      }
    }
    const expected = (runs * 10) / 78
    const maxDeviation = Math.max(
      ...[...counts.values()].map((count) => Math.abs(count - expected) / expected),
    )
    expect(maxDeviation).toBeLessThan(0.05)
    expect(reversed / (runs * 10)).toBeGreaterThan(0.49)
    expect(reversed / (runs * 10)).toBeLessThan(0.51)
  }, 30_000)
})
