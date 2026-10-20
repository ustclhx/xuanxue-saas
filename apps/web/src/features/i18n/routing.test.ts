import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseLocale, locales, overwriteGetLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { NOT_FOUND_PATH } from '../admin/gate.ts'
import { gateLocaleRequest } from './gate.ts'
import { localeRewrite } from './routing.ts'
import { localePrefix } from './url-prefix.ts'

const otherLocale = locales.find((locale) => locale !== baseLocale) ?? baseLocale
const otherPrefix = localePrefix(otherLocale)
const enabled = templateConfig.i18n.enabled

const origin = 'https://arcanumber.com'
const url = (path: string) => new URL(path, origin)
const gated = (path: string) => new URL(gateLocaleRequest(new Request(url(path))).url).pathname
const input = (path: string) => new URL(String(localeRewrite.input({ url: url(path) }))).pathname
const output = (path: string) => new URL(String(localeRewrite.output({ url: url(path) }))).pathname

describe('语言路由（默认语言与其他配置语言）', () => {
  beforeEach(() => overwriteGetLocale(() => baseLocale))
  afterEach(() => overwriteGetLocale(() => baseLocale))

  it('默认语言无前缀：路由器看到的就是原地址，生成的链接也不加前缀', () => {
    expect(gated('/pricing')).toBe('/pricing')
    expect(input('/pricing')).toBe('/pricing')
    expect(output('/pricing')).toBe('/pricing')
  })

  it('其他配置语言：去掉语言前缀后交给路由器，生成链接时按当前语言加回前缀', () => {
    expect(gated(`${otherPrefix}/pricing`)).toBe(
      enabled ? `${otherPrefix}/pricing` : NOT_FOUND_PATH,
    )
    expect(input(`${otherPrefix}/pricing`)).toBe(enabled ? '/pricing' : `${otherPrefix}/pricing`)
    expect(input(`${otherPrefix}`)).toBe(enabled ? '/' : `${otherPrefix}`)
    overwriteGetLocale(() => otherLocale)
    expect(output('/pricing')).toBe(enabled ? `${otherPrefix}/pricing` : '/pricing')
  })

  it('配置语言前缀在单语言模式全部拒绝，语言改写保留原 URL', () => {
    for (const locale of templateConfig.i18n.locales) {
      const path = `${localePrefix(locale)}/pricing`
      expect(gated(path)).toBe(enabled ? path : NOT_FOUND_PATH)
      if (!enabled) {
        expect(input(path)).toBe(path)
        expect(output(path)).toBe(path)
      }
    }
  })

  it('未配置的前缀保持原样，由路由器按不存在的页面返回 404', () => {
    // /zh 已移除；语言 id 的大写写法也不是前缀（URL 只用小写 /zh-hant）
    for (const path of ['/fr/pricing', '/zh/pricing', '/zh-Hant/pricing']) {
      expect(gated(path)).toBe(path)
      expect(input(path)).toBe(path)
    }
  })

  it('应用区不加语言前缀：带前缀访问改写到 404，链接也不加前缀', () => {
    for (const path of ['/app', '/app/acme', '/account', '/admin', '/api/health']) {
      expect(gated(`${otherPrefix}${path}`)).toBe(NOT_FOUND_PATH)
    }
    expect(gated('/en/admin')).toBe(NOT_FOUND_PATH)
    expect(gated('/app')).toBe('/app')
    expect(gated(`${otherPrefix}/apple`)).toBe(enabled ? `${otherPrefix}/apple` : NOT_FOUND_PATH)
    overwriteGetLocale(() => otherLocale)
    expect(output('/app/acme')).toBe('/app/acme')
    expect(output('/api/health')).toBe('/api/health')
  })
})
