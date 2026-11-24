import { reduceNumber } from '@xuanxue/numerology'

/**
 * angel number 的数字事实（页面组件、单测与 scripts/check-content-angel-numbers.mjs 共用的口径）：
 * 逐位数字、排列模式、各位之和与约简根数。约简沿用生命灵数规则（@xuanxue/numerology 的 reduceNumber）：
 * 各位相加直到一位数，遇到 11、22、33 停下保留为大师数。
 */

export type AngelPattern =
  /** 同一数字重复：111、5555 */
  | 'repeat'
  /** 两个数字交替：1212、1010 */
  | 'alternate'
  /** 两两成对：1122、1144 */
  | 'pairs'
  /** 回文：1221、717 */
  | 'mirror'
  /** 递增连号：123、1234 */
  | 'ascending'
  /** 一个数字后接重复数字：711、911 */
  | 'lead'

export interface AngelFacts {
  readonly number: string
  readonly digits: readonly number[]
  /** 去重后的数字，按首次出现顺序 */
  readonly distinct: readonly number[]
  readonly pattern: AngelPattern
  /** 各位之和 */
  readonly sum: number
  /** 各位之和之后的约简步骤（不含第一步「各位相加」） */
  readonly steps: readonly { readonly operands: readonly number[]; readonly result: number }[]
  /** 约简根数（0–9 或大师数 11、22、33） */
  readonly root: number
  readonly master: boolean
}

export function angelPattern(digits: readonly number[]): AngelPattern {
  const [a, b, c, d] = digits
  const n = digits.length
  if (digits.every((digit) => digit === a)) return 'repeat'
  if (digits.every((digit, i) => i === 0 || digit === (digits[i - 1] ?? 0) + 1)) return 'ascending'
  if (n === 4 && a === c && b === d) return 'alternate'
  if (n === 4 && a === b && c === d) return 'pairs'
  if (digits.every((digit, i) => digit === digits[n - 1 - i])) return 'mirror'
  if (n === 3 && b === c) return 'lead'
  throw new RangeError(`Unsupported angel number pattern: ${digits.join('')}`)
}

export function angelFacts(number: string): AngelFacts {
  if (!/^\d{3,4}$/.test(number)) throw new RangeError(`Invalid angel number: ${number}`)
  const digits = [...number].map(Number)
  const sum = digits.reduce((total, digit) => total + digit, 0)
  const reduced = reduceNumber(sum)
  return {
    number,
    digits,
    distinct: [...new Set(digits)],
    pattern: angelPattern(digits),
    sum,
    steps: reduced.steps.map(({ operands, result }) => ({ operands, result })),
    root: reduced.value,
    master: reduced.master,
  }
}

/** 有生命灵数页的数字（1–9 与 11、22、33）；0 没有对应页 */
export const LIFE_PATH_PAGE_NUMBERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]
export const hasLifePathPage = (value: number) => LIFE_PATH_PAGE_NUMBERS.includes(value)

/** 枢纽分组：三位重复数、四位数、其他序列（设计稿 AngelHub；es 枢纽只有一组） */
export type AngelGroup = 'triple' | 'four' | 'more'
export function angelGroup(number: string): AngelGroup {
  const facts = angelFacts(number)
  if (number.length === 3 && facts.pattern === 'repeat') return 'triple'
  if (number.length === 4) return 'four'
  return 'more'
}
