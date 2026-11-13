import type { BirthDate, NumberResult } from '@xuanxue/numerology'
import type { Box, ChartSize } from './geometry.ts'
import { estimateTextWidth } from './pillars.ts'

// 生命灵数推导图形布局（openspec redesign-home-chart-visuals tasks 6.1，「命盘图形」画布 Life Path reduction）：
// 上排月、日、年三格，各写原值与逐步归约链（05 → 5、1990 → 19 → 10 → 1）；下排为三部分相加与最终数字圆圈。
// 只消费 @xuanxue/numerology 的 steps，大师数 11 / 22 / 33 由引擎保留，这里不再归约。

// viewBox 宽 520：手机结果卡约 316px 宽时，最小字号 20 折算约 12px
export const LIFE_PATH_SIZE: ChartSize = { width: 520, height: 290 }

const GAP = 12
const PART_HEIGHT = 112
const CHAIN_SIZE = 24
const MASTER = new Set([11, 22, 33])

export type LifePathPhase = 'month' | 'day' | 'year'

export interface LifePathPart {
  phase: LifePathPhase
  box: Box
  /** 原值，月日补零到两位：「05」 */
  input: string
  /** 归约链中间值（不含原值与最终值）：1990 → [19, 10] → 1 */
  between: number[]
  value: number
  kept: boolean
}

export interface LifePathLayout {
  size: ChartSize
  chainSize: number
  parts: LifePathPart[]
  /** 「5 + 6 + 1 = 12」之后的中间值与最终值 */
  total: { operands: number[]; sum: number; between: number[]; value: number; master: boolean }
  totalBaseline: number
  circle: { cx: number; cy: number; r: number }
}

/** 某部分的展示文字：「1990 → 19 → 10 → 1」 */
export function partChain(part: Pick<LifePathPart, 'input' | 'between' | 'value'>): string {
  const values = [part.input, ...part.between.map(String)]
  if (String(part.value) !== part.input) values.push(String(part.value))
  return values.join(' → ')
}

export function layoutLifePath(result: NumberResult, date: BirthDate): LifePathLayout {
  const raw = (['month', 'day', 'year'] as const).map((phase) => {
    const steps = result.steps.filter((step) => step.phase === phase)
    const value = steps.at(-1)?.result ?? date[phase]
    const input = phase === 'year' ? String(date.year) : String(date[phase]).padStart(2, '0')
    return {
      phase,
      input,
      between: steps.slice(0, -1).map((step) => step.result),
      value,
      kept: MASTER.has(value),
    }
  })
  // 每格宽度按归约链长度分配，余量平分，链最长的「年」不会挤出格子
  const natural = raw.map((part) => estimateTextWidth(partChain(part), CHAIN_SIZE) + 24)
  const available = LIFE_PATH_SIZE.width - GAP * (raw.length - 1)
  const extra = Math.max(0, available - natural.reduce((sum, width) => sum + width, 0)) / raw.length
  const scale = Math.min(1, available / natural.reduce((sum, width) => sum + width, 0))
  let x = 0
  const parts = raw.map((part, index) => {
    const width = (natural[index] ?? 0) * scale + extra
    const box = { x, y: 0, width, height: PART_HEIGHT }
    x += width + GAP
    return { ...part, box }
  })
  const totalSteps = result.steps.filter((step) => step.phase === 'total')
  const first = totalSteps[0]
  const operands = first?.operands ?? parts.map((part) => part.value)
  const sum = first?.result ?? result.value
  const r = 50
  return {
    size: LIFE_PATH_SIZE,
    // 归约链过长需要压缩格宽时，字号同比缩小，文字不出格
    chainSize: CHAIN_SIZE * scale,
    parts,
    total: {
      operands,
      sum,
      between: totalSteps.slice(1, -1).map((step) => step.result),
      value: result.value,
      master: result.master,
    },
    totalBaseline: PART_HEIGHT + 40 + r + CHAIN_SIZE * 0.36,
    circle: { cx: LIFE_PATH_SIZE.width - r - 4, cy: PART_HEIGHT + 40 + r, r },
  }
}

/** 下排算式（最终值画在圆圈里）：「5 + 6 + 1 = 12 →」；总和无需再归约时为「5 + 1 + 1 =」 */
export function totalText(total: LifePathLayout['total']): string {
  const head = `${total.operands.join(' + ')} =`
  if (total.sum === total.value) return head
  return `${head} ${[total.sum, ...total.between].join(' → ')} →`
}
