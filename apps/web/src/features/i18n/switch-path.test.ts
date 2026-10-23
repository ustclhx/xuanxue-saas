import { describe, expect, it } from 'vitest'
import { switchLocalePath } from './switch-path.ts'

const locales = ['en', 'zh-Hant', 'ko']

describe('switchLocalePath', () => {
  it('工具页换成目标语言的对应路径（含已编码地址）', () => {
    expect(switchLocalePath('/tarot', 'zh-Hant', locales)).toBe('/塔羅')
    expect(switchLocalePath('/tarot/daily', 'ko', locales)).toBe('/타로/오늘의-카드')
    expect(switchLocalePath(encodeURI('/zh-hant/塔羅/凱爾特十字'), 'en', locales)).toBe(
      '/tarot/celtic-cross',
    )
    expect(switchLocalePath(encodeURI('/ko/타로/'), 'zh-Hant', locales)).toBe('/塔羅')
  })

  it('简体中文的工具页使用简体路径段', () => {
    const hans = ['en', 'zh-Hant', 'zh-Hans', 'ko']
    expect(switchLocalePath('/tarot', 'zh-Hans', hans)).toBe('/塔罗')
    expect(switchLocalePath('/tarot/celtic-cross', 'zh-Hans', hans)).toBe('/塔罗/凯尔特十字')
    expect(switchLocalePath(encodeURI('/zh-hans/塔罗/凯尔特十字'), 'zh-Hant', hans)).toBe(
      '/塔羅/凱爾特十字',
    )
  })

  it('目标语言没有该页面时回到首页', () => {
    expect(switchLocalePath(encodeURI('/zh-hant/紫微斗數排盤'), 'ko', locales)).toBe('/')
    expect(switchLocalePath('/life-path-number/7', 'zh-Hant', locales)).toBe('/')
  })

  it('共用页面保留原路径', () => {
    expect(switchLocalePath('/pricing', 'ko', locales)).toBe('/pricing')
    expect(switchLocalePath('/zh-hant/privacy', 'en', locales)).toBe('/privacy')
    expect(switchLocalePath('/blog/welcome', 'ko', locales)).toBe('/blog/welcome')
  })
})
