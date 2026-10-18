export type Locale = 'en' | 'zh-Hant' | 'ko'
export type Suit = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles'
export type Answer = 'Yes' | 'No' | 'Maybe'
export interface Card {
  id: string
  slug: string
  suit: Suit
  number: number
  image: { small: string; large: string }
  yesNo: { upright: Answer; reversed: Answer }
}
export interface CardMeaning {
  name: string
  keywords: readonly string[]
  upright: string
  reversed: string
  yesNoReason: { upright: string; reversed: string }
}
export interface Position {
  name: string
  meaning: string
}
export type SpreadId = 'daily' | 'yes-or-no' | 'three-card' | 'celtic-cross'
export interface Spread {
  id: SpreadId
  positions: Record<Locale, readonly Position[]>
}
export interface DrawnCard {
  cardId: string
  reversed: boolean
}
export interface Reading {
  spread: SpreadId
  cards: DrawnCard[]
}
