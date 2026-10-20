import { themeInitScript } from '@xuanxue/ui'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../seo/origin.functions.ts', () => ({
  getSafeImpersonation: vi.fn(),
  getSeoOrigin: vi.fn(),
}))
vi.mock('../admin/settings-announcement.functions.ts', () => ({ getAnnouncement: vi.fn() }))
vi.mock('../admin/impersonation-banner.tsx', () => ({ ImpersonationBanner: () => null }))
vi.mock('../admin/settings-announcement-banner.tsx', () => ({ AnnouncementBanner: () => null }))
vi.mock('../i18n/language-controls.tsx', () => ({ LanguageControls: () => null }))

import { getLocale } from '../../paraglide/runtime.js'
import { Route } from '../../routes/__root.tsx'
import { templateConfig } from '../../server/template-config.ts'
import { SITE_THEME_SCRIPT, siteFontScript } from '../site/theme.ts'
import { analyticsHeadScripts } from './head.ts'

describe('分析脚本页面 head', () => {
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
