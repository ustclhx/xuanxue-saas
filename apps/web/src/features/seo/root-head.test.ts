import { describe, expect, it, vi } from 'vitest'

vi.mock('./origin.functions.ts', () => ({ getSafeImpersonation: vi.fn(), getSeoOrigin: vi.fn() }))
vi.mock('../admin/settings-announcement.functions.ts', () => ({ getAnnouncement: vi.fn() }))

vi.mock('../admin/impersonation-banner.tsx', () => ({ ImpersonationBanner: () => null }))
vi.mock('../admin/settings-announcement-banner.tsx', () => ({ AnnouncementBanner: () => null }))
vi.mock('../i18n/language-controls.tsx', () => ({
  LanguageMenu: () => null,
  LanguageSelect: () => null,
  LanguageSuggestion: () => null,
}))

import { Route } from '../../routes/__root.tsx'

describe('根布局页面 head', () => {
  it.each([
    ['east', '干支日'],
    ['west', 'Arcanumber'],
  ])('使用 %s 站点品牌作为默认标题', async (id, brand) => {
    const head = Route.options.head
    if (!head) throw new Error('Root head is missing')
    const result = await head({
      matches: [{ pathname: '/' }],
      loaderData: { site: { id, known: true } },
    } as Parameters<typeof head>[0])
    const title = result?.meta?.find((meta) => meta && 'title' in meta)?.title
    expect(title).toBe(brand)
    expect(title).not.toContain('xuanxue')
  })

  it('应用、账号与后台页面输出 noindex，公开营销和内容页面可索引', async () => {
    const head = Route.options.head
    if (!head) throw new Error('Root head is missing')
    for (const pathname of [
      '/app',
      '/app/personal/chat',
      '/account',
      '/admin',
      '/',
      '/blog/welcome',
      '/terms',
      '/docs/content',
    ]) {
      const result = await head({ matches: [{ pathname }] } as Parameters<typeof head>[0])
      const robots = result?.meta?.find((meta) => meta && 'name' in meta && meta.name === 'robots')
      const isPrivate = ['/app', '/account', '/admin'].some((prefix) => pathname.startsWith(prefix))
      expect(robots?.content, pathname).toBe(isPrivate ? 'noindex, nofollow' : undefined)
    }
  })
})
