import { localeUrlSegment, type SiteId, siteBrandName, type TemplateConfig } from '@xuanxue/config'
import { resolveSite, siteOfLocale } from '../site/site.ts'

export type PresentationConfig = Pick<TemplateConfig, 'sites' | 'i18n'>

/** `returnTo`（已经 safeReturnPath 校验）开头的语言前缀；无前缀时返回 undefined */
function pathLocale(returnTo: string | undefined, config: PresentationConfig) {
  const [, first = ''] = (returnTo?.split('?')[0] ?? '').split('/')
  return config.i18n.locales.find((locale) => localeUrlSegment(locale) === first)
}

/**
 * 支付页展示（openspec enable-paypal-checkout D3）：品牌按请求 Host 所属站点；语言依次取
 * `returnTo` 的语言前缀、当前语言，二者都不属于该站点时取站点默认语言。
 * 未登记的 Host（staging / 预览）按语言所属站点取品牌。商品说明只由积分数与品牌拼成，
 * 不使用客户端文本，避免把出生信息等输入写进 PayPal 订单。
 */
export function checkoutPresentation(
  input: {
    requestUrl: string
    returnTo: string | undefined
    currentLocale: string | undefined
    /** 本地化的「N 积分」文案，复用定价页同一条消息 */
    credits: (count: number, locale: string) => string
  },
  config: PresentationConfig,
) {
  const fromPath = pathLocale(input.returnTo, config)
  const resolved = resolveSite(new URL(input.requestUrl).host, config)
  const site: SiteId = resolved.known
    ? resolved.id
    : (siteOfLocale(fromPath ?? input.currentLocale ?? '', config) ?? resolved.id)
  const { locales, defaultLocale } = config.sites[site]
  const owned = (locale: string | undefined): locale is string =>
    locale !== undefined && locales.some((item) => item === locale)
  const locale = [fromPath, input.currentLocale].find(owned) ?? defaultLocale ?? locales[0] ?? 'en'
  const brandName = siteBrandName(config, site, locale)
  return {
    brandName,
    locale,
    describe: (plan: { credits: number }) =>
      `${input.credits(plan.credits, locale)} · ${brandName}`,
  }
}
