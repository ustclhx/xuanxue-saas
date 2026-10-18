import { describe, expect, it } from 'vitest'
import { isPrerenderedPath, prerenderEntryPages } from './prerender.ts'

const locales = ['en', 'zh-Hant', 'ko']

describe('预渲染范围（tasks.md 3.1、3.3）', () => {
  it('首页、博客、法律页与文档在各语言下都预渲染', () => {
    for (const path of [
      '/',
      '/zh-hant',
      '/ko/',
      '/blog',
      '/blog/welcome',
      '/zh-hant/blog/tags/guide',
    ]) {
      expect(isPrerenderedPath(path, locales), path).toBe(true)
    }
    for (const path of [
      '/legal/refund',
      '/ko/legal/privacy',
      '/docs',
      '/zh-hant/docs/configuration',
    ]) {
      expect(isPrerenderedPath(path, locales), path).toBe(true)
    }
  })

  it('依赖数据库或会话的页面不预渲染', () => {
    for (const path of [
      '/pricing',
      '/ko/pricing',
      '/login',
      '/app',
      '/blogger',
      '/fr/blog',
      '/zh/blog',
    ]) {
      expect(isPrerenderedPath(path, locales), path).toBe(false)
    }
  })

  it('入口为各语言首页：默认语言无前缀，其他语言使用小写前缀', () => {
    expect(prerenderEntryPages(locales, 'en')).toEqual([
      { path: '/' },
      { path: '/zh-hant' },
      { path: '/ko' },
    ])
  })
})
