import { type BirthFormValues, toBirthInput, toShareInput } from '../tools/bazi/birth-form-state.ts'
import type { UnlockRequest } from './unlock-card.tsx'

/**
 * 各工具页把当前结果的输入换成解锁请求：`input` 为 `POST /api/readings` 的原始输入，
 * `share` 与该页 `#r=` 分享片段一致。结果未出现时返回 null。
 */
export function birthUnlock(values: BirthFormValues | null): UnlockRequest | null {
  if (!values) return null
  const parsed = toBirthInput(values)
  return parsed.ok ? { input: parsed.input, share: toShareInput(values) } : null
}

export function compatUnlock(
  values: readonly [BirthFormValues, BirthFormValues] | null,
  prefixes: readonly [string, string],
): UnlockRequest | null {
  if (!values) return null
  const a = toBirthInput(values[0])
  const b = toBirthInput(values[1])
  if (!a.ok || !b.ok) return null
  return {
    input: { a: a.input, b: b.input },
    share: { ...toShareInput(values[0], prefixes[0]), ...toShareInput(values[1], prefixes[1]) },
  }
}

/** 数字命理：日期必填；姓名只进请求体，不进分享片段与解锁令牌 */
export function numerologyUnlock(
  date: { year: number; month: number; day: number } | null,
  shareDate: string,
  name?: string | null,
): UnlockRequest | null {
  if (!date) return null
  return {
    input: { year: date.year, month: date.month, day: date.day, ...(name ? { name } : {}) },
    share: { date: shareDate },
  }
}
