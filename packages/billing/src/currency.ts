/**
 * 结算币种规则（localize-checkout-currency design D3）：启用币种、最小单位指数、平台金额约束、
 * 金额换算与展示格式化、按界面语言与支付平台决定结算币种，以及多币种价格行的选价。
 *
 * 纯函数、无内部依赖：经 `@xuanxue/billing/currency` 单独导出，供浏览器端定价页与解锁卡使用，
 * 不能把数据库或支付 SDK 带进浏览器包。
 */

/** 可实际结算的币种；CNY 只用作展示参考价，不在此列 */
export const ENABLED_CURRENCIES = ['USD', 'TWD', 'KRW'] as const
export type EnabledCurrency = (typeof ENABLED_CURRENCIES)[number]
/** 可展示的币种：结算币种加上只作参考价的 CNY */
export type DisplayCurrency = EnabledCurrency | 'CNY'

/**
 * 最小单位指数，以 Stripe 的约定为准（TWD 在 Stripe 中按两位小数记录）。
 * 不依赖 Intl 的 resolvedOptions：平台约定与 Intl 不保证一致，由单元测试锁定。
 */
export const CURRENCY_EXPONENT: Readonly<Record<DisplayCurrency, number>> = {
  USD: 2,
  TWD: 2,
  KRW: 0,
  CNY: 2,
}

/**
 * 最小单位金额必须是该步长的整数倍。Stripe 的 TWD 价格与退款必须是整元（最小单位 100 的倍数）；
 * PayPal 不使用 TWD（决策 2：PayPal 恒为 USD），因此不再区分平台。
 */
const MINOR_STEP: Readonly<Record<EnabledCurrency, number>> = { USD: 1, TWD: 100, KRW: 1 }

/** 展示时保留的小数位：TWD 与 KRW 只有整元，USD 保留美分 */
const DISPLAY_FRACTION_DIGITS: Readonly<Record<DisplayCurrency, number>> = {
  USD: 2,
  TWD: 0,
  KRW: 0,
  CNY: 0,
}

export function isEnabledCurrency(currency: unknown): currency is EnabledCurrency {
  return (
    typeof currency === 'string' && (ENABLED_CURRENCIES as readonly string[]).includes(currency)
  )
}

/** 平台与数据库可能使用小写代码；不在启用集合内时返回 null */
export function enabledCurrency(currency: unknown): EnabledCurrency | null {
  if (typeof currency !== 'string') return null
  const upper = currency.toUpperCase()
  return isEnabledCurrency(upper) ? upper : null
}

/** 该币种最小单位金额的步长（TWD 为 100，其余为 1） */
export function minorStep(currency: EnabledCurrency): number {
  return MINOR_STEP[currency]
}

/** 非负安全整数，且满足该币种的步长约束 */
export function isValidMinorAmount(amount: number, currency: string): boolean {
  const code = enabledCurrency(currency)
  return (
    code !== null && Number.isSafeInteger(amount) && amount >= 0 && amount % MINOR_STEP[code] === 0
  )
}

export function assertMinorAmount(amount: number, currency: string): void {
  if (!isValidMinorAmount(amount, currency))
    throw new Error(`Invalid ${String(currency).slice(0, 8)} minor amount`)
}

function exponentOf(currency: string): number {
  const exponent = CURRENCY_EXPONENT[currency.toUpperCase() as DisplayCurrency]
  if (exponent === undefined) throw new Error('Unsupported currency')
  return exponent
}

/**
 * 最小单位 → 主单位的十进制字符串（分析事件、运营通知使用）：
 * USD 199 → "1.99"，TWD 6500 → "65.00"，KRW 2800 → "2800"。用整数运算，避免浮点误差。
 */
export function toMajor(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount)) throw new Error('Amount must be a safe integer')
  const exponent = exponentOf(currency)
  if (exponent === 0) return String(amount)
  const sign = amount < 0 ? '-' : ''
  const digits = String(Math.abs(amount)).padStart(exponent + 1, '0')
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`
}

/**
 * 主单位输入 → 最小单位整数（后台退款输入框使用）。只接受不超过该币种展示小数位的非负十进制：
 * TWD 与 KRW 只接受整元，USD 最多两位小数。格式不符返回 null。
 */
export function toMinor(major: string | number, currency: EnabledCurrency): number | null {
  const text = typeof major === 'number' ? String(major) : major.trim()
  const fraction = DISPLAY_FRACTION_DIGITS[currency]
  const pattern = fraction === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${fraction}})?$`)
  if (!pattern.test(text)) return null
  const exponent = CURRENCY_EXPONENT[currency]
  const [whole = '0', part = ''] = text.split('.')
  const minor = Number(`${whole}${part.padEnd(exponent, '0')}`)
  return Number.isSafeInteger(minor) ? minor : null
}

/**
 * 按界面语言格式化最小单位金额：`NT$65`、`₩2,800`、`US$1.99`（en 为 `$1.99`）。
 * zh-Hant 的 Intl 把新台币显示为「$」，与美元无法区分，因此 TWD 一律按 en 格式输出「NT$」。
 */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const code = currency.toUpperCase() as DisplayCurrency
  const exponent = exponentOf(code)
  const digits = DISPLAY_FRACTION_DIGITS[code]
  return new Intl.NumberFormat(code === 'TWD' ? 'en' : locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** exponent)
}

/** 平台 ID 用字符串，避免依赖数据库枚举；只有 Stripe 支持本地币种，其余平台（PayPal 等）恒为 USD */
export type CheckoutProviderId = string

/** 界面语言 → Stripe 结算币种；未列出的语言（en、zh-Hans 等）以 USD 结算 */
const STRIPE_LOCALE_CURRENCY: Readonly<Record<string, EnabledCurrency>> = {
  'zh-Hant': 'TWD',
  ko: 'KRW',
}

/** 结算币种只由服务端按界面语言与支付平台决定；PayPal 所有语言都以 USD 结算（决策 2） */
export function currencyFor(locale: string, provider: CheckoutProviderId): EnabledCurrency {
  if (provider !== 'stripe') return 'USD'
  return STRIPE_LOCALE_CURRENCY[locale] ?? 'USD'
}

/** 支付平台是否以该币种结算：Stripe 接受全部启用币种，PayPal 等其余平台恒为 USD（决策 2） */
export function providerSettlesIn(provider: CheckoutProviderId, currency: string): boolean {
  const code = enabledCurrency(currency)
  return provider === 'stripe' ? code !== null : code === 'USD'
}

export interface SelectablePrice {
  readonly currency: string
}

/**
 * 在同一 (套餐, 支付平台, 周期) 的候选价格中选出要使用的一行：优先目标币种，缺失时回退 USD；
 * 都没有时返回 undefined。调用方负责先过滤出可售（有效且已同步）的价格行。
 * 结账（服务端选价）与页面展示共用此函数，保证展示币种与扣款币种一致。
 */
export function selectCurrencyPrice<P extends SelectablePrice>(
  candidates: readonly P[],
  target: EnabledCurrency,
): P | undefined {
  const of = (code: EnabledCurrency) =>
    candidates.find((price) => price.currency.toUpperCase() === code)
  return of(target) ?? (target === 'USD' ? undefined : of('USD'))
}
