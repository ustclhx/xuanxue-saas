import { describe, expect, it } from 'vitest'
import { resolveEmailLocale } from './locale.ts'

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
    ['zh-CN', 'zh-Hant'],
    ['zh_Hant', 'zh-Hant'],
    [' ZH-tw ', 'zh-Hant'],
    ['ko', 'ko'],
    ['ko-KR', 'ko'],
    ['fr', 'en'],
    ['', 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ])('%j → %s', (input, expected) => {
    expect(resolveEmailLocale(input)).toBe(expected)
  })
})
