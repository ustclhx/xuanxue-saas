import { expect, test } from '@playwright/test'
import { brandName } from '@xuanxue/config'
import templateConfig from '../../../template.config.ts'
import { localePrefix } from '../src/features/i18n/url-prefix.ts'

const { locales, defaultLocale } = templateConfig.i18n
// 首页为品牌标题（站名在前、不再追加站名）；内页为「页面标题 + 分隔符 + 站名」
// （openspec separate-landing-homepage design.md D3、D3a）
const homeTitles: Record<(typeof locales)[number], string> = {
  en: 'Numerology & Tarot Calculators, Free | Arcanumber',
  'zh-Hant': '干支日｜免費八字排盤、紫微斗數與塔羅',
  'zh-Hans': '干支日｜免费八字排盘、紫微斗数与塔罗',
  ko: '간지데이 | 무료 만세력·사주·타로',
}
const titleSuffix = (locale: string) =>
  `${locale.startsWith('zh') ? '｜' : ' | '}${brandName(templateConfig, locale)}`
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
      if (path === '/') expect(title, path).toBe(homeTitles[locale])
      else expect(title.endsWith(titleSuffix(locale)), `${path}: ${title}`).toBe(true)
      // 站名只出现一次；og:title 与 <title> 一致
      expect(title.split(brandName(templateConfig, locale)), path).toHaveLength(2)
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title)
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
    // 页头里有两个定价链接：桌面导航与手机导航面板，点可见的桌面导航
    await page.locator('header nav a[href="/pricing"]').first().click()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/pricing$/)
  })
}

test('主工具页与登录页的标题带站名（D3a）', async ({ page }) => {
  for (const [path, title] of [
    ['/life-path-number', 'Life Path Number Calculator: Free, With Every Step Shown | Arcanumber'],
    ['/zh-hant/八字排盤', '免費八字排盤｜線上排出四柱八字，看大運流年與喜用神｜干支日'],
    ['/zh-hans/八字排盘', '免费八字排盘｜在线生辰八字排盘、大运流年与喜用神解析｜干支日'],
    ['/ko/만세력', '만세력 - 무료 사주 만세력 조회 (사주팔자 · 대운 · 신살) | 간지데이'],
    ['/zh-hant/紫微斗數排盤', '紫微斗數排盤｜免費紫微命盤十二宮、主星與四化｜干支日'],
  ] as const) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page, path).toHaveTitle(title)
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(decodeURI(new URL(canonical ?? '').pathname), path).toBe(path)
    // 主工具页输出 WebApplication、BreadcrumbList 与 FAQPage，其中的 url 与 canonical 相同
    if (!path.includes('紫微')) {
      const data = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
        (json) => JSON.parse(json),
      )
      expect(data.map((item) => item['@type']).sort(), path).toEqual([
        'BreadcrumbList',
        'FAQPage',
        'WebApplication',
      ])
      expect(data.find((item) => item['@type'] === 'WebApplication')?.url, path).toBe(canonical)
    }
  }
  // 另一语言的 slug 没有登记
  expect((await page.goto('/ko/八字排盤'))?.status()).toBe(404)
  expect((await page.goto('/zh-hant/만세력'))?.status()).toBe(404)
  for (const [path, title] of [
    ['/login', 'Sign in | Arcanumber'],
    ['/zh-hant/login', /｜干支日$/],
    ['/ko/login', / \| 간지데이$/],
  ] as const) {
    await page.goto(path)
    await expect(page, path).toHaveTitle(title)
  }
})

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
  // 含样例 OG 模板的登记页面（redesign-home-chart-visuals 8.1）：开发服务器经 runnerImport 加载图形组件；
  // 样例图随注册表挂到主工具页（separate-landing-homepage OQ8），首页沿用默认分享图。
  // 渲染器有并发上限（超出时返回 500「renderer is busy」）：逐个请求
  for (const path of [
    '/og/en/terms.png',
    '/og/en/privacy.png',
    '/og/en/index.png',
    '/og/zh-hant/index.png',
    '/og/en/life-path-number.png',
    `/og/zh-hant/${encodeURIComponent('八字排盤')}.png`,
  ]) {
    const image = await request.get(path)
    expect(image.status(), path).toBe(200)
    expect(image.headers()['content-type']).toBe('image/png')
    const data = await image.body()
    expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(data.readUInt32BE(16)).toBe(1200)
    expect(data.readUInt32BE(20)).toBe(630)
  }
  expect((await request.get('/og/en/blog/draft-example.png')).status()).toBe(404)
})
