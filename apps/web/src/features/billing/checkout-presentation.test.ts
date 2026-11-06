import { describe, expect, it } from 'vitest'
import templateConfig from '../../../../../template.config.ts'
import { checkoutPresentation } from './checkout-presentation.ts'

const credits = (count: number, locale: string) => `${count} credits[${locale}]`
const present = (requestUrl: string, returnTo?: string, currentLocale?: string) =>
  checkoutPresentation({ requestUrl, returnTo, currentLocale, credits }, templateConfig)

describe('checkout presentation (PayPal / Stripe)', () => {
  it.each([
    ['https://arcanumber.com/_serverFn/x', '/reading', 'en', 'Arcanumber', 'en'],
    ['https://ganjiday.com/_serverFn/x', '/zh-hant/bazi', 'en', '干支日', 'zh-Hant'],
    ['https://ganjiday.com/_serverFn/x', '/zh-hans/bazi', 'ko', '干支日', 'zh-Hans'],
    ['https://ganjiday.com/_serverFn/x', '/ko/manseryeok?x=1', 'zh-Hant', '간지데이', 'ko'],
  ])('%s %s uses the site brand and returnTo language', (url, returnTo, current, brand, locale) => {
    const result = present(url, returnTo, current)
    expect(result).toMatchObject({ brandName: brand, locale })
    expect(result.describe({ credits: 100 })).toBe(`100 credits[${locale}] · ${brand}`)
  })

  it('falls back to the current language, then the site default, within the request site', () => {
    expect(present('https://ganjiday.com/x', '/app/team/billing', 'ko').locale).toBe('ko')
    // 当前语言属于另一站点时不跨站使用，取东方站第一种语言
    expect(present('https://ganjiday.com/x', undefined, 'en')).toMatchObject({
      brandName: '干支日',
      locale: 'zh-Hant',
    })
    expect(present('https://arcanumber.com/x', '/ko/manseryeok', 'ko')).toMatchObject({
      brandName: 'Arcanumber',
      locale: 'en',
    })
  })

  it('uses the language site on unregistered preview hosts', () => {
    expect(present('https://web.example.workers.dev/x', '/ko/x', 'en').brandName).toBe('간지데이')
    expect(present('https://web.example.workers.dev/x', undefined, undefined)).toMatchObject({
      brandName: 'Arcanumber',
      locale: 'en',
    })
  })

  it.each([
    ['https://ganjiday.com/x', '/ko/x', 'east', 'GANJIDAY'],
    ['https://arcanumber.com/x', '/reading', 'west', 'ARCANUMBER'],
    // 未登记 Host 按语言所属站点，不会把东方站订单记到西方站
    ['https://web.example.workers.dev/x', '/zh-hant/bazi', 'east', 'GANJIDAY'],
  ])('%s %s tags the order site and Latin card statement suffix', (url, returnTo, site, suffix) => {
    expect(present(url, returnTo, 'en')).toMatchObject({ site, statementDescriptorSuffix: suffix })
  })
})
