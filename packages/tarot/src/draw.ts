import { AppError } from '@xuanxue/shared'
import { CARDS } from './cards.ts'
import { SPREADS, spreadSize } from './spreads.ts'
import type { AnySpreadId, DrawnCard, Reading } from './types.ts'

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

function validate<S extends AnySpreadId>(reading: Reading<S>): Reading<S> {
  const count = spreadSize(reading.spread)
  if (count === undefined) return invalid('Unknown spread')
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
export function drawCards<S extends AnySpreadId>(
  spread: S,
  deck: readonly DrawnCard[],
  selected?: readonly number[],
): Reading<S> {
  const count = spreadSize(spread)
  if (count === undefined) return invalid('Unknown spread')
  const indexes = selected ?? Array.from({ length: count }, (_, index) => index)
  const cards = indexes.map((index) => {
    if (!Number.isInteger(index) || !deck[index]) return invalid('Invalid card position')
    return { ...deck[index] } as DrawnCard
  })
  return validate({ spread, cards })
}

export function encodeReading(reading: Reading<AnySpreadId>): string {
  validate(reading)
  return `${reading.spread}:${reading.cards.map((card) => `${card.cardId}${card.reversed ? 'r' : ''}`).join(',')}`
}
/**
 * 解码分享结果。不传 `expected` 时只接受四种通用牌阵（详批等服务端入口沿用，主题牌阵不会混入）；
 * 主题牌阵页传入本页牌阵，其他牌阵的结果一律视为非法。
 */
export function decodeReading<S extends AnySpreadId>(encoded: string, expected: S): Reading<S>
// 无参重载放在最后：ReturnType<typeof decodeReading> 取最后一个签名（详批入口沿用）
export function decodeReading(encoded: string): Reading
export function decodeReading(encoded: string, expected?: AnySpreadId): Reading<AnySpreadId> {
  // 只接收 #r= 后的值；不解析 URL，也不允许超长/非规范输入。
  if (encoded.length > 256) invalid('Reading is too long')
  const match = /^([a-z-]+):([a-z0-9,-]+)$/.exec(encoded)
  if (!match) return invalid('Malformed reading')
  const spread = match[1] as AnySpreadId
  if (expected === undefined ? !Object.hasOwn(SPREADS, spread) : spread !== expected)
    invalid('Unexpected spread')
  const cards = (match[2] as string).split(',').map((token) => {
    const reversed = token.endsWith('r')
    return { cardId: reversed ? token.slice(0, -1) : token, reversed }
  })
  return validate({ spread, cards })
}
