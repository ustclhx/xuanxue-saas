import { AppError } from '@xuanxue/shared'
import { CARDS } from './cards.ts'
import { meanings as en } from './data/en.ts'
import { meanings as ko } from './data/ko.ts'
import { meanings as zhHant } from './data/zh-Hant.ts'
import type { DrawnCard, Locale } from './types.ts'

export { CARDS } from './cards.ts'
export { cutDeck, decodeReading, drawCards, encodeReading, shuffleDeck } from './draw.ts'
export { SPREADS, spreadPositions } from './spreads.ts'
export type * from './types.ts'
export const CARD_MEANINGS = { en, 'zh-Hant': zhHant, ko } as const

export function yesNoAnswer(card: DrawnCard, locale: Locale) {
  const definition = CARDS.find((entry) => entry.id === card.cardId)
  const meaning = CARD_MEANINGS[locale][card.cardId]
  if (!definition || !meaning) throw new AppError('INVALID_TAROT_CARD', 'Unknown card')
  const orientation = card.reversed ? 'reversed' : 'upright'
  return { answer: definition.yesNo[orientation], reason: meaning.yesNoReason[orientation] }
}
