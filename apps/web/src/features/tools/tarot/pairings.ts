import type { Card } from '@xuanxue/tarot'
// 只引用牌组清单，不引用三语牌义数据（与 meaning-routes.ts 相同）
import { CARDS } from '@xuanxue/tarot/cards'

/**
 * 牌义页「延伸牌义」的主题对应牌（使用者 2026-11-19 确认，设计稿 warm-refresh/Proposals79.dc.html C 表）：
 * 人工维护的配对表，78 张牌各一张。
 * - 大阿尔卡那按主题成对：起点与悬停（愚者 / 倒吊人）、意志与秩序（魔术师 / 皇帝）、直觉与信任
 *   （女祭司 / 星星）、生与终（皇后 / 死神）、传承与调和（教皇 / 节制）、结合与束缚（恋人 / 恶魔）、
 *   掌控与崩解（战车 / 高塔）、勇气与坦然（力量 / 太阳）、内省与暗处（隐者 / 月亮）、
 *   循环与完成（命运之轮 / 世界）、衡量与清算（正义 / 审判）。
 * - 小阿尔卡那取另一花色的同序号牌：权杖（火）与宝剑（风）互为对应，圣杯（水）与钱币（土）互为对应。
 * 配对牌不得落在同序列的前 1 张、后 2 张之内，否则 4 条链接会重复（pairings.test.ts 断言）。
 */
export const THEME_PAIRS: Readonly<Record<string, string>> = {
  'major-00': 'major-12',
  'major-01': 'major-04',
  'major-02': 'major-17',
  'major-03': 'major-13',
  'major-04': 'major-01',
  'major-05': 'major-14',
  'major-06': 'major-15',
  'major-07': 'major-16',
  'major-08': 'major-19',
  'major-09': 'major-18',
  'major-10': 'major-21',
  'major-11': 'major-20',
  'major-12': 'major-00',
  'major-13': 'major-03',
  'major-14': 'major-05',
  'major-15': 'major-06',
  'major-16': 'major-07',
  'major-17': 'major-02',
  'major-18': 'major-09',
  'major-19': 'major-08',
  'major-20': 'major-11',
  'major-21': 'major-10',
  'wands-01': 'swords-01',
  'wands-02': 'swords-02',
  'wands-03': 'swords-03',
  'wands-04': 'swords-04',
  'wands-05': 'swords-05',
  'wands-06': 'swords-06',
  'wands-07': 'swords-07',
  'wands-08': 'swords-08',
  'wands-09': 'swords-09',
  'wands-10': 'swords-10',
  'wands-11': 'swords-11',
  'wands-12': 'swords-12',
  'wands-13': 'swords-13',
  'wands-14': 'swords-14',
  'cups-01': 'pentacles-01',
  'cups-02': 'pentacles-02',
  'cups-03': 'pentacles-03',
  'cups-04': 'pentacles-04',
  'cups-05': 'pentacles-05',
  'cups-06': 'pentacles-06',
  'cups-07': 'pentacles-07',
  'cups-08': 'pentacles-08',
  'cups-09': 'pentacles-09',
  'cups-10': 'pentacles-10',
  'cups-11': 'pentacles-11',
  'cups-12': 'pentacles-12',
  'cups-13': 'pentacles-13',
  'cups-14': 'pentacles-14',
  'swords-01': 'wands-01',
  'swords-02': 'wands-02',
  'swords-03': 'wands-03',
  'swords-04': 'wands-04',
  'swords-05': 'wands-05',
  'swords-06': 'wands-06',
  'swords-07': 'wands-07',
  'swords-08': 'wands-08',
  'swords-09': 'wands-09',
  'swords-10': 'wands-10',
  'swords-11': 'wands-11',
  'swords-12': 'wands-12',
  'swords-13': 'wands-13',
  'swords-14': 'wands-14',
  'pentacles-01': 'cups-01',
  'pentacles-02': 'cups-02',
  'pentacles-03': 'cups-03',
  'pentacles-04': 'cups-04',
  'pentacles-05': 'cups-05',
  'pentacles-06': 'cups-06',
  'pentacles-07': 'cups-07',
  'pentacles-08': 'cups-08',
  'pentacles-09': 'cups-09',
  'pentacles-10': 'cups-10',
  'pentacles-11': 'cups-11',
  'pentacles-12': 'cups-12',
  'pentacles-13': 'cups-13',
  'pentacles-14': 'cups-14',
}

export type RelatedRole = 'before' | 'after' | 'after-2' | 'pair'
export interface RelatedCard {
  readonly card: Card
  readonly role: RelatedRole
}

const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]))

/**
 * 牌义页固定的 4 条延伸牌义：同序列（大牌 0–XXI）或同花色的前 1 张、后 2 张，加 1 张主题对应牌。
 * 序列首尾相接（世界之后是愚者，国王之后是王牌），每张牌因此都恰好有 4 条。
 */
export function relatedCards(card: Card): readonly RelatedCard[] {
  const sequence = CARDS.filter((other) => other.suit === card.suit).sort(
    (a, b) => a.number - b.number,
  )
  const index = sequence.findIndex((other) => other.id === card.id)
  const at = (offset: number) =>
    sequence[(index + offset + sequence.length) % sequence.length] as Card
  const pair = CARD_BY_ID.get(THEME_PAIRS[card.id] ?? '')
  return [
    { card: at(-1), role: 'before' },
    { card: at(1), role: 'after' },
    { card: at(2), role: 'after-2' },
    ...(pair ? [{ card: pair, role: 'pair' as const }] : []),
  ]
}

/**
 * 延伸牌义的锚文本表述（openspec seo-fix-tdk-links 决策 5，锚文本 ≤2 种、top1 ≤70%）：每张牌恰好被 4 张牌的
 * 延伸牌义链接；按来源牌在 CARDS 中的顺序排列，第 1、3 个来源用「<牌名> tarot card meaning」，第 2、4 个来源用
 * 与牌义索引相同的「<牌名> Tarot」（tarot_index_link）。加上索引页的 1 条，每张牌 5 条入链为 2 : 3，两种表述。
 */
const SHORT_ANCHOR = (() => {
  const inbound = new Map<string, string[]>()
  for (const source of CARDS)
    for (const { card } of relatedCards(source))
      inbound.set(card.id, [...(inbound.get(card.id) ?? []), source.id])
  const short = new Set<string>()
  for (const [target, sources] of inbound)
    sources.forEach((source, index) => {
      if (index % 2 === 1) short.add(`${source} ${target}`)
    })
  return short
})()

/** 来源牌的延伸牌义链接到目标牌时，是否用牌义索引的短表述「<牌名> Tarot」 */
export function relatedAnchorIsShort(source: Card, target: Card): boolean {
  return SHORT_ANCHOR.has(`${source.id} ${target.id}`)
}

/** 牌义索引的分组：大阿尔卡那 22 张与四个花色各 14 张，组内按序号排列 */
export const CARD_GROUPS = (['major', 'wands', 'cups', 'swords', 'pentacles'] as const).map(
  (suit) => ({
    suit,
    cards: CARDS.filter((card) => card.suit === suit).sort((a, b) => a.number - b.number),
  }),
)

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

/** 大牌的罗马数字（愚者为 0）；索引页把它放在链接之外 */
export function majorNumeral(number: number): string {
  if (number === 0) return '0'
  return `${'X'.repeat(Math.floor(number / 10))}${ROMAN[number % 10]}`
}
