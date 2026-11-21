import { expect, type Page, test } from '@playwright/test'
import { fillTime } from './date-field.ts'

/**
 * 东方站根路径英文（openspec add-locales-eu-ja 5b.5）。开发服务器上东方站英文为 pending：
 * 本地主机 `east.localhost` 可直接访问（预览主机放行），正式域名上维持原跳转（单元测试 rollout.test.ts）。
 * 验收：两站英文页面互不链接、hreflang 不跨 host、东方站英文页面的 x-default 指向英文版本；
 * 只属于东方站英文的地址在西方站 404，东方站 `/en/*` 404。
 */
const localSite = (baseURL: string | undefined, site: string) => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${site}.localhost`
  return url.origin
}

const EAST_PAGES = [
  '/bazi-calculator',
  '/zi-wei-dou-shu',
  '/tarot-spreads',
  '/tarot-spreads/one-card',
  '/tarot-spreads/pick-a-card',
  '/tarot-spreads/celtic-cross',
  '/tarot-feelings',
  '/tarot-feelings/the-sun',
  '/tarot-feelings/knight-of-pentacles',
  '/faq',
  '/privacy',
]

async function headLinks(page: Page) {
  return page.$$eval('link[rel="canonical"], link[rel="alternate"][hreflang]', (links) =>
    links.map((link) => ({
      rel: link.getAttribute('rel'),
      hreflang: link.getAttribute('hreflang'),
      href: link.getAttribute('href') ?? '',
    })),
  )
}

test('东方站英文页面：英文、东方站品牌，canonical 与 hreflang 都在东方站，x-default 为英文版本', async ({
  page,
  baseURL,
}) => {
  const east = localSite(baseURL, 'east')
  for (const path of EAST_PAGES) {
    const response = await page.goto(`${east}${path}`)
    expect(response?.status(), path).toBe(200)
    await expect(page.locator('html'), path).toHaveAttribute('lang', 'en')
    await expect(page.locator('html'), path).toHaveAttribute('data-site', 'east')
    await expect(page, path).toHaveTitle(/Ganjiday/)
    const links = await headLinks(page)
    const canonical = links.find((link) => link.rel === 'canonical')?.href
    expect(canonical, path).toBe(`https://ganjiday.com${path}`)
    for (const link of links)
      expect(link.href, `${path} ${link.hreflang}`).toMatch(/^https:\/\/ganjiday\.com\//)
    const xDefault = links.filter((link) => link.hreflang === 'x-default')
    expect(xDefault, path).toHaveLength(1)
    expect(xDefault[0]?.href, path).toBe(`https://ganjiday.com${path}`)
  }
  // 有中文对应页的英文页面与之互为 hreflang（中文页的 en 在东方站英文发布后才出现）
  await page.goto(`${east}/tarot-feelings/the-sun`)
  const card = await headLinks(page)
  expect(card.find((link) => link.hreflang === 'zh-Hant')?.href).toBe(
    'https://ganjiday.com/zh-hant/%E5%A1%94%E7%BE%85/%E7%89%8C%E7%BE%A9/the-sun',
  )
})

test('两站英文页面互不链接：东方站英文页面没有指向西方站或西方站英文路径的链接，反之亦然', async ({
  page,
  baseURL,
}) => {
  const east = localSite(baseURL, 'east')
  const west = localSite(baseURL, 'west')
  for (const path of EAST_PAGES) {
    await page.goto(`${east}${path}`)
    const hrefs = await page.$$eval('a[href]', (links) =>
      links.map((a) => a.getAttribute('href') ?? ''),
    )
    for (const href of hrefs) {
      expect(href, `${path} → ${href}`).not.toMatch(/arcanumber/i)
      expect(href, `${path} → ${href}`).not.toMatch(
        /^\/(tarot(\/|$)|tarot\/cards|life-path-number|numerology|name-numerology|destiny-number|soul-urge-number)/,
      )
    }
  }
  for (const path of ['/', '/tarot', '/tarot/cards/the-sun', '/faq', '/pricing']) {
    await page.goto(`${west}${path}`)
    const hrefs = await page.$$eval('a[href]', (links) =>
      links.map((a) => a.getAttribute('href') ?? ''),
    )
    for (const href of hrefs) {
      expect(href, `${path} → ${href}`).not.toMatch(/ganjiday/i)
      expect(href, `${path} → ${href}`).not.toMatch(
        /^\/(bazi-calculator|zi-wei-dou-shu|tarot-spreads|tarot-feelings)/,
      )
    }
  }
})

test('只属于东方站英文的地址在西方站 404；东方站 /en/* 404，/en 仍 301 到 /', async ({
  request,
  baseURL,
}) => {
  const local = baseURL ?? 'http://localhost:3000'
  // Node 不解析 *.localhost：请求本机地址并带站点 Host（与 dual-site-seo.spec.ts 相同）
  const get = (site: string, path: string) =>
    request.get(`${local}${path}`, {
      maxRedirects: 0,
      headers: { host: new URL(localSite(baseURL, site)).host },
    })
  for (const path of ['/bazi-calculator', '/tarot-spreads/one-card', '/tarot-feelings/the-sun'])
    expect((await get('west', path)).status(), path).toBe(404)
  expect((await get('east', '/en/bazi-calculator')).status()).toBe(404)
  const legacy = await get('east', '/en')
  expect(legacy.status()).toBe(301)
  expect(new URL(legacy.headers().location ?? '', local).pathname).toBe('/')
})

test('东方站英文八字计算器：英文表单排出命盘，结果中没有指向中文概念页的链接', async ({
  page,
  baseURL,
}) => {
  const east = localSite(baseURL, 'east')
  // 提交前等待水合：否则表单按原生 GET 提交并刷新页面
  await page.goto(`${east}/bazi-calculator`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('BaZi')
  // 英文表单的出生地默认纽约（英语读者常见出生地排在前面）
  await expect(page.getByLabel('Place of birth')).toContainText('New York')
  await page.getByLabel('Year', { exact: true }).fill('1991')
  await page.getByLabel('Month', { exact: true }).fill('7')
  await page.getByLabel('Day', { exact: true }).fill('4')
  await fillTime(page, 'Time of birth', '09:15')
  await page.locator('form button[type="submit"]').click()
  await expect(page.locator('#pillars')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#result a[href*="/zh-hant/"]')).toHaveCount(0)
  // 农历日期用英文数字月日（不出现中文月名），神煞所在柱用英文逗号分隔
  await expect(page.locator('#result')).toContainText(/Lunar date: (leap )?month \d+, day \d+/)
  await expect(page.locator('[data-shensha][data-hit="true"]').first()).not.toContainText('、')
})
