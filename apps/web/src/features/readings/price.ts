/**
 * 解锁卡的当地货币估价（add-reading-monetization design 决策 4）：按能覆盖所需积分的最小积分包
 * 折算美元价格，再按站点语言换成当地货币显示「约」值。汇率为固定参考值，不调用外部接口；
 * 实际扣款以 Stripe Checkout（Adaptive Pricing）显示的金额为准。
 */
interface Pack {
  readonly credits: number
  /** 美分 */
  readonly amount: number
}

/** 语言 → 当地货币与每美元参考汇率；按需定期人工校准 */
export const LOCAL_CURRENCY: Readonly<
  Record<string, { currency: string; perUsd: number; format: string }>
> = {
  ko: { currency: 'KRW', perUsd: 1400, format: 'ko' },
  // zh-Hant 的新台币符号是「$」，与美元无法区分；按 en 格式输出「NT$」
  'zh-Hant': { currency: 'TWD', perUsd: 32.5, format: 'en' },
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

/** 金额文字；韩元取整到百、新台币取整到元 */
export function formatPrice(usdCents: number, locale: string): PriceEstimate {
  const local = LOCAL_CURRENCY[locale]
  if (!local)
    return {
      text: new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
        usdCents / 100,
      ),
      approximate: false,
    }
  const raw = (usdCents / 100) * local.perUsd
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
