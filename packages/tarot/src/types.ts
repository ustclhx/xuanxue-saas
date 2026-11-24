export type Locale = 'en' | 'zh-Hant' | 'zh-Hans' | 'ko' | 'es' | 'ja'
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
/**
 * 主题牌阵（content-growth-v2-tools 第 28 组）：只在西方站 en 提供的爱情、事业与满月牌阵。
 * 包里只登记牌数（抽牌与分享校验用）；牌位名称与说明是逐页文案，在 apps/web 的内容集合里。
 */
export type TopicSpreadId = 'love' | 'career' | 'full-moon'
export type AnySpreadId = SpreadId | TopicSpreadId
export interface Spread {
  id: SpreadId
  positions: Record<Locale, readonly Position[]>
}
export interface DrawnCard {
  cardId: string
  reversed: boolean
}
export interface Reading<S extends AnySpreadId = SpreadId> {
  spread: S
  cards: DrawnCard[]
}
