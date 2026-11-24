import { type NumberResult, personalYear, type Step } from '@xuanxue/numerology'
import { PERSONAL_YEAR_NUMBERS, type PersonalYearNumber } from './paths.ts'

/**
 * personal year 计算器的纯函数（openspec content-growth-v2-tools 第 27 组，specs/numerology-pages）。
 *
 * 规则复用 `@xuanxue/numerology` 的 `personalYear`：数字命理详批的逐年个人年数（`personalYears`，
 * readings-prompt-v4-yearly）逐年调用同一函数，所以同一输入两边得到同一个引擎结果（单测锁定）。
 * 引擎在月、日、年与合计各步保留主数 11、22、33；本页按使用者确认的默认 B10「从 1 月 1 日起算、化为 1–9」
 * 把主数结果读作它的数字根（11 → 2、22 → 4、33 → 6），页面同时显示引擎原值与化简这一步。
 */

export const PERSONAL_YEAR_MIN = 1900
export const PERSONAL_YEAR_MAX = 2100

/** 出生年不参与计算；用闰年占位，2 月 29 日出生也能通过引擎的日期校验 */
const PLACEHOLDER_BIRTH_YEAR = 2000
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

export interface MonthDay {
  readonly month: number
  readonly day: number
}

export interface PersonalYearResult extends MonthDay {
  readonly year: number
  /** 引擎原结果（可能是主数 11、22、33），与详批逐年数据一致 */
  readonly engine: NumberResult
  /** 化为 1–9 后的年份数（B10） */
  readonly value: PersonalYearNumber
}

/** 数字根：1–9（0 只在输入为 0 时出现，这里不会遇到） */
export function digitRoot(value: number): number {
  return value === 0 ? 0 : 1 + ((value - 1) % 9)
}

export function isValidMonthDay({ month, day }: MonthDay): boolean {
  return (
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (DAYS_IN_MONTH[month - 1] ?? 0)
  )
}

export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= PERSONAL_YEAR_MIN && year <= PERSONAL_YEAR_MAX
}

/** 出生月日 + 目标年 → 个人年数；输入无效时返回 null */
export function personalYearOf(
  input: MonthDay & { readonly year: number },
): PersonalYearResult | null {
  if (!isValidMonthDay(input) || !isValidYear(input.year)) return null
  const engine = personalYear(
    { year: PLACEHOLDER_BIRTH_YEAR, month: input.month, day: input.day },
    input.year,
  )
  const value = digitRoot(engine.value) as PersonalYearNumber
  return { month: input.month, day: input.day, year: input.year, engine, value }
}

export interface CycleYear {
  readonly year: number
  readonly value: PersonalYearNumber
}

/** 所在的九年周期：从个人年 1 的那一年起连续 9 年（相邻年份的 1–9 值总是加 1，9 之后回到 1） */
export function nineYearCycle(result: PersonalYearResult): readonly CycleYear[] {
  const start = result.year - (result.value - 1)
  return PERSONAL_YEAR_NUMBERS.map((value, i) => ({ year: start + i, value }))
}

/** 计算步骤的一行：`input` 为原始数，`chain` 为逐次相加（空表示原样保留） */
export interface StepLine {
  readonly phase: 'month' | 'day' | 'year'
  readonly input: number
  readonly chain: readonly Step[]
  readonly value: number
}

export interface StepView {
  readonly parts: readonly StepLine[]
  /** 三部分之和 */
  readonly total: Step
  /** 合计的逐次约简（引擎步骤） */
  readonly reduce: readonly Step[]
  /** 引擎在主数停下时，化为 1–9 的这一步（B10）；否则为 null */
  readonly root: Step | null
}

/** 引擎步骤 → 页面算式（月、日、年各一行，合计、约简与主数化简） */
export function stepView(result: PersonalYearResult): StepView {
  const { engine } = result
  const byPhase = (phase: Step['phase']) => engine.steps.filter((step) => step.phase === phase)
  const total = engine.steps.find((step) => step.phase === 'total')
  if (!total) throw new Error('personalYear steps without total')
  const totalIndex = engine.steps.indexOf(total)
  const inputs = { month: result.month, day: result.day, year: result.year } as const
  const parts = (['month', 'day', 'year'] as const).map((phase, i) => ({
    phase,
    input: inputs[phase],
    chain: byPhase(phase),
    value: total.operands[i] ?? inputs[phase],
  }))
  const reduce = engine.steps.slice(totalIndex + 1)
  const root =
    engine.value > 9
      ? {
          phase: 'digits' as const,
          operands: [...String(engine.value)].map(Number),
          result: result.value,
        }
      : null
  return { parts, total, reduce, root }
}

/** 一串加法步骤 → `1 + 4 = 5` 或 `2 + 0 + 2 + 6 = 10 → 1 + 0 = 1` */
export function chainText(chain: readonly Step[]): string {
  return chain.map((step) => `${step.operands.join(' + ')} = ${step.result}`).join(' → ')
}

/**
 * 年份数页的示例生日：在给定年份得到 `value` 且引擎不经主数的第一个日期（优先 7 月，与设计稿同月）。
 * 示例由引擎当场计算，正文不写死算式。
 */
export function exampleFor(value: PersonalYearNumber, year: number): PersonalYearResult {
  const months = [7, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]
  for (const month of months)
    for (let day = 10; day <= 28; day++) {
      const result = personalYearOf({ month, day, year })
      if (result && result.value === value && result.engine.value === value) return result
    }
  throw new Error(`No example for personal year ${value} in ${year}`)
}
