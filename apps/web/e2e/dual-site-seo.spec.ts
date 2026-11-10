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

// openspec fix-seo-canonical-indexing：规范地址收敛、认证页 noindex、匿名可访问公开内容与 x-default
test('规范地址：根路径、结尾斜杠与东方站裸路径一次永久跳转，保留路径与查询', async ({
  request,
  baseURL,
}) => {
  const local = baseURL ?? 'http://localhost:3000'
  for (const [site, from, to] of [
    ['east', '/', '/zh-hant'],
    ['east', '/zh-hant/', '/zh-hant'],
    ['east', '/zh-hant/pricing/?a=1', '/zh-hant/pricing?a=1'],
    ['east', '/pricing?ref=x', '/zh-hant/pricing?ref=x'],
    ['east', '/privacy', '/zh-hant/privacy'],
    ['west', '/pricing/', '/pricing'],
    ['west', '/en/pricing', '/pricing'],
  ] as const) {
    const host = new URL(localSite(baseURL, site)).host
    const response = await request.get(`${local}${from}`, {
      maxRedirects: 0,
      // 不属于东方站其他语言的浏览器语言与不带 Accept-Language 的爬虫一样落到繁中
      headers: { host, 'accept-language': 'en-US' },
    })
    expect(response.status(), `${site} ${from}`).toBe(301)
    const location = new URL(response.headers().location ?? '', localSite(baseURL, site))
    expect(location.pathname + location.search, `${site} ${from}`).toBe(to)
    // 目标直接返回 200，匿名可访问
    const target = await request.get(`${local}${to}`, { maxRedirects: 0, headers: { host } })
    expect(target.status(), `${site} ${to}`).toBe(200)
  }
})

test('认证页 noindex，?redirect= 变体 canonical 为不带参数的登录页；公开页匿名可访问且 x-default 为同页', async ({
  page,
  request,
  baseURL,
}) => {
  const local = baseURL ?? 'http://localhost:3000'
  for (const [site, path, canonical] of [
    ['west', '/login?redirect=%2Flife-path-number%2F22', 'https://arcanumber.com/login'],
    ['west', '/register', 'https://arcanumber.com/register'],
    ['east', '/ko/login?redirect=%2Fko%2Fpricing', 'https://ganjiday.com/ko/login'],
  ] as const) {
    const response = await page.goto(`${localSite(baseURL, site)}${path}`)
    expect(response?.status(), path).toBe(200)
    expect(response?.headers()['x-robots-tag'], path).toContain('noindex')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical)
  }
  const robotsTxt = await (
    await request.get(`${local}/robots.txt`, {
      headers: { host: new URL(localSite(baseURL, 'west')).host },
    })
  ).text()
  expect(robotsTxt).not.toContain('/login')

  // 公开内容匿名可访问，不跳登录；页头登录链接不带随页面变化的回跳参数
  await page.goto(`${localSite(baseURL, 'west')}/tarot`, { waitUntil: 'networkidle' })
  await expect(page).toHaveURL(`${localSite(baseURL, 'west')}/tarot`)
  const login = page.locator('header a[rel="nofollow"]')
  await expect(login).toHaveAttribute('href', '/login')
  const east = await page.goto(`${localSite(baseURL, 'east')}/ko/pricing`)
  expect(east?.status()).toBe(200)
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
    'href',
    'https://ganjiday.com/zh-hant/pricing',
  )
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
    (await request.get(`${east}/ko?r=shared`, eastOptions)).headers()['x-robots-tag'],
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

// 回归：东方站没有无前缀默认语言，英文浏览器访问无前缀认证页曾按 baseLocale 渲染成英文 + Arcanumber
test('东方站无前缀认证页跳到东方站语言与品牌，西方站保持英文原地渲染', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  const east = localSite(baseURL, 'east')
  for (const [path, title] of [
    ['/login', '登入'],
    ['/register', '建立帳號'],
  ] as const) {
    await page.goto(`${east}${path}`)
    await expect(page).toHaveURL(`${east}/zh-hant${path}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    // 页头品牌为东方站品牌（注册页的分站提示会提到 Arcanumber，因此只断言品牌元素）
    await expect(page.getByText('干支日', { exact: true })).toBeVisible()
    await expect(page.getByText('Arcanumber', { exact: true })).toHaveCount(0)
  }
  const west = localSite(baseURL, 'west')
  for (const [path, title] of [
    ['/login', 'Sign in'],
    ['/register', 'Create an account'],
  ] as const) {
    await page.goto(`${west}${path}`)
    await expect(page).toHaveURL(`${west}${path}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.getByText('Arcanumber', { exact: true })).toBeVisible()
  }
  await context.close()
})
