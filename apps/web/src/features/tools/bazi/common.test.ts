import { describe, expect, it } from 'vitest'
import { mingpanOrPricingLink, pageHref } from './common.tsx'

describe('pageHref', () => {
  it('按当前语言取 slug：简中页链到简体 slug（繁体 slug 在简中下 404）', () => {
    expect(decodeURI(pageHref('ziwei', 'zh-Hans'))).toBe('/zh-hans/紫微斗数排盘')
    expect(decodeURI(pageHref('mingpan', 'zh-Hans'))).toBe('/zh-hans/命盘查询')
    expect(decodeURI(pageHref('ziwei', 'zh-Hant'))).toBe('/zh-hant/紫微斗數排盤')
  })
})

describe('mingpanOrPricingLink', () => {
  it('有命盤查詢的语言链到命盤查詢，日语没有时改链本语言定价页', () => {
    expect(mingpanOrPricingLink('zh-Hant').map((item) => decodeURI(item.href))).toEqual([
      '/zh-hant/命盤查詢',
    ])
    expect(mingpanOrPricingLink('ja')).toMatchObject([{ href: '/ja/pricing', target: 'pricing' }])
  })
})
