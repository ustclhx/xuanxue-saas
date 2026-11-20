import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('@tanstack/react-router', () => ({
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select(route),
}))

import { LocalePrompt } from './locale-prompt.tsx'
import { matchBrowserLocale, promptDismissedKey, promptLocales } from './prompt-match.ts'

/**
 * 语言切换提示（使用者 2026-11-20 网址规则）：不自动跳转、不进入 SSR HTML，只在客户端按浏览器语言提示。
 */
describe('语言切换提示', () => {
  it('服务端渲染不输出提示（爬虫与首帧 HTML 中没有提示）', () => {
    for (const pathname of ['/', '/zh-hant', '/pricing']) {
      route.pathname = pathname
      expect(renderToString(<LocalePrompt />)).toBe('')
    }
  })

  it('按浏览器偏好匹配配置语言：完整标签、书写系统、主语言；pt-PT 不匹配 pt-BR', () => {
    const locales = ['en', 'zh-Hant', 'zh-Hans', 'ko', 'ja', 'es', 'pt-BR'] as const
    expect(matchBrowserLocale(['zh-TW'], locales)).toBe('zh-Hant')
    expect(matchBrowserLocale(['zh-CN'], locales)).toBe('zh-Hans')
    expect(matchBrowserLocale(['ko-KR'], locales)).toBe('ko')
    expect(matchBrowserLocale(['ja-JP'], locales)).toBe('ja')
    expect(matchBrowserLocale(['es-MX'], locales)).toBe('es')
    expect(matchBrowserLocale(['pt'], locales)).toBe('pt-BR')
    expect(matchBrowserLocale(['pt-PT'], locales)).toBeUndefined()
    expect(matchBrowserLocale(['fr', 'ko'], locales)).toBe('ko')
  })

  it('只提示当前页确有的语言版本、不是当前语言；关闭过不再提示；不带地区的 zh 给简繁两个候选', () => {
    const locales = ['en', 'zh-Hant', 'zh-Hans', 'ko', 'ja'] as const
    const base = {
      locales,
      offerable: ['zh-Hant', 'zh-Hans', 'ko', 'en'],
      current: 'en',
      dismissed: false,
    }
    expect(promptLocales({ ...base, languages: ['zh-TW', 'en'] })).toEqual(['zh-Hant'])
    // 最想要的语言就是当前语言：不提示后面的偏好
    expect(promptLocales({ ...base, languages: ['en-US', 'ko'] })).toEqual([])
    // 当前页没有该语言版本（或未发布）：不提示
    expect(promptLocales({ ...base, languages: ['ja-JP'] })).toEqual([])
    expect(promptLocales({ ...base, offerable: ['en', 'zh-Hant'], languages: ['ko'] })).toEqual([])
    expect(promptLocales({ ...base, languages: ['ko'], dismissed: true })).toEqual([])
    expect(promptLocales({ ...base, languages: ['zh', 'en'] })).toEqual(['zh-Hans', 'zh-Hant'])
    // 当前页已是中文：不再给中文候选
    expect(promptLocales({ ...base, current: 'zh-Hant', languages: ['zh'] })).toEqual([])
    // 东方站繁中页面，英文浏览器：英文版本可提示
    expect(promptLocales({ ...base, current: 'zh-Hant', languages: ['en-GB'] })).toEqual(['en'])
  })

  it('关闭记录按站点分开保存', () => {
    expect(promptDismissedKey('east')).not.toBe(promptDismissedKey('west'))
  })
})
