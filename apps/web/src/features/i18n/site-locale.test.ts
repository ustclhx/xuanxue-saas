import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { siteLocale } from './site-locale.ts'

const WEST = 'https://arcanumber.com'
const EAST = 'https://ganjiday.com'
const at = (locale: string, url: string) => siteLocale(locale, new URL(url), templateConfig)

describe.runIf(templateConfig.i18n.enabled)('浏览器端语言按站点约束', () => {
  it('西方站外站语言前缀的地址（404 页）按英文渲染，与服务端一致', () => {
    expect(at('zh-Hans', `${WEST}/zh-hans/login?redirect=%2Fapp`)).toBe('en')
    expect(at('ko', `${WEST}/ko/pricing`)).toBe('en')
  })

  it('应用区残留外站语言 Cookie 时改用本站语言，登录跳转不生成外站前缀', () => {
    expect(at('zh-Hans', `${WEST}/app?buy=reading_single`)).toBe('en')
    expect(at('en', `${EAST}/app`)).toBe('zh-Hant')
  })

  it('本站语言、东方站 /en 入口页与未登记的 Host 保持原样', () => {
    expect(at('en', `${WEST}/pricing`)).toBe('en')
    expect(at('ko', `${EAST}/ko/pricing`)).toBe('ko')
    expect(at('zh-Hans', `${EAST}/app`)).toBe('zh-Hans')
    expect(at('en', `${EAST}/en`)).toBe('en')
    expect(at('en', `${EAST}/en/pricing`)).toBe('zh-Hant')
    expect(at('zh-Hans', 'https://x.workers.dev/zh-hans/pricing')).toBe('zh-Hans')
  })
})
