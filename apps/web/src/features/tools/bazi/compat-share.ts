import type { CompatItemKey, Compatibility } from '@xuanxue/bazi'
import type { ShareInput } from '../share.ts'

/**
 * 合盘的关系场景（content-growth-v2-tools 决策 7）：分数相同，解释与正文按场景撰写（第 13 组）。
 * 工具页为 `general`。
 */
export const COMPAT_SCENARIOS = [
  'general',
  'marriage',
  'couple',
  'friends',
  'business',
  'parent-child',
] as const
export type CompatScenario = (typeof COMPAT_SCENARIOS)[number]

/** 引擎输出的分项 key（与 @xuanxue/bazi compat.ts 一致），分享片段只接受这些 */
export const COMPAT_ITEM_KEYS: readonly CompatItemKey[] = [
  'stemCombine',
  'branchSixCombine',
  'branchTriad',
  'branchClash',
  'branchPunish',
  'elementComplementAB',
  'elementComplementBA',
]

/** 分享片段的版本号：有此键即为新版（只含分数与关系），否则按旧版（带两人出生资料）兼容读取 */
const VERSION = 2
/** 单项加减分的合理范围（引擎最大 ±15），超出视为篡改 */
const DELTA_LIMIT = 20

export interface CompatSummary {
  readonly score: number
  readonly base: number
  readonly items: readonly { readonly key: CompatItemKey; readonly delta: number }[]
  readonly scenario: CompatScenario
}

/**
 * 新版分享片段（决策 7「分享片段与分享卡只带分数、各项关系名与场景」）：
 * 不含任何一方的出生日期、时间、地点与性别，也不含日柱干支。
 */
export function toCompatShare(
  result: Pick<Compatibility, 'score' | 'base' | 'items'>,
  scenario: CompatScenario,
): ShareInput {
  return {
    compat: VERSION,
    score: result.score,
    base: result.base,
    items: result.items.map((item) => `${item.key}:${item.delta}`).join(','),
    scenario,
  }
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

/** 读取新版分享片段；不是新版或内容不自洽（分数与分项之和不符）时返回 null */
export function fromCompatShare(shared: ShareInput): CompatSummary | null {
  if (shared.compat !== VERSION) return null
  const { score, base, items, scenario } = shared
  if (!isInt(score, 0, 100) || !isInt(base, 0, 100) || typeof items !== 'string') return null
  const parsed: { key: CompatItemKey; delta: number }[] = []
  for (const part of items === '' ? [] : items.split(',')) {
    const [key, raw] = part.split(':')
    const delta = Number(raw)
    if (
      !COMPAT_ITEM_KEYS.includes(key as CompatItemKey) ||
      parsed.some((item) => item.key === key) ||
      !isInt(delta, -DELTA_LIMIT, DELTA_LIMIT)
    )
      return null
    parsed.push({ key: key as CompatItemKey, delta })
  }
  const total = parsed.reduce((sum, item) => sum + item.delta, base)
  if (Math.max(0, Math.min(100, total)) !== score) return null
  return {
    score,
    base,
    items: parsed,
    scenario: COMPAT_SCENARIOS.includes(scenario as CompatScenario)
      ? (scenario as CompatScenario)
      : 'general',
  }
}
