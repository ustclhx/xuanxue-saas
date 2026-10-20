import { z } from 'zod'

/**
 * 模板配置（`template.config.ts`）：功能开关与产品形态，改代码、重新部署才生效。
 * 除 `app` 外每一项都有默认值（取自 docs/02-project-structure.md §3 草案），
 * 非法取值（未知的登录方式、计费方式等）在类型检查阶段报错。
 */

export type OAuthProvider = 'google' | 'github'
export type PaymentProvider = 'stripe' | 'paypal'
/** 'per_call' 按次 | 'token' 按 token | 'per_unit' 按张/秒 */
export type PricingMode = 'per_call' | 'token' | 'per_unit'
export type AiModality = 'text' | 'image' | 'video'
export type MediaProviderId = 'fal' | 'workers-ai'

export type DefaultLocale = 'en' | 'zh-Hant' | 'ko'

/** 东方站（繁中、韩语等）与西方站（英语等），同一个 Worker 按请求 Host 区分（openspec add-dual-site-foundation 决策 1）。 */
export const SITE_IDS = ['east', 'west'] as const
export type SiteId = (typeof SITE_IDS)[number]

export interface SiteConfig<L extends string = string> {
  /** 小写主机名（不含端口）；第一个为规范域名，用于生成绝对地址与跨站跳转 */
  readonly hosts: readonly string[]
  readonly locales: readonly L[]
  /** 无前缀地址使用的语言；null 表示本站没有无前缀的默认语言，根路径为语言入口页 */
  readonly defaultLocale: L | null
  /** name 用于结构化数据、未指定语言的场景；names 为各语言的显示名（如东方站繁中「干支日」） */
  readonly brand: { readonly name: string; readonly names: Readonly<Record<string, string>> }
  /** 本站对外联系邮箱（法律页、退款邮件等）；省略时沿用 `app.supportEmail` */
  readonly supportEmail: string
  /** 本站 Cloudflare Web Analytics 公开 site token；省略时沿用 `analytics.cloudflareToken` */
  readonly analyticsToken?: string
}

/**
 * 站点在某语言下的品牌显示名：语言专用名优先，否则用站点品牌名。
 * 页面标题、og:site_name、邮件主题等用户可见处统一经过这里，两站品牌互不混用。
 */
export function siteBrandName(
  config: { readonly sites: { readonly [S in SiteId]: SiteConfig } },
  site: SiteId,
  locale?: string | null,
): string {
  const { brand } = config.sites[site]
  return (locale ? brand.names[locale] : undefined) ?? brand.name
}

/** 语言所属站点的品牌显示名；未指定语言或语言不属于任何站点时用 `app.name` */
export function brandName(
  config: {
    readonly app: { readonly name: string }
    readonly sites: { readonly [S in SiteId]: SiteConfig }
  },
  locale?: string | null,
): string {
  const match = localeSite(config, locale)
  return match ? siteBrandName(config, match.site, match.locale) : config.app.name
}

/** 语言所属站点的联系邮箱；未指定语言或语言不属于任何站点时用 `app.supportEmail` */
export function supportEmail(
  config: {
    readonly app: { readonly supportEmail: string }
    readonly sites: { readonly [S in SiteId]: SiteConfig }
  },
  locale?: string | null,
): string {
  const match = localeSite(config, locale)
  return match ? config.sites[match.site].supportEmail : config.app.supportEmail
}

/**
 * 语言所属站点。用户语言可能是 `zh-TW`、`ko-KR` 这类原始值：精确匹配不到时按主语言标签匹配
 * （与邮件选语言一致）。
 */
function localeSite(
  config: { readonly sites: { readonly [S in SiteId]: SiteConfig } },
  locale?: string | null,
): { site: SiteId; locale: string } | undefined {
  if (!locale) return undefined
  const primary = (tag: string) => tag.trim().toLowerCase().split(/[-_]/)[0]
  const all = SITE_IDS.flatMap((site) =>
    config.sites[site].locales.map((item) => ({ site, locale: item as string })),
  )
  return (
    all.find((item) => item.locale === locale) ??
    all.find((item) => primary(item.locale) === primary(locale))
  )
}

/** 语言 id 在 URL 中的前缀段：BCP 47 的 `zh-Hant` 在 URL 中写作小写 `zh-hant`。 */
export function localeUrlSegment(locale: string): string {
  return locale.toLowerCase()
}

export const textConfigSchema = z.strictObject({
  enabled: z.boolean().default(true),
  thinking: z
    .strictObject({
      default: z.enum(['off', 'on']).default('off'),
      userToggle: z.boolean().default(false),
    })
    .prefault({}),
  reasoning: z.strictObject({ display: z.boolean().default(false) }).prefault({}),
  failedReplyRefund: z.enum(['no-visible-output', 'all']).default('no-visible-output'),
})

export type TextConfig = z.infer<typeof textConfigSchema>

/** 解析后的完整配置：所有选项都有值。 */
export interface TemplateConfig<L extends string = string> {
  readonly app: {
    readonly name: string
    readonly url: string
    readonly supportEmail: string
  }
  readonly i18n: {
    readonly enabled: boolean
    readonly locales: readonly L[]
    readonly defaultLocale: L
  }
  /** 每种语言恰好属于一个站点；未配置时全部语言属于西方站（`app.url` 的域名） */
  readonly sites: { readonly [S in SiteId]: SiteConfig<L> }
  readonly tenancy: {
    /** false = 仅个人空间；true = 允许团队 workspace */
    readonly multiTenant: boolean
    readonly maxWorkspacesPerUser: number
  }
  readonly auth: {
    readonly emailPassword: boolean
    /**
     * 邮箱密码注册是否必须先验证邮箱才能登录。默认否：注册不发验证邮件，
     * 由用户在账号设置或领取注册赠送积分时主动发起验证（docs/04-auth-and-tenancy.md §1）
     */
    readonly requireEmailVerification: boolean
    /** 邮箱验证码登录（emailOTP 插件） */
    readonly emailOtp: boolean
    /** 魔法链接登录（magicLink 插件） */
    readonly magicLink: boolean
    readonly oauth: readonly OAuthProvider[]
    readonly twoFactor: boolean
    readonly turnstile: boolean
  }
  readonly billing: {
    readonly enabled: boolean
    /** 结账页展示顺序 */
    readonly providers: readonly PaymentProvider[]
    /** ISO 4217 小写货币代码 */
    readonly currency: Lowercase<string>
    /** 邮箱验证后发放 */
    readonly signupBonusCredits: number
    /** past_due 期间保留权益的天数 */
    readonly pastDueGraceDays: number
    /** 订阅积分批次在周期末之后的额外有效期 */
    readonly subscriptionCreditGraceHours: number
    /** 实际消耗超出预扣时平台承担的上限，超出部分从余额补扣 / 记欠费 */
    readonly overage: {
      /** 单次最多承担预扣额的比例 */
      readonly maxRatio: number
      /** 单次最多承担的积分 */
      readonly maxCredits: number
      /** 每个空间每天最多承担的积分 */
      readonly dailyBudgetPerWorkspace: number
    }
    /** 可申请退款的付款时间范围；退款需人工审核，默认不主动退 */
    readonly refundWindowDays: number
  }
  readonly credits: {
    readonly enabled: boolean
  }
  readonly marketing: {
    readonly enabled: boolean
  }
  readonly ai: {
    readonly text: TextConfig
    readonly image: boolean
    readonly video: boolean
    /** 启用的媒体服务商；凭据与绑定仍由运行环境提供 */
    readonly mediaProviders: readonly MediaProviderId[]
    /** 新建模型时的默认计费方式，后台可逐个模型修改 */
    readonly defaultPricingMode: { readonly [M in AiModality]: PricingMode }
  }
  readonly features: {
    /** 产品分析仅在显式开启、用户同意且未设置 DNT 时加载 */
    readonly analytics: 'posthog' | false
    /** API Key 调用 /api/v1 */
    readonly publicApi: boolean
    readonly blog: boolean
    readonly docs: boolean
    readonly waitlist: boolean
    readonly newsletter: boolean
  }
  /** 这些值会发送到浏览器，只能填写公开的站点 token / 项目 key。 */
  readonly analytics: {
    readonly cloudflareToken: string
    readonly posthogKey: string
    readonly posthogHost: string
  }
}

type Section<K extends keyof TemplateConfig> = TemplateConfig[K]

/** `defineTemplateConfig` 的输入：`app` 必填，其余各项均可省略，嵌套对象可只写部分字段。 */
export interface TemplateConfigInput<L extends string = DefaultLocale> {
  app: Section<'app'>
  i18n?: {
    enabled?: boolean
    locales?: readonly L[]
    /** 必须是 `locales` 之一；省略时取 `locales[0]` */
    defaultLocale?: NoInfer<L>
  }
  sites?: {
    readonly [S in SiteId]: {
      hosts: readonly string[]
      locales: readonly NoInfer<L>[]
      defaultLocale?: NoInfer<L> | null
      /** name 省略时沿用 `app.name`；names 只能使用本站语言 */
      brand?: { name?: string; names?: Partial<Record<NoInfer<L>, string>> }
      /** 省略时沿用 `app.supportEmail` */
      supportEmail?: string
      /** 公开值，会发送到浏览器 */
      analyticsToken?: string
    }
  }
  tenancy?: Partial<Section<'tenancy'>>
  auth?: Partial<Section<'auth'>>
  billing?: Partial<Omit<Section<'billing'>, 'overage'>> & {
    overage?: Partial<Section<'billing'>['overage']>
  }
  credits?: Partial<Section<'credits'>>
  marketing?: Partial<Section<'marketing'>>
  ai?: Partial<Omit<Section<'ai'>, 'defaultPricingMode' | 'text'>> & {
    text?: z.input<typeof textConfigSchema>
    defaultPricingMode?: Partial<Section<'ai'>['defaultPricingMode']>
  }
  features?: Partial<Section<'features'>>
  analytics?: Partial<Section<'analytics'>>
}

/** 除 `app` 外的默认值，与 docs/02-project-structure.md §3 草案一致。 */
export const templateConfigDefaults = {
  i18n: { enabled: true, locales: ['en', 'zh-Hant', 'ko'], defaultLocale: 'en' },
  tenancy: { multiTenant: false, maxWorkspacesPerUser: 5 },
  auth: {
    emailPassword: true,
    requireEmailVerification: false,
    emailOtp: true,
    magicLink: false,
    oauth: ['google', 'github'],
    twoFactor: false,
    turnstile: true,
  },
  billing: {
    enabled: true,
    providers: ['stripe', 'paypal'],
    currency: 'usd',
    signupBonusCredits: 100,
    pastDueGraceDays: 7,
    subscriptionCreditGraceHours: 24,
    overage: { maxRatio: 0.2, maxCredits: 50, dailyBudgetPerWorkspace: 200 },
    refundWindowDays: 30,
  },
  credits: { enabled: true },
  marketing: { enabled: true },
  ai: {
    text: {
      enabled: true,
      thinking: { default: 'off', userToggle: false },
      reasoning: { display: false },
      failedReplyRefund: 'no-visible-output',
    },
    image: true,
    video: true,
    mediaProviders: ['fal', 'workers-ai'],
    defaultPricingMode: { text: 'token', image: 'per_call', video: 'per_call' },
  },
  features: {
    analytics: false,
    publicApi: false,
    blog: true,
    docs: false,
    waitlist: false,
    newsletter: false,
  },
  analytics: { cloudflareToken: '', posthogKey: '', posthogHost: 'https://us.i.posthog.com' },
} as const satisfies Omit<TemplateConfig<DefaultLocale>, 'app' | 'sites'>

/** 合并用户配置与默认值；数组整体替换，不与默认值合并。 */
export function defineTemplateConfig<const L extends string = DefaultLocale>(
  input: TemplateConfigInput<L>,
): TemplateConfig<L> {
  const d = templateConfigDefaults
  // 未提供 locales 时 L 取默认值 DefaultLocale，因此默认 locales 的类型与 L 一致
  const locales = input.i18n?.locales ?? (d.i18n.locales as readonly string[] as readonly L[])
  const defaultLocale = input.i18n?.defaultLocale ?? locales[0]
  if (defaultLocale === undefined) {
    throw new RangeError('template config: i18n.locales must not be empty')
  }
  if (!locales.includes(defaultLocale)) {
    throw new RangeError('template config: i18n.defaultLocale must be one of i18n.locales')
  }

  const config: TemplateConfig<L> = {
    app: { ...input.app },
    i18n: { enabled: input.i18n?.enabled ?? d.i18n.enabled, locales, defaultLocale },
    sites: resolveSites(input, locales, defaultLocale),
    tenancy: { ...d.tenancy, ...input.tenancy },
    auth: { ...d.auth, ...input.auth },
    billing: {
      ...d.billing,
      ...input.billing,
      overage: { ...d.billing.overage, ...input.billing?.overage },
    },
    credits: { ...d.credits, ...input.credits },
    marketing: { ...d.marketing, ...input.marketing },
    ai: {
      ...d.ai,
      ...input.ai,
      text: textConfigSchema.parse(input.ai?.text ?? {}),
      defaultPricingMode: { ...d.ai.defaultPricingMode, ...input.ai?.defaultPricingMode },
    },
    features: { ...d.features, ...input.features },
    analytics: { ...d.analytics, ...input.analytics },
  }

  if (config.billing.enabled && !config.credits.enabled) {
    throw new RangeError('template config: billing.enabled requires credits.enabled')
  }
  // AI 沿用套餐授权和积分结算；关闭计费时不能以隐式额度绕过这两个前置条件。
  if (config.ai.text.enabled || config.ai.image || config.ai.video) {
    if (!config.billing.enabled || !config.credits.enabled) {
      throw new RangeError('template config: AI requires billing.enabled and credits.enabled')
    }
  }

  return config
}

function resolveSites<L extends string>(
  input: TemplateConfigInput<L>,
  locales: readonly L[],
  defaultLocale: L,
): TemplateConfig<L>['sites'] {
  const brand = { name: input.app.name, names: {} }
  const supportEmail = input.app.supportEmail
  const configured = input.sites
  if (!configured) {
    // 未配置站点注册表时保持单站形态：全部语言属于西方站
    return {
      east: { hosts: [], locales: [], defaultLocale: null, brand, supportEmail },
      west: {
        hosts: [new URL(input.app.url).hostname],
        locales,
        defaultLocale,
        brand,
        supportEmail,
      },
    }
  }
  const site = (id: SiteId): SiteConfig<L> => ({
    hosts: [...configured[id].hosts],
    locales: [...configured[id].locales],
    defaultLocale: configured[id].defaultLocale ?? null,
    brand: {
      name: configured[id].brand?.name ?? brand.name,
      names: { ...(configured[id].brand?.names as Record<string, string> | undefined) },
    },
    supportEmail: configured[id].supportEmail ?? input.app.supportEmail,
    ...(configured[id].analyticsToken && { analyticsToken: configured[id].analyticsToken }),
  })
  const sites = { east: site('east'), west: site('west') }

  const owners = new Map<string, SiteId>()
  const hosts = new Set<string>()
  for (const id of SITE_IDS) {
    const site = sites[id]
    for (const locale of site.locales) {
      if (!locales.includes(locale))
        throw new RangeError(`template config: sites.${id} locale ${locale} is not in i18n.locales`)
      if (owners.has(locale))
        throw new RangeError(`template config: locale ${locale} belongs to more than one site`)
      owners.set(locale, id)
    }
    for (const locale of Object.keys(site.brand.names))
      if (!site.locales.includes(locale as L))
        throw new RangeError(
          `template config: sites.${id}.brand.names.${locale} is not a site locale`,
        )
    if (site.defaultLocale !== null && !site.locales.includes(site.defaultLocale))
      throw new RangeError(`template config: sites.${id}.defaultLocale must be one of its locales`)
    if (site.locales.length > 0 && site.hosts.length === 0)
      throw new RangeError(`template config: sites.${id}.hosts must not be empty`)
    for (const host of site.hosts) {
      if (!/^[a-z0-9.-]+$/.test(host))
        throw new RangeError(
          `template config: sites.${id} host ${host} must be a lowercase hostname`,
        )
      if (hosts.has(host)) throw new RangeError(`template config: host ${host} is listed twice`)
      hosts.add(host)
    }
  }
  const orphan = locales.find((locale) => !owners.has(locale))
  if (orphan !== undefined)
    throw new RangeError(`template config: locale ${orphan} does not belong to any site`)
  // 只有站点默认语言使用无前缀地址；i18n.defaultLocale 是 Paraglide 的 baseLocale，必须是其中之一
  if (!SITE_IDS.some((id) => sites[id].defaultLocale === defaultLocale))
    throw new RangeError('template config: i18n.defaultLocale must be the defaultLocale of a site')
  return sites
}
