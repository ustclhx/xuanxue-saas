import { describe, expect, it } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { locales } from '../../paraglide/runtime.js'
import { preferredLocale, SUGGESTION_ALIASES } from './preference.ts'
import { localeRewrite } from './routing.ts'
import { localeSuggestionScript, SUGGESTION_ATTRIBUTE } from './suggestion.ts'
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

  it('首帧前语言建议脚本与 preferredLocale 的中文归属一致', () => {
    const script = localeSuggestionScript({
      baseLocale: 'en',
      locales,
      preferenceCookie: 'locale-preference',
      localeCookie: 'PARAGLIDE_LOCALE',
      cookieMaxAge: 1,
      aliases: SUGGESTION_ALIASES,
    })
    const suggest = (language: string) => {
      const attributes = new Map<string, string>()
      const document = {
        cookie: '',
        documentElement: { lang: 'en', setAttribute: attributes.set.bind(attributes) },
      }
      const window = { addEventListener() {} }
      new Function('document', 'navigator', 'window', 'location', script)(
        document,
        { languages: [language] },
        window,
        { protocol: 'https:' },
      )
      return attributes.get(SUGGESTION_ATTRIBUTE)
    }
    for (const tag of ['zh-CN', 'zh-SG', 'zh-TW', 'zh-HK', 'zh', 'zh-Hant-TW', 'ko-KR'])
      expect(suggest(tag), tag).toBe(preferredLocale(tag))
  })

  it('结果页占位文案为简体', () => {
    expect(m.readings_coming_soon({}, { locale: 'zh-Hans' })).toBe(
      'AI 详批尚未开放，目前无法购买或解锁。上方结果是免费计算，可照常使用。',
    )
  })
})
