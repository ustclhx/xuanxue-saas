import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { SiteId } from '@xuanxue/config'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../styles/app.css?url', () => ({ default: '/app.css' }))
vi.mock('./origin.functions.ts', () => ({
  getSafeImpersonation: async () => null,
  getSeoOrigin: async () => 'https://arcanumber.com',
  getPlausibleSite: async () => null,
}))
vi.mock('../site/site.functions.ts', () => ({ getCurrentSite: vi.fn() }))
vi.mock('../marketing/content.functions.ts', () => ({ getBlogLocales: async () => [] }))
vi.mock('../admin/settings-announcement.functions.ts', () => ({
  getAnnouncement: async () => null,
}))
vi.mock('../admin/impersonation-banner.tsx', () => ({ ImpersonationBanner: () => null }))
vi.mock('../admin/settings-announcement-banner.tsx', () => ({ AnnouncementBanner: () => null }))
vi.mock('../analytics/analytics.tsx', () => ({ ProductAnalytics: () => null }))
vi.mock('../i18n/language-controls.tsx', () => ({ LanguageSuggestion: () => null }))
vi.mock('../theme/theme-toggle.tsx', () => ({ ThemeToggle: () => null }))
// 页头与页脚有各自的测试；这里只看 404 正文
vi.mock('../marketing/marketing-shell.tsx', () => ({
  MarketingShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('../theme/html-attributes.isomorphic.ts', () => ({ getHtmlAttributes: () => ({}) }))

import { baseLocale, overwriteGetLocale } from '../../paraglide/runtime.js'
import { Route } from '../../routes/__root.tsx'
import { getCurrentSite } from '../site/site.functions.ts'

Route.addChildren([createRoute({ getParentRoute: () => Route, path: '/', component: () => null })])

afterEach(() => overwriteGetLocale(() => baseLocale))

describe('站点 404', () => {
  it.each([
    [
      'west',
      'en',
      'Page not found | Arcanumber',
      'The address may be mistyped, or the page has moved.',
      [
        ['/life-path-number', 'life path number'],
        ['/tarot', 'three-card tarot'],
        ['/', 'Back to Arcanumber home'],
      ],
    ],
    // 中文标题用全角竖线连接站名（separate-landing-homepage design.md D3a）
    [
      'east',
      'zh-Hant',
      '頁面不存在｜干支日',
      '網址可能輸入有誤，或頁面已經移動。',
      [
        [encodeURI('/zh-hant/八字排盤'), '八字排盤'],
        [encodeURI('/zh-hant/塔羅'), '三張牌塔羅'],
        ['/zh-hant', '返回干支日首頁'],
      ],
    ],
    [
      'east',
      'zh-Hans',
      '页面不存在｜干支日',
      '网址可能输入有误，或页面已经移动。',
      [
        [encodeURI('/zh-hans/八字排盘'), '八字排盘'],
        [encodeURI('/zh-hans/塔罗'), '三张牌塔罗'],
        ['/zh-hans', '返回干支日首页'],
      ],
    ],
    [
      'east',
      'ko',
      '페이지를 찾을 수 없습니다 | 간지데이',
      '주소가 잘못 입력되었거나 페이지가 이동했을 수 있습니다.',
      [
        [encodeURI('/ko/만세력'), '만세력'],
        [encodeURI('/ko/타로'), '쓰리 카드 타로'],
        ['/ko', '간지데이 홈으로 돌아가기'],
      ],
    ],
  ] as const)(
    '为 %s 的 %s 请求输出品牌标题、本语言正文与本站链接',
    async (site, locale, title, body, links) => {
      overwriteGetLocale(() => locale)
      vi.mocked(getCurrentSite).mockResolvedValue({ id: site as SiteId, known: true })
      const router = createRouter({
        routeTree: Route,
        history: createMemoryHistory({ initialEntries: ['/missing-page'] }),
        isServer: true,
      })
      await router.load()
      const html = renderToString(<RouterProvider router={router} />)
      expect(
        router.state.matches.some((match) => match._notFound || match.status === 'notFound'),
      ).toBe(true)
      expect(html).toContain(`<title>${title}</title>`)
      expect(html).toContain(body)
      // 正文内链 2 条（主工具、三张牌塔罗）+ 回首页的主按钮；都是本站本语言的地址
      expect(
        [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((match) => [
          match[1],
          match[2],
        ]),
      ).toEqual(links)
      expect(html.match(/<title>.*?<\/title>/)?.[0]).not.toContain('xuanxue')
    },
  )
})
