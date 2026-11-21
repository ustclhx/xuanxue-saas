import { describe, expect, it, vi } from 'vitest'

vi.mock('./origin.functions.ts', () => ({ getSafeImpersonation: vi.fn(), getSeoOrigin: vi.fn() }))
vi.mock('../admin/settings-announcement.functions.ts', () => ({ getAnnouncement: vi.fn() }))
vi.mock('../marketing/content.functions.ts', () => ({ getBlogLocales: vi.fn() }))

vi.mock('../admin/impersonation-banner.tsx', () => ({ ImpersonationBanner: () => null }))
vi.mock('../admin/settings-announcement-banner.tsx', () => ({ AnnouncementBanner: () => null }))
vi.mock('../i18n/language-controls.tsx', () => ({
  LanguageMenu: () => null,
  LanguageDropdown: () => null,
}))
vi.mock('../i18n/language-select.tsx', () => ({ LanguageSelect: () => null }))

import { Route } from '../../routes/__root.tsx'
import { overrideRelease } from '../i18n/rollout-fixture.ts'

describe('根布局页面 head', () => {
  // 测试中当前语言为 en：东方站英文发布后（2026-11-21）东方站用英文站名，发布前回退到繁中站名
  it.each([
    ['east', 'Ganjiday', false],
    ['east', '干支日', true],
    ['west', 'Arcanumber', false],
  ])('使用 %s 站点品牌作为默认标题（%s）', async (id, brand, beforeRelease) => {
    const head = Route.options.head
    if (!head) throw new Error('Root head is missing')
    const restore = beforeRelease ? overrideRelease({ east: { en: 'pending' } }) : () => {}
    try {
      const result = await head({
        matches: [{ pathname: '/' }],
        loaderData: { site: { id, known: true } },
      } as Parameters<typeof head>[0])
      const title = result?.meta?.find((meta) => meta && 'title' in meta)?.title
      expect(title).toBe(brand)
      expect(title).not.toContain('xuanxue')
    } finally {
      restore()
    }
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
