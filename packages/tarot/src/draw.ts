import { AppError } from '@xuanxue/shared'
import { CARDS } from './cards.ts'
import { SPREADS } from './spreads.ts'
import type { DrawnCard, Reading, SpreadId } from './types.ts'

const cardIds = new Set(CARDS.map((card) => card.id))
function invalid(message: string): never {
  throw new AppError('INVALID_TAROT_READING', message)
}
// 每次洗牌批量取随机数；拒绝落在不整除区间的值，避免取模偏差。
function randomSource() {
  const pool = new Uint32Array(128)
  let cursor = pool.length
  return (bound: number) => {
    const limit = 0x100000000 - (0x100000000 % bound)
    let value: number
    do {
      if (cursor === pool.length) {
        crypto.getRandomValues(pool)
        cursor = 0
      }
      value = pool[cursor++] as number
    } while (value >= limit)
    return value % bound
  }
}

export function shuffleDeck(reversals = true): DrawnCard[] {
  const random = randomSource()
  const deck = CARDS.map((card) => ({ cardId: card.id, reversed: reversals && random(2) === 1 }))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = random(i + 1)
    const current = deck[i] as DrawnCard
    deck[i] = deck[j] as DrawnCard
    deck[j] = current
  }
  return deck
}

export function cutDeck(deck: readonly DrawnCard[], position: number): DrawnCard[] {
  if (!Number.isInteger(position) || position < 0 || position >= deck.length)
    invalid('Invalid cut position')
  return [...deck.slice(position), ...deck.slice(0, position)]
}

function validate(reading: Reading): Reading {
  if (!Object.hasOwn(SPREADS, reading.spread)) invalid('Unknown spread')
  const count = SPREADS[reading.spread].positions.en.length
  if (reading.cards.length !== count) invalid('Incorrect card count')
  const seen = new Set<string>()
  for (const card of reading.cards) {
    if (!cardIds.has(card.cardId) || typeof card.reversed !== 'boolean' || seen.has(card.cardId))
      invalid('Invalid or duplicate card')
    seen.add(card.cardId)
  }
  return reading
}

// 页面可传入洗牌/切牌后的牌堆，再传入用户点选的位置；默认从顶端抽取。
export function drawCards(
  spread: SpreadId,
  deck: readonly DrawnCard[],
  selected?: readonly number[],
): Reading {
  if (!Object.hasOwn(SPREADS, spread)) invalid('Unknown spread')
  const count = SPREADS[spread].positions.en.length
  const indexes = selected ?? Array.from({ length: count }, (_, index) => index)
  const cards = indexes.map((index) => {
    if (!Number.isInteger(index) || !deck[index]) return invalid('Invalid card position')
    return { ...deck[index] } as DrawnCard
  })
  return validate({ spread, cards })
}

export function encodeReading(reading: Reading): string {
  validate(reading)
  return `${reading.spread}:${reading.cards.map((card) => `${card.cardId}${card.reversed ? 'r' : ''}`).join(',')}`
}
export function decodeReading(encoded: string): Reading {
  // 只接收 #r= 后的值；不解析 URL，也不允许超长/非规范输入。
  if (encoded.length > 256) invalid('Reading is too long')
  const match = /^([a-z-]+):([a-z0-9,-]+)$/.exec(encoded)
  if (!match) return invalid('Malformed reading')
  const cards = (match[2] as string).split(',').map((token) => {
    const reversed = token.endsWith('r')
    return { cardId: reversed ? token.slice(0, -1) : token, reversed }
  })
  return validate({ spread: match[1] as SpreadId, cards })
}
