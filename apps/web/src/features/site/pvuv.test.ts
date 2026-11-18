import { describe, expect, it } from 'vitest'
import { PVUV_EXCLUDE, pvuvHeadScripts } from './pvuv.ts'

const west = { id: 'west', known: true } as const
const east = { id: 'east', known: true } as const

function tag(id: string) {
  return [
    {
      src: 'https://www.pvuv.ai/f.js',
      defer: true,
      'data-site': id,
      'data-api': 'https://in.pvuv.ai',
      'data-exclude': PVUV_EXCLUDE,
    },
  ]
}

// 按 f.js 的 data-exclude 规则（`*` → `.*`，整段匹配）还原排除判断
function excluded(pathname: string) {
  return PVUV_EXCLUDE.split(',').some((pattern) =>
    new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(
      pathname,
    ),
  )
}

describe('pvuvHeadScripts', () => {
  it('已登记站点的公开页面各自输出本站 site id', () => {
    for (const pathname of ['/', '/pricing', '/zh/blog/post'])
      expect(pvuvHeadScripts(pathname, west)).toEqual(tag('9WXDSwET'))
    for (const pathname of ['/zh-hant', '/ko/pricing', '/en'])
      expect(pvuvHeadScripts(pathname, east)).toEqual(tag('jphDLWjj'))
  })

  it('应用区、后台、接口与未登记 Host 不输出', () => {
    for (const pathname of [
      '/app',
      '/app/personal/chat',
      '/account',
      '/admin/users',
      '/api/health',
    ])
      for (const site of [west, east]) expect(pvuvHeadScripts(pathname, site)).toEqual([])
    expect(pvuvHeadScripts('/', { id: 'west', known: false })).toEqual([])
  })

  it('某站 site id 为空时不输出', () => {
    expect(pvuvHeadScripts('/', east, { west: '9WXDSwET', east: ' ' })).toEqual([])
    expect(pvuvHeadScripts('/', west, { west: '9WXDSwET', east: '' })).toEqual(tag('9WXDSwET'))
  })

  it('客户端导航进入应用区时由 data-exclude 停止上报，公开路径不受影响', () => {
    for (const pathname of ['/app', '/app/x', '/account/billing', '/admin', '/api/health'])
      expect(excluded(pathname)).toBe(true)
    for (const pathname of ['/', '/apple', '/pricing', '/zh-hant/app', '/accounts'])
      expect(excluded(pathname)).toBe(false)
  })
})
