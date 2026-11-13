import { CHART_LAYOUT } from '../../numerology/calc.ts'
import type { Box, ChartSize } from './geometry.ts'
import { gridCells } from './geometry.ts'

// 出生数字网格布局（tasks 6.2，「命盘图形」画布 Birth date grid）：毕达哥拉斯九宫（3-6-9 / 2-5-8 / 1-4-7），
// 每格写数字、出现次数，出现的数字重复书写（如「11」），缺失的数字以虚线框与「—」标出。
// 计数来自 calc.ts 的 digitCounts，不重新统计。

export const DIGIT_GRID_SIZE: ChartSize = { width: 300, height: 300 }
const GAP = 10
const MARK_SIZE = 30

export interface DigitCell {
  digit: number
  count: number
  missing: boolean
  box: Box
  /** 重复书写的数字，最多 6 个；缺失为「—」 */
  marks: string
  markSize: number
}

export function layoutDigitGrid(counts: Record<number, number>): DigitCell[] {
  const boxes = gridCells({ x: 0, y: 0, ...DIGIT_GRID_SIZE }, 3, 3, GAP)
  return CHART_LAYOUT.flat().map((digit, index) => {
    const count = counts[digit] ?? 0
    const box = boxes[index] as Box
    const marks = count ? String(digit).repeat(Math.min(count, 6)) : '—'
    // 数字多时缩小字号，保证 6 个数字也放得进格子（数字宽约 0.55 个字号）
    const markSize = Math.min(MARK_SIZE, (box.width - 16) / (marks.length * 0.6))
    return { digit, count, missing: count === 0, box, marks, markSize }
  })
}
