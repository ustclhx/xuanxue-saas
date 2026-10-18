import { type BirthDate, lifePath } from './numbers.ts'

export const LIFE_PATH_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33] as const
export type CompatibilityLevel = 'high' | 'medium' | 'challenging'
const H = 'high',
  M = 'medium',
  C = 'challenging'
// 常见毕达哥拉斯流派的综合编辑表：大师数沿用 2/4/6 的互动主题。
// 这是固定、对称的娱乐性解释约定，不是关系质量或未来事件的预测。
export const COMPATIBILITY_MATRIX: readonly (readonly CompatibilityLevel[])[] = [
  [M, M, H, C, H, M, M, H, M, M, C, M],
  [M, H, M, H, C, H, H, M, H, H, H, H],
  [H, M, H, C, H, H, M, C, H, M, C, H],
  [C, H, C, H, C, H, H, H, M, H, H, H],
  [H, C, H, C, H, C, H, M, H, C, C, C],
  [M, H, H, H, C, H, C, M, H, H, H, H],
  [M, H, M, H, H, C, H, M, M, H, H, C],
  [H, M, C, H, M, M, M, H, C, M, H, M],
  [M, H, H, M, H, H, M, C, H, H, M, H],
  [M, H, M, H, C, H, H, M, H, H, H, H],
  [C, H, C, H, C, H, H, H, M, H, H, H],
  [M, H, H, H, C, H, C, M, H, H, H, H],
]
export function compatibility(first: BirthDate, second: BirthDate) {
  const left = lifePath(first),
    right = lifePath(second)
  const i = LIFE_PATH_VALUES.indexOf(left.value as (typeof LIFE_PATH_VALUES)[number])
  const j = LIFE_PATH_VALUES.indexOf(right.value as (typeof LIFE_PATH_VALUES)[number])
  const level = COMPATIBILITY_MATRIX[i]?.[j] as CompatibilityLevel
  const pair = [left.value, right.value].sort((a, b) => a - b)
  return { left, right, level, explanationKey: `numerology.compatibility.${pair.join('-')}` }
}
