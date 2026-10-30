import { expect, test } from '@playwright/test'

const localSite = (baseURL: string | undefined, site: string) => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${site}.localhost`
  return url.origin
}

test('韩语浏览器从东方站根路径直接进入韩语首页，禁用 JS 同样跳转', async ({ browser, baseURL }) => {
  const east = localSite(baseURL, 'east')
  const context = await browser.newContext({ locale: 'ko-KR' })
  const page = await context.newPage()
  await page.goto(`${east}/`)
  await expect(page).toHaveURL(`${east}/ko`)
  await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
  // 东方站只提供本站语言，不能把英语工具或无前缀营销地址带到东方站。
  const navigation = page.getByRole('navigation', { name: '도구', exact: true })
  const links = navigation.getByRole('link')
  await expect(links).toHaveText(['만세력', '사주궁합', '쓰리 카드 타로', '요금제'])
  for (const link of await links.all()) await expect(link).toHaveAttribute('href', /^\/ko(?:\/|$)/)
  const noJs = await browser.newContext({ javaScriptEnabled: false, locale: 'ko-KR' })
  const staticPage = await noJs.newPage()
  // 302 由服务端完成，禁用 JS 时也应落在语言首页
  await staticPage.goto(`${east}/`)
  await expect(staticPage).toHaveURL(`${east}/ko`)
  await noJs.close()
  await context.close()
})

test('Host 决定地图索引与抓取规则；内部入口不对外暴露', async ({ request, baseURL }) => {
  const east = baseURL ?? 'http://localhost:3000'
  const west = east
  const eastOptions = { headers: { host: new URL(localSite(baseURL, 'east')).host } }
  const westOptions = { headers: { host: new URL(localSite(baseURL, 'west')).host } }
  const index = await request.get(`${east}/sitemap.xml`, eastOptions)
  expect(index.status()).toBe(200)
  expect(await index.text()).toContain('https://ganjiday.com/sitemap/ko.xml')
  // 东方站 en 子图只有英文入口页（D5）
  expect(await index.text()).toContain('https://ganjiday.com/sitemap/en.xml')
  const english = await (await request.get(`${east}/sitemap/en.xml`, eastOptions)).text()
  expect(english.match(/<loc>/g)).toHaveLength(1)
  expect(english).toContain('<loc>https://ganjiday.com/en</loc>')
  const korean = await request.get(`${east}/sitemap/ko.xml`, eastOptions)
  expect(korean.status()).toBe(200)
  expect(await korean.text()).toContain('<loc>https://ganjiday.com/ko</loc>')
  expect(await korean.text()).not.toContain('<loc>https://arcanumber.com/')
  expect((await request.get(`${west}/sitemap/ko.xml`, westOptions)).status()).toBe(404)
  expect((await request.get(`${east}/_site/east`, eastOptions)).status()).toBe(404)
  expect((await request.get(`${east}/_site/east.html`, eastOptions)).status()).toBe(404)
  expect((await request.get(`${east}/%5fsite/east`, eastOptions)).status()).toBe(404)
  const rules = await (await request.get(`${east}/robots.txt`, eastOptions)).text()
  for (const path of ['/app', '/admin', '/api', '/*?r=', '/*&r='])
    expect(rules).toContain(`Disallow: ${path}`)
  expect(rules).toContain('Sitemap: https://ganjiday.com/sitemap.xml')
  expect(
    (await request.get(`${east}/ko/?r=shared`, eastOptions)).headers()['x-robots-tag'],
  ).toContain('noindex')
})

test('两站分开经营：不属于本站的语言返回本站 404，东方站 /en 为英文入口页', async ({
  page,
  request,
  baseURL,
}) => {
  // APIRequestContext 不解析 *.localhost，按 Host 头区分站点（同上一个用例）
  const local = baseURL ?? 'http://localhost:3000'
  const as = (site: string) => ({
    maxRedirects: 0,
    headers: { host: new URL(localSite(baseURL, site)).host },
  })
  for (const path of ['/zh-hant', '/zh-hans/pricing', '/ko/'])
    expect((await request.get(`${local}${path}`, as('west'))).status(), path).toBe(404)
  expect((await request.get(`${local}/en/pricing`, as('east'))).status()).toBe(404)
  expect((await request.get(`${local}/en/faq`, as('east'))).status()).toBe(404)
  // 404 使用根布局的本站品牌标题
  const missing = await request.get(`${local}/zh-hant/faq`, as('west'))
  expect(missing.status()).toBe(404)
  expect(await missing.text()).toMatch(/<title>[^<]*\| Arcanumber<\/title>/)
  const east = localSite(baseURL, 'east')

  const response = await page.goto(`${east}/en`)
  expect(response?.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('AI')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://ganjiday.com/en',
  )
  await expect(page.locator('link[rel="alternate"][hreflang="ko"]')).toHaveAttribute(
    'href',
    'https://ganjiday.com/ko',
  )
  await expect(page.locator('main a[href="/zh-hans"]').first()).toBeVisible()
  await expect(page.locator('a[href*="arcanumber"]')).toHaveCount(0)
})

test('两站 FAQ 汇总页与 llms.txt 按 Host 输出', async ({ request, baseURL }) => {
  const origin = baseURL ?? 'http://localhost:3000'
  const eastOptions = { headers: { host: new URL(localSite(baseURL, 'east')).host } }
  const westOptions = { headers: { host: new URL(localSite(baseURL, 'west')).host } }
  for (const [path, options] of [
    ['/zh-hant/faq', eastOptions],
    ['/faq', westOptions],
  ] as const) {
    const response = await request.get(`${origin}${path}`, options)
    expect(response.status(), path).toBe(200)
    expect(await response.text()).toContain('"@type":"FAQPage"')
  }
  const east = await request.get(`${origin}/llms.txt`, eastOptions)
  expect(east.status()).toBe(200)
  expect(east.headers()['content-type']).toContain('text/plain')
  const text = await east.text()
  expect(text).toContain('https://ganjiday.com/zh-hant')
  expect(text).not.toContain('arcanumber.com')
  const rules = await (await request.get(`${origin}/robots.txt`, eastOptions)).text()
  expect(rules).toContain('User-agent: GPTBot\nAllow: /\nDisallow: /app')
})
