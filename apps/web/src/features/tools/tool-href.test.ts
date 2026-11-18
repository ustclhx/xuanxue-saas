import { describe, expect, it } from 'vitest'
import { legacyToolPath, mainToolHref, toolHref } from './tool-href.ts'

// openspec separate-landing-homepage design.md D4：迁移前保存的返回地址可能是语言首页
describe('主工具页地址与旧返回地址映射', () => {
  it('四个语言的主工具页地址（已编码，不带结尾斜杠）', () => {
    expect(mainToolHref('zh-Hant')).toBe(encodeURI('/zh-hant/八字排盤'))
    expect(mainToolHref('zh-Hans')).toBe(encodeURI('/zh-hans/八字排盘'))
    expect(mainToolHref('ko')).toBe(encodeURI('/ko/만세력'))
    expect(mainToolHref('en')).toBe('/life-path-number')
  })

  it('legacyToolPath 把四个语言首页映射到主工具页', () => {
    expect(legacyToolPath('/zh-hant')).toBe(encodeURI('/zh-hant/八字排盤'))
    expect(legacyToolPath('/zh-hans')).toBe(encodeURI('/zh-hans/八字排盘'))
    expect(legacyToolPath('/ko')).toBe(encodeURI('/ko/만세력'))
    expect(legacyToolPath('/')).toBe('/life-path-number')
  })

  it('其他路径原样返回', () => {
    for (const path of [
      toolHref('/八字排盤', 'zh-Hant'),
      toolHref('/紫微斗數排盤', 'zh-Hant'),
      encodeURI('/ko/사주궁합'),
      '/life-path-number',
      '/life-path-number/7',
      '/numerology-calculator',
      '/tarot',
      '/app/acme',
      '/en',
      '/zh-hant/pricing',
      '/zh-hant/',
      '',
    ])
      expect(legacyToolPath(path), path).toBe(path)
  })
})
