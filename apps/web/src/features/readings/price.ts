/**
 * 解锁卡的当地货币估价（add-reading-monetization design 决策 4）：按能覆盖所需积分的最小积分包
 * 折算美元价格，再按站点语言换成当地货币显示「约」值。汇率优先使用 Exchange Rate API 的实时数据
 * （见 `loadLocalRates`），拉取失败时回退到下方的参考值。实际扣款以 Stripe Checkout（Adaptive Pricing）为准。
 */
interface Pack {
  readonly credits: number
  /** 美分 */
  readonly amount: number
}

/** 语言 → 当地货币与参考汇率（每美元可兑换数量）；仅作回退值，按需定期人工校准 */
export const LOCAL_CURRENCY: Readonly<
  Record<string, { currency: string; perUsd: number; format: string }>
> = {
  ko: { currency: 'KRW', perUsd: 1400, format: 'ko' },
  // zh-Hant 的新台币符号是「$」，与美元无法区分；按 en 格式输出「NT$」
  'zh-Hant': { currency: 'TWD', perUsd: 32.5, format: 'en' },
  // 简体访客的人民币参考汇率
  'zh-Hans': { currency: 'CNY', perUsd: 7.2, format: 'zh-Hans' },
}

export interface LocalRates {
  /** 每 1 美元可兑换的当地货币数量，键为 ISO 4217 代码 */
  readonly perUsd: Readonly<Record<string, number>>
  /** 数据来自 Exchange Rate API 时为服务商署名（展示须带上）；参考值为 null，不署名 */
  readonly attribution: { readonly text: string; readonly href: string } | null
}

/** 回退用的参考汇率，键为货币代码 */
export const FALLBACK_LOCAL_RATES: LocalRates = {
  perUsd: Object.fromEntries(
    Object.values(LOCAL_CURRENCY).map(({ currency, perUsd }) => [currency, perUsd]),
  ),
  attribution: null,
}

/** 该积分数对应的美元价格（美分）；没有积分包时返回 null */
export function usdCentsFor(credits: number, packs: readonly Pack[]): number | null {
  const sorted = [...packs].filter((p) => p.credits > 0).sort((a, b) => a.credits - b.credits)
  const pack = sorted.find((p) => p.credits >= credits) ?? sorted.at(-1)
  if (!pack) return null
  return Math.round((pack.amount * credits) / pack.credits)
}

export interface PriceEstimate {
  readonly text: string
  /** 换算得到的近似值；美元为积分包标价 */
  readonly approximate: boolean
}

/** 金额文字；韩元取整到百、新台币取整到元。`rates` 缺少该货币时使用参考值 */
export function formatPrice(
  usdCents: number,
  locale: string,
  rates: LocalRates = FALLBACK_LOCAL_RATES,
): PriceEstimate {
  const local = LOCAL_CURRENCY[locale]
  if (!local)
    return {
      text: new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
        usdCents / 100,
      ),
      approximate: false,
    }
  const perUsd = rates.perUsd[local.currency] ?? local.perUsd
  const raw = (usdCents / 100) * perUsd
  const value = local.currency === 'KRW' ? Math.round(raw / 100) * 100 : Math.round(raw)
  return {
    text: new Intl.NumberFormat(local.format, {
      style: 'currency',
      currency: local.currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value),
    approximate: true,
  }
}
