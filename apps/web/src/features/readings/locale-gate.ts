import type { ReadingKind } from '@xuanxue/db'
import { type ReadingDefinition, readingDefinition } from './catalog.ts'

/**
 * 详批「类型 × 语言」的提示词评测门槛（add-locales-eu-ja design 决策 7、D-10；specs/paid-readings
 * 「报告内容约束」）：新语言的变体先在 catalog.ts 注册，评测套件即可运行；未通过门槛的组合在该语言
 * 不出售——解锁卡（`getReadingOffer`）、定价页（`siteReadingPricing`）与创建详批（`POST /api/readings`）
 * 都经 `releasedReadingDefinition` 判定，免费结果照常显示。
 *
 * 只登记尚待评测的组合；未登记的组合（上线前已有的语言）视为已通过。
 * 评测通过（`pnpm eval:prompts --suite readings` 门槛全部达成，并经使用者确认）后，
 * 把对应值改为 `'passed'` 并在注释中写明私有证据位置，或直接删除该条。
 */
export type ReadingGateStatus = 'pending' | 'passed'

export const READING_LOCALE_GATE: Readonly<
  Partial<Record<ReadingKind, Readonly<Record<string, ReadingGateStatus>>>>
> = {
  // tasks 5.8：es 变体已注册（numerology-full.v5 / tarot-spread.v4），真实评测待使用者批准预算
  'numerology-full': { es: 'pending' },
  'tarot-spread': { es: 'pending' },
}

/** 该组合是否已通过评测门槛、可以对访客出售 */
export function readingLocaleReleased(kind: string, locale: string): boolean {
  if (!Object.hasOwn(READING_LOCALE_GATE, kind)) return true
  const byLocale = READING_LOCALE_GATE[kind as ReadingKind] ?? {}
  return !Object.hasOwn(byLocale, locale) || byLocale[locale] === 'passed'
}

/**
 * 面向访客的详批定义：类型或语言不存在、或该组合尚未通过评测门槛时返回 undefined。
 * 已生成报告的展示与收尾、评测套件仍用 `readingDefinition`，不受门槛影响。
 */
export function releasedReadingDefinition(
  kind: string,
  locale: string,
): ReadingDefinition | undefined {
  return readingLocaleReleased(kind, locale) ? readingDefinition(kind, locale) : undefined
}
