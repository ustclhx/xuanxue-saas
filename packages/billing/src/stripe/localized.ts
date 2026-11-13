/**
 * 东方站积分包与订阅的本地化 Stripe 商品：两站共用同一账户与同一组规范（英文）价格，
 * Checkout 商品行显示的是 Price 所属 Product 的名称，因此为每个非英文语言另建一个
 * Product + 同金额 Price；本地只记录规范价格，本地化价格按确定的 lookup_key 查找。
 *
 * 名称与积分单位对应 apps/web/messages/<locale>/marketing.json 的
 * `pricing_pack_single` / `pricing_pack_five` / `pricing_pack_credits` 与订阅档位 `pricing_sub_*`；
 * billing 不能依赖 apps，修改文案时两处需同步。
 *
 * 订阅（enable-subscriptions-daily-credits D9）只把 TWD / KRW 价格挂到本地化商品上；USD 订阅仍用规范价格、
 * 不建 lookup_key 变体：订阅续费与换档按 plan_price 记录的平台价格 ID 对账，结账不能换成另一个 Price。
 */
export const LOCALIZED_PACK_LOCALES = ['zh-Hant', 'zh-Hans', 'ko'] as const
export type LocalizedPackLocale = (typeof LOCALIZED_PACK_LOCALES)[number]

const PACK_NAMES: Record<string, Record<LocalizedPackLocale, string>> = {
  reading_single: { 'zh-Hant': '單次詳批', 'zh-Hans': '单次详批', ko: '상세 풀이 1회' },
  reading_five: { 'zh-Hant': '五次詳批', 'zh-Hans': '五次详批', ko: '상세 풀이 5회' },
  // 档位名 Plus / Premium 在各语言保持原文（原型 Pricing.dc.html），附「每月方案」说明商品性质
  plus: { 'zh-Hant': 'Plus 每月方案', 'zh-Hans': 'Plus 每月方案', ko: 'Plus 월간 플랜' },
  premium: {
    'zh-Hant': 'Premium 每月方案',
    'zh-Hans': 'Premium 每月方案',
    ko: 'Premium 월간 플랜',
  },
}

const CREDITS_LABEL: Record<LocalizedPackLocale, (credits: number) => string> = {
  'zh-Hant': (credits) => `${credits} 積分`,
  'zh-Hans': (credits) => `${credits} 积分`,
  ko: (credits) => `${credits} 크레딧`,
}

/**
 * 本地币种价格挂在对应语言的本地化商品上（localize-checkout-currency D1）：TWD 只服务 zh-Hant，KRW 只服务 ko。
 * 与 currency.ts 的 Stripe 语言→币种映射互为反向，修改时两处同步。
 */
export const LOCAL_CURRENCY_LOCALE = { TWD: 'zh-Hant', KRW: 'ko' } as const satisfies Record<
  string,
  LocalizedPackLocale
>

export function isLocalizedPackLocale(locale: string): locale is LocalizedPackLocale {
  return (LOCALIZED_PACK_LOCALES as readonly string[]).includes(locale)
}

/** Stripe 自定义 ID 与 lookup_key 只用字母数字与下划线 */
function localeSlug(locale: LocalizedPackLocale): string {
  return locale.toLowerCase().replace('-', '_')
}

/** 规范（英文）商品 ID；订阅与没有译名的套餐都挂在这里 */
export function canonicalProductId(planId: string): string {
  return `xuanxue_plan_${planId.replaceAll('-', '')}`
}

export function localizedProductId(planId: string, locale: LocalizedPackLocale): string {
  return `xuanxue_plan_${planId.replaceAll('-', '')}_${localeSlug(locale)}`
}

export function localizedLookupKey(planPriceId: string, locale: LocalizedPackLocale): string {
  return `xuanxue_${planPriceId}_${localeSlug(locale)}`
}

/** 目录外的套餐没有译名，不建本地化商品（Checkout 回退到规范价格） */
export function localizedPackName(planKey: string, locale: LocalizedPackLocale): string | null {
  return PACK_NAMES[planKey]?.[locale] ?? null
}

const MONTHLY_CREDITS_LABEL: Record<LocalizedPackLocale, (credits: number) => string> = {
  'zh-Hant': (credits) => `每月 ${credits} 積分`,
  'zh-Hans': (credits) => `每月 ${credits} 积分`,
  ko: (credits) => `매월 ${credits} 크레딧`,
}

/** 商品描述：积分包为「100 積分」，订阅为「每月 400 積分」 */
export function localizedPackDescription(
  credits: number,
  locale: LocalizedPackLocale,
  type: 'subscription' | 'credit_pack' = 'credit_pack',
): string {
  return (type === 'subscription' ? MONTHLY_CREDITS_LABEL : CREDITS_LABEL)[locale](credits)
}
