import { expect, test } from '@playwright/test'

const localSite = (baseURL: string | undefined, site: string) => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${site}.localhost`
  return url.origin
}

test('韩语浏览器停留东方入口并高亮韩语卡片，禁用 JS 仍有三语入口', async ({ browser, baseURL }) => {
  const east = localSite(baseURL, 'east')
  const context = await browser.newContext({ locale: 'ko-KR' })
  const page = await context.newPage()
  const response = await page.goto(`${east}/`)
  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(`${east}/`)
  await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
  // 语言入口只提供本站语言，不能把英语工具或无前缀营销地址带到东方站。
  const navigation = page.getByRole('navigation', { name: 'Tools', exact: true })
  await expect(navigation.getByRole('link')).toHaveText(['繁體中文', '简体中文', '한국어'])
  await expect(page.getByTestId('entry-ko')).toContainText('간체 중국어')
  await expect(page.getByTestId('entry-ko')).toHaveAttribute('data-recommended', 'true')
  await expect(page.getByTestId('entry-zh-Hant')).toHaveAttribute('href', '/zh-hant/')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://ganjiday.com/',
  )
  const noJs = await browser.newContext({ javaScriptEnabled: false, locale: 'ko-KR' })
  const staticPage = await noJs.newPage()
  await staticPage.goto(`${east}/`)
  await expect(staticPage.getByTestId('entry-ko')).toBeVisible()
  await expect(staticPage.getByTestId('entry-zh-Hant')).toBeVisible()
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
