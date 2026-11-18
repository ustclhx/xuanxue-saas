import type { Branch, Stem } from '@xuanxue/bazi'
import { type CivilDate, dayNumber } from './date.ts'

/**
 * 首页今日条的当日公共信息（openspec separate-landing-homepage design.md D6）：
 * 东方站当日干支、西方站 Universal Day。只做整数算术，不引用历法库与数字命理包，
 * 落地页因此不下载排盘引擎；宜忌、建除等需要历表的内容只在每日运势页显示。
 * `public-day.test.ts` 与 `@xuanxue/bazi` 的 dayPillarOf、`@xuanxue/numerology` 的 universalDay 对拍。
 */

const STEMS: readonly Stem[] = [
  'jia',
  'yi',
  'bing',
  'ding',
  'wu',
  'ji',
  'geng',
  'xin',
  'ren',
  'gui',
]
const BRANCHES: readonly Branch[] = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
]

/** 基准日：1970-01-01 为辛巳日，六十甲子序 17（甲子为 0）；干支纪日连续不断，按天数取模即可 */
const EPOCH_CYCLE_INDEX = 17

export interface PublicDayPillar {
  readonly stem: Stem
  readonly branch: Branch
  /** 六十甲子序，甲子为 0 */
  readonly cycleIndex: number
}

/** 公历日期的日柱（日界为民用 00:00，与每日运势页一致） */
export function publicDayPillar(date: CivilDate): PublicDayPillar {
  const cycleIndex = (((dayNumber(date) + EPOCH_CYCLE_INDEX) % 60) + 60) % 60
  return {
    stem: STEMS[cycleIndex % 10] as Stem,
    branch: BRANCHES[cycleIndex % 12] as Branch,
    cycleIndex,
  }
}

/** 逐位相加直到一位数；11、22 保留（每日数字只按 1–9 与 11、22 解读） */
function reduceDaily(input: number): number {
  let value = input
  while (value > 9 && value !== 11 && value !== 22) {
    let sum = 0
    for (const digit of String(value)) sum += Number(digit)
    value = sum
  }
  return value
}

/** Universal Day：当日公历年、月、日分别归约后相加，再归约 */
export function publicUniversalDay(date: CivilDate): number {
  return reduceDaily(reduceDaily(date.year) + reduceDaily(date.month) + reduceDaily(date.day))
}
