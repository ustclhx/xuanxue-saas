/**
 * 项目自有价目表（localize-checkout-currency design D2，非模板文件）：每个在售套餐在每个结算币种下的固定金额。
 * 种子、平台价格同步与页面参考价都从这里读取。金额是按下方汇率快照与取整规则算好的字面量，
 * 运行时不换算；单元测试断言字面量与「快照 × 规则」一致。
 *
 * 调价流程：改快照或字面量 → 评审 → 重跑种子（新增 unsynced 行）→ 同步脚本创建新的平台价格对象并停用旧行。
 * 已存在的平台价格对象不可改价，历史付款保留原金额。
 *
 * 数值经使用者确认（design.md 决策记录 2026-11-13 第 1 条）。订阅档位 `plus` / `premium` 的套餐目录由
 * enable-subscriptions-daily-credits 负责，这里只提供价格。
 */
import type { EnabledCurrency } from './currency.ts'

/** 换算所用汇率快照：每 1 美元可兑换的数量。CNY 只用于简体界面的参考价，不建价格行 */
export const FX_SNAPSHOT = {
  date: '2026-11-13',
  perUsd: { TWD: 32.5, KRW: 1400, CNY: 6.7 },
} as const

/**
 * 取整规则：USD 价格（美分）× 汇率后，TWD 四舍五入到整元、KRW 四舍五入到百韩元、CNY 参考价四舍五入到整元；
 * 结果以各币种最小单位记录（TWD、CNY 为 1/100 元，KRW 为 1 韩元）。
 */
export function convertFromUsd(usdCents: number, currency: 'TWD' | 'KRW' | 'CNY'): number {
  const major = (usdCents / 100) * FX_SNAPSHOT.perUsd[currency]
  if (currency === 'KRW') return Math.round(major / 100) * 100
  return Math.round(major) * 100
}

/** 一个套餐在一个周期下各币种的金额（最小单位）；CNY 为参考价，只用于展示 */
export type TablePrices = Readonly<Record<EnabledCurrency, number>> & { readonly CNY: number }

/** 一次性积分包用 `once`，订阅用 `month` / `year` */
export type TableInterval = 'once' | 'month' | 'year'

export const PRICE_TABLE = {
  // 详批积分包：100 积分 $1.99 = NT$65 = ₩2,800（约 ¥13）
  reading_single: { once: { USD: 199, TWD: 6500, KRW: 2800, CNY: 1300 } },
  // 500 积分 $6.99 = NT$227 = ₩9,800（约 ¥47）
  reading_five: { once: { USD: 699, TWD: 22700, KRW: 9800, CNY: 4700 } },
  // 订阅 400 积分/月 $4.99 = NT$162 = ₩7,000（约 ¥33）
  plus: { month: { USD: 499, TWD: 16200, KRW: 7000, CNY: 3300 } },
  // 订阅 1000 积分/月 $9.99 = NT$325 = ₩14,000（约 ¥67）
  premium: { month: { USD: 999, TWD: 32500, KRW: 14000, CNY: 6700 } },
} as const satisfies Record<string, Partial<Record<TableInterval, TablePrices>>>

export type PricedPlanKey = keyof typeof PRICE_TABLE

export interface CatalogPrice {
  readonly interval: 'month' | 'year' | null
  readonly amount: number
  readonly currency: EnabledCurrency
}

const SETTLEMENT_CURRENCIES = ['USD', 'TWD', 'KRW'] as const satisfies readonly EnabledCurrency[]

/** 把价目表中一个套餐展开成种子用的价格行（每个周期 × 每个结算币种一行；不含 CNY） */
export function tablePrices(key: PricedPlanKey): CatalogPrice[] {
  const intervals = PRICE_TABLE[key] as Partial<Record<TableInterval, TablePrices>>
  return (Object.entries(intervals) as [TableInterval, TablePrices][]).flatMap(
    ([interval, amounts]) =>
      SETTLEMENT_CURRENCIES.map((currency) => ({
        interval: interval === 'once' ? null : interval,
        amount: amounts[currency],
        currency,
      })),
  )
}

/**
 * 任意美元金额的人民币参考价（最小单位），用于解锁卡按所需积分折算的价格；
 * 价目表内的套餐金额与此函数结果一致（单元测试锁定）。
 */
export function cnyReference(usdCents: number): number {
  return convertFromUsd(usdCents, 'CNY')
}
