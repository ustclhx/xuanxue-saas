import { expect, test } from '@playwright/test'
import { brandName } from '@xuanxue/config'
import templateConfig from '../../../template.config.ts'
import { localePrefix } from '../src/features/i18n/url-prefix.ts'

const { locales, defaultLocale } = templateConfig.i18n
const easternHomeTitles: Partial<Record<(typeof locales)[number], string>> = {
  'zh-Hant': '免費八字排盤｜生辰八字命盤查詢、大運流年與喜用神線上解析',
  'zh-Hans': '免费八字排盘｜生辰八字命盘查询、大运流年与喜用神线上解析',
  ko: '만세력 - 무료 사주 만세력 조회 (사주팔자 · 대운 · 신살)',
}
const legalPaths = ['/privacy', '/terms', '/refund']
const publicPaths = ['/', '/pricing', ...legalPaths]
if (templateConfig.features.blog)
  publicPaths.push(
    '/blog',
    '/blog/welcome',
    '/blog/writing-posts',
    '/blog/tags/guide',
    '/blog/tags/announcement',
  )
if (templateConfig.features.docs)
  publicPaths.push('/docs', '/docs/getting-started', '/docs/content', '/docs/configuration')
if (templateConfig.features.waitlist) publicPaths.push('/waitlist')
if (templateConfig.features.newsletter) publicPaths.push('/newsletter')

for (const locale of locales) {
  test(`公开路由 head 与唯一 canonical（${locale}）`, async ({ page }) => {
    const titles = new Set<string>()
    const canonicals = new Set<string>()
    // 法律页只有英文；其他语言的同一路径显示英文并 noindex（marketing.spec 覆盖）
    const paths =
      locale === 'en' ? publicPaths : publicPaths.filter((path) => !legalPaths.includes(path))
    for (const path of paths) {
      const prefix = locale === defaultLocale ? '' : localePrefix(locale)
      const response = await page.goto(`${prefix}${path === '/' ? '' : path}` || '/')
      expect(response?.status(), path).toBe(200)
      const title = await page.title()
      // 东方站首页按工具页的精确主词标题验收，简体与繁体、韩语遵循同一模式。
      const homeTitle = path === '/' ? easternHomeTitles[locale] : undefined
      if (homeTitle) expect(title, path).toBe(homeTitle)
      else expect(title, path).toContain(brandName(templateConfig, locale))
      expect(titles.has(title), path).toBe(false)
      titles.add(title)
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
      expect(canonical, path).toBeTruthy()
      expect(canonicals.has(canonical ?? ''), path).toBe(false)
      canonicals.add(canonical ?? '')
      expect(new URL(canonical ?? '').pathname).toBe(`${prefix}${path === '/' ? '' : path}` || '/')
      for (const name of ['description', 'twitter:card', 'twitter:image'])
        await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute('content', /\S/)
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        canonical ?? '',
      )
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        /^https?:\/\//,
      )
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1)
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
    }
    // 导航后也必须更换 canonical；localhost 预览使用西方站导航，定价链接为无前缀地址。
    await page.goto(locale === defaultLocale ? '/' : localePrefix(locale))
    await page.locator('header a[href="/pricing"]').click()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/pricing$/)
  })
}

test('地图发布过滤、robots 与 构建期 PNG 输出', async ({ request }) => {
  const response = await request.get('/sitemap/en.xml')
  expect(response.status()).toBe(200)
  const xml = await response.text()
  // 保留的模板示例是草稿，即使开启博客也不能进入站点地图。
  for (const path of [
    '/app',
    '/admin',
    '/api',
    '/blog/welcome',
    '/blog/writing-posts',
    'draft-example',
    'scheduled-example',
  ])
    expect(xml).not.toContain(path)
  const rules = await (await request.get('/robots.txt')).text()
  // 默认 localhost 属于预览 Host，禁止全部抓取；已知 Host 的规则由 dual-site-seo 验证。
  expect(rules).toContain('Disallow: /')
  for (const image of await Promise.all(
    ['/og/en/terms.png', '/og/en/privacy.png'].map((path) => request.get(path)),
  )) {
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toBe('image/png')
    const data = await image.body()
    expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(data.readUInt32BE(16)).toBe(1200)
    expect(data.readUInt32BE(20)).toBe(630)
  }
  expect((await request.get('/og/en/blog/draft-example.png')).status()).toBe(404)
})
