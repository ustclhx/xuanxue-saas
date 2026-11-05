import { themeInitScript } from '@xuanxue/ui'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../seo/origin.functions.ts', () => ({
  getSafeImpersonation: vi.fn(),
  getSeoOrigin: vi.fn(),
}))
vi.mock('../admin/settings-announcement.functions.ts', () => ({ getAnnouncement: vi.fn() }))
vi.mock('../marketing/content.functions.ts', () => ({ getBlogLocales: vi.fn() }))
vi.mock('../admin/impersonation-banner.tsx', () => ({ ImpersonationBanner: () => null }))
vi.mock('../admin/settings-announcement-banner.tsx', () => ({ AnnouncementBanner: () => null }))
vi.mock('../i18n/language-controls.tsx', () => ({
  LanguageMenu: () => null,
  LanguageSelect: () => null,
  LanguageSuggestion: () => null,
}))

import { getLocale } from '../../paraglide/runtime.js'
import { Route } from '../../routes/__root.tsx'
import { templateConfig } from '../../server/template-config.ts'
import { SITE_THEME_SCRIPT, siteFontScript } from '../site/theme.ts'
import { analyticsHeadScripts } from './head.ts'

const site = { domain: 'acme-staging', scriptUrl: 'https://plausible.example/js/script.manual.js' }

describe('分析脚本页面 head', () => {
  // 未登记 Host 不输出 Cloudflare beacon，便于单独断言 Plausible 部分
  const preview = { id: 'west', known: false } as const

  it('Plausible 按环境注入本站 site，应用区加载，后台与接口不加载', () => {
    for (const pathname of ['/', '/zh/pricing', '/app/personal/chat', '/account'])
      expect(analyticsHeadScripts(pathname, preview, templateConfig, site)).toEqual([
        { src: site.scriptUrl, defer: true, 'data-domain': 'acme-staging' },
      ])
    for (const pathname of ['/admin', '/admin/users', '/api/health'])
      expect(analyticsHeadScripts(pathname, preview, templateConfig, site)).toEqual([])
    expect(analyticsHeadScripts('/', preview, templateConfig, null)).toEqual([])
  })

  it('多站时只输出内联映射，不带 data-domain 的脚本，后台与接口同样不输出', () => {
    const multi = { ...site, domain: '', sites: { 'a.example': 'a', 'b.example': 'b</script>' } }
    for (const pathname of ['/', '/app/personal/chat']) {
      const scripts = analyticsHeadScripts(pathname, preview, templateConfig, multi)
      expect(scripts).toEqual([
        { type: 'application/json', id: 'xuanxue-plausible', children: expect.any(String) },
      ])
      const children = (scripts[0] as { children: string }).children
      expect(children).not.toContain('<')
      expect(JSON.parse(children)).toEqual({
        sites: multi.sites,
        fallback: '',
        scriptUrl: site.scriptUrl,
      })
      expect(JSON.stringify(scripts)).not.toContain('data-domain')
    }
    for (const pathname of ['/admin', '/api/health'])
      expect(analyticsHeadScripts(pathname, preview, templateConfig, multi)).toEqual([])
  })

  it('默认页面 head 无 PostHog 或 beacon，主题与站点主题内联脚本保持原样', async () => {
    const head = Route.options.head
    if (!head) throw new Error('Root head is missing')
    for (const pathname of ['/', '/zh-hant/pricing', '/app/personal/chat', '/admin/users']) {
      const result = await head({ matches: [{ pathname }] } as Parameters<typeof head>[0])
      expect(result?.scripts).toEqual([
        { children: themeInitScript() },
        { children: SITE_THEME_SCRIPT },
        { children: siteFontScript('west', getLocale()) },
      ])
      // 字体样式表由脚本插入，不以阻塞渲染的 <link rel="stylesheet"> 出现
      expect(result?.links?.filter((link) => link?.rel === 'stylesheet')).toHaveLength(1)
      expect(JSON.stringify(result?.scripts)).not.toMatch(/posthog|beacon/i)
    }
  })

  it('按站点 token 在已登记域名的公开页面输出 defer beacon，应用、后台与预览域名不输出', () => {
    const beacon = (token: string) => [
      {
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        defer: true,
        'data-cf-beacon': `{"token":"${token}","spa":false}`,
      },
    ]
    const east = { id: 'east', known: true } as const
    const west = { id: 'west', known: true } as const
    expect(analyticsHeadScripts('/zh-hant/pricing', east, templateConfig)).toEqual(
      beacon('21bda25feef743088c8ca9fb63b76a36'),
    )
    expect(analyticsHeadScripts('/pricing', west, templateConfig)).toEqual(
      beacon('aa32b146781b4880aa9686d85c3a8f66'),
    )
    expect(analyticsHeadScripts('/pricing', { id: 'west', known: false }, templateConfig)).toEqual(
      [],
    )
    for (const pathname of ['/app', '/account', '/admin', '/admin/users', '/api/health'])
      expect(analyticsHeadScripts(pathname, west, templateConfig)).toEqual([])
  })
})
