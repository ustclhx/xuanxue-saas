import { type BirthDate, lifePath, type NumberResult } from '@xuanxue/numerology'

/**
 * 页面层的纯函数：把表单值转成引擎输入，把引擎步骤转成算式文本，计算数字分布图。
 * 计算规则本身全部在 @xuanxue/numerology，这里只做展示所需的整理。
 */

/** `<input type="date">` 的值（YYYY-MM-DD）；格式不对时返回 null，日期是否存在由引擎校验 */
export function parseBirthDate(value: unknown): BirthDate | null {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function formatBirthDate({ year, month, day }: BirthDate): string {
  const pad = (value: number, length: number) => String(value).padStart(length, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

const chain = (steps: NumberResult['steps']) =>
  steps.map((step) => `${step.operands.join(' + ')} = ${step.result}`).join(' → ')

/** 通用归约算式：`2066 → 2 + 0 + 6 + 6 = 14 → 1 + 4 = 5` 的箭头之后部分 */
export function reductionText(result: NumberResult): string {
  return chain(result.steps)
}

export interface LifePathLine {
  readonly phase: 'month' | 'day' | 'year' | 'total'
  /** 该部分的原始值（总和行为 null） */
  readonly input: number | null
  readonly text: string
  /** 归约停在大师数（总和行在结果为大师数时也为 true） */
  readonly kept: boolean
}

/**
 * 生命灵数的四行算式（原型 LifePath.dc.html）：
 * `Month 11 → 11 (kept)`、`Day 29 → 2 + 9 = 11 (kept)`、`Year 1987 → 1 + 9 + 8 + 7 = 25 → 2 + 5 = 7`、
 * `11 + 11 + 7 = 29 → 2 + 9 = 11`。
 */
export function lifePathLines(result: NumberResult, date: BirthDate): LifePathLine[] {
  const parts = (['month', 'day', 'year'] as const).map((phase) => {
    const input = date[phase]
    const steps = result.steps.filter((step) => step.phase === phase)
    const value = steps.at(-1)?.result ?? input
    return {
      phase,
      input,
      text: steps.length ? chain(steps) : String(input),
      kept: value === 11 || value === 22 || value === 33,
    }
  })
  const total = result.steps.filter((step) => step.phase === 'total')
  return [...parts, { phase: 'total', input: null, text: chain(total), kept: result.master }]
}

/** 归约前的总和（姓名数字展示「字母合计」）：引擎只记录归约步骤，第一步的各位数字拼回即为总和 */
export function rawTotal(result: NumberResult): number {
  const first = result.steps[0]
  return first ? Number(first.operands.join('')) : result.value
}

/** 毕达哥拉斯字母表取值（A=1…I=9 循环）；输入为 normalizeName 之后的大写基础字母 */
export function letterValue(letter: string): number {
  return ((letter.charCodeAt(0) - 65) % 9) + 1
}

/** 已规范化姓名按词拆成字母与取值；`position` 为字母在整个姓名中的序号（列表 key） */
export function nameLetters(
  normalized: string,
): { letter: string; value: number; position: number }[][] {
  let position = 0
  return normalized
    .split(/[\s'’-]+/)
    .filter(Boolean)
    .map((word) =>
      [...word].map((letter) => ({ letter, value: letterValue(letter), position: position++ })),
    )
}

/** 数字分布图的九宫排列（自下而上 1-4-7 / 2-5-8 / 3-6-9 三列，毕达哥拉斯出生图惯例） */
export const CHART_LAYOUT = [
  [3, 6, 9],
  [2, 5, 8],
  [1, 4, 7],
] as const

/** 1–9 各数字出现次数；0 不进入图表 */
export function digitCounts(values: readonly number[]): Record<number, number> {
  const counts: Record<number, number> = {}
  for (let digit = 1; digit <= 9; digit += 1) counts[digit] = 0
  for (const value of values) if (value >= 1 && value <= 9) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

export function birthDigits(date: BirthDate): number[] {
  return [...`${date.day}${date.month}${date.year}`].map(Number)
}

export function chartSummary(counts: Record<number, number>) {
  const digits = Object.keys(counts).map(Number)
  const max = Math.max(...digits.map((digit) => counts[digit] ?? 0))
  return {
    missing: digits.filter((digit) => counts[digit] === 0),
    repeated: max > 1 ? digits.filter((digit) => counts[digit] === max) : [],
  }
}

/** 样例日期的英文写法（29 November 1987），按 UTC 格式化，与访客时区无关 */
export function formatLongDate({ year, month, day }: BirthDate): string {
  const date = new Date(Date.UTC(2000, month - 1, day))
  date.setUTCFullYear(year)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** 数字页首屏样例：从 1980-01-01 起逐日找到第一个生命灵数为 `value` 的日期 */
export function exampleDateFor(value: number): BirthDate {
  const cursor = new Date(Date.UTC(1980, 0, 1))
  for (let i = 0; i < 366 * 60; i += 1) {
    const date = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
    }
    if (lifePath(date).value === value) return date
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  throw new Error(`No example date for life path ${value}`)
}
