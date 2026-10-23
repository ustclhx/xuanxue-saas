import { describe, expect, it } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { preferredLocale } from './preference.ts'
import { localeRewrite } from './routing.ts'
import { localePrefix } from './url-prefix.ts'

// add-zh-hans-locale tasks.md 6.2：简体前缀、偏好与占位文案
describe('zh-Hans 路由与占位', () => {
  it('简体前缀为小写 /zh-hans，繁体与简体互不相同', () => {
    expect(localePrefix('zh-Hans')).toBe('/zh-hans')
    expect(localePrefix('zh-Hant')).toBe('/zh-hant')
  })

  it('/zh/ 不是有效前缀（仍返回 404）', () => {
    const url = new URL('https://ganjiday.com/zh/八字排盤/')
    expect(localeRewrite.input({ url }).pathname.startsWith('/zh/')).toBe(true)
  })

  it('大陆简体标签归入 zh-Hans，台湾与香港标签仍归入 zh-Hant', () => {
    expect(preferredLocale('zh-CN,zh;q=0.9')).toBe('zh-Hans')
    expect(preferredLocale('zh-SG')).toBe('zh-Hans')
    expect(preferredLocale('zh-TW,zh;q=0.9')).toBe('zh-Hant')
    expect(preferredLocale('zh-HK')).toBe('zh-Hant')
  })

  it('结果页占位文案为简体', () => {
    expect(m.readings_coming_soon({}, { locale: 'zh-Hans' })).toBe('即将开放，敬请期待')
  })
})
