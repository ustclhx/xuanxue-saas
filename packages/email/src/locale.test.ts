import { describe, expect, it } from 'vitest'
import { matchLanguageTag, resolveEmailLocale } from './locale.ts'

describe('resolveEmailLocale', () => {
  it('旧消息与不支持的用户语言回退到配置的默认语言', () => {
    expect(resolveEmailLocale(undefined, 'zh-Hant')).toBe('zh-Hant')
    expect(resolveEmailLocale('fr', 'ko')).toBe('ko')
  })

  it.each([
    ['en', 'en'],
    ['en-US', 'en'],
    ['zh-Hant', 'zh-Hant'],
    ['zh', 'zh-Hant'],
    ['zh-TW', 'zh-Hant'],
    ['zh_Hant', 'zh-Hant'],
    [' ZH-tw ', 'zh-Hant'],
    ['zh-Hans', 'zh-Hans'],
    ['zh-CN', 'zh-Hans'],
    ['zh-SG', 'zh-Hans'],
    [' ZH-cn ', 'zh-Hans'],
    ['ko', 'ko'],
    ['ko-KR', 'ko'],
    ['es-MX', 'es'],
    ['es', 'es'],
    ['fr', 'en'],
    ['', 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ])('%j → %s', (input, expected) => {
    expect(resolveEmailLocale(input)).toBe(expected)
  })

  it('新语言按主语言匹配；带地区的 pt-BR 不匹配 pt-PT（add-locales-eu-ja 1.7）', () => {
    const locales = ['en', 'ja', 'es', 'pt-BR', 'fr'] as const
    expect(matchLanguageTag('ja-jp', locales)).toBe('ja')
    expect(matchLanguageTag('es-mx', locales)).toBe('es')
    expect(matchLanguageTag('es-419', locales)).toBe('es')
    expect(matchLanguageTag('pt', locales)).toBe('pt-BR')
    expect(matchLanguageTag('pt-br', locales)).toBe('pt-BR')
    expect(matchLanguageTag('pt-pt', locales)).toBeUndefined()
    expect(matchLanguageTag('fr-ca', locales)).toBe('fr')
    expect(matchLanguageTag('de', locales)).toBeUndefined()
  })
})
