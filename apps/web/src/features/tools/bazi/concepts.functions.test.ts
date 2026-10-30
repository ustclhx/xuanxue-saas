import { isNotFound, isRedirect } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import { getConceptPage } from './concepts.functions.ts'

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      inputValidator: () => builder,
      handler: (handler: (input: unknown) => unknown) => handler,
    }
    return builder
  },
}))
vi.mock('content-collections', async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(
    new URL('../../../../.content-collections/generated/allConcepts.js', import.meta.url),
    'utf8',
  )
  return {
    allConcepts: JSON.parse(
      source
        .replace(/^\s*export default\s*/, '')
        .trim()
        .replace(/;$/, ''),
    ),
  }
})

describe('简体概念页别名', () => {
  it.each([
    ['大運', '大运'],
    ['身強身弱', '身强身弱'],
  ])('%s 永久跳转到规范简体 slug %s', (alias, slug) => {
    let caught: unknown
    try {
      getConceptPage({ data: { locale: 'zh-Hans', slug: alias } })
    } catch (error) {
      caught = error
    }
    expect(isRedirect(caught)).toBe(true)
    expect(caught).toMatchObject({
      status: 301,
      options: { href: `/zh-hans/${encodeURI(`八字/${slug}`)}`, statusCode: 301 },
    })
  })

  it('规范 slug 直接返回内容；未知 slug 和其他语言不使用简体别名', () => {
    expect(getConceptPage({ data: { locale: 'zh-Hans', slug: '大运' } })).toMatchObject({
      locale: 'zh-Hans',
      slug: '大运',
    })
    for (const data of [
      { locale: 'zh-Hans', slug: '不存在' },
      { locale: 'ko', slug: '大運' },
      { locale: 'zh-Hant', slug: '大运' },
    ]) {
      let caught: unknown
      try {
        getConceptPage({ data })
      } catch (error) {
        caught = error
      }
      expect(isNotFound(caught)).toBe(true)
    }
  })
})
