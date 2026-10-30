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
  await expect(page).toHaveURL(`${east}/ko/`)
  await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
  // 东方站只提供本站语言，不能把英语工具或无前缀营销地址带到东方站。
  const navigation = page.getByRole('navigation', { name: 'Tools', exact: true })
  await expect(navigation.getByRole('link')).toHaveText(['繁體中文', '简体中文', '한국어'])
  const noJs = await browser.newContext({ javaScriptEnabled: false, locale: 'ko-KR' })
  const staticPage = await noJs.newPage()
  // 302 由服务端完成，禁用 JS 时也应落在语言首页
  await staticPage.goto(`${east}/`)
  await expect(staticPage).toHaveURL(`${east}/ko/`)
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
  expect(await index.text()).not.toContain('/sitemap/en.xml')
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
