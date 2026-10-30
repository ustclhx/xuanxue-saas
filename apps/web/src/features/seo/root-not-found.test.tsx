import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { SiteId } from '@xuanxue/config'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../styles/app.css?url', () => ({ default: '/app.css' }))
vi.mock('./origin.functions.ts', () => ({
  getSafeImpersonation: async () => null,
  getSeoOrigin: async () => 'https://arcanumber.com',
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

import { baseLocale, overwriteGetLocale } from '../../paraglide/runtime.js'
import { Route } from '../../routes/__root.tsx'
import { getCurrentSite } from '../site/site.functions.ts'

Route.addChildren([createRoute({ getParentRoute: () => Route, path: '/', component: () => null })])

afterEach(() => overwriteGetLocale(() => baseLocale))

describe('站点 404', () => {
  it.each([
    ['west', 'en', 'Page not found', 'Arcanumber', 'The page you are looking for does not exist.'],
    ['east', 'zh-Hant', '頁面不存在', '干支日', '找不到你要查看的頁面。'],
    ['east', 'zh-Hans', '页面不存在', '干支日', '找不到你要查看的页面。'],
    ['east', 'ko', '페이지를 찾을 수 없습니다', '간지데이', '요청하신 페이지가 존재하지 않습니다.'],
  ] as const)(
    '为 %s 的 %s 请求输出品牌标题与本语言正文',
    async (site, locale, title, brand, body) => {
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
      expect(html).toContain(`<title>${title} | ${brand}</title>`)
      expect(html).toContain(body)
      expect(html.match(/<title>.*?<\/title>/)?.[0]).not.toContain('xuanxue')
    },
  )
})
