import { describe, expect, it } from 'vitest'
import { pageHref } from './common.tsx'

describe('pageHref', () => {
  it('按当前语言取 slug：简中页链到简体 slug（繁体 slug 在简中下 404）', () => {
    expect(decodeURI(pageHref('ziwei', 'zh-Hans'))).toBe('/zh-hans/紫微斗数排盘')
    expect(decodeURI(pageHref('mingpan', 'zh-Hans'))).toBe('/zh-hans/命盘查询')
    expect(decodeURI(pageHref('ziwei', 'zh-Hant'))).toBe('/zh-hant/紫微斗數排盤')
  })
})
