import { expect, test } from '@playwright/test'

// 生产只读冒烟（production-deployment spec「生产冒烟只读」）：只访问页面与健康接口，
// 不注册、不登录、不支付，也不提交任何表单，生产库中不会留下冒烟数据。
const hostname = new URL(process.env.PRODUCTION_URL ?? 'https://arcanumber.com').hostname
const isEasternSite = ['ganjiday.com', 'east.localhost'].includes(hostname)

if (isEasternSite) {
  test('东方站根路径直接进入语言首页', async ({ page }) => {
    // 根路径不再展示语言选择页：无其他偏好时 301 到规范首页 /zh-hant，简体、韩语偏好 302 到对应首页
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/(zh-hant|zh-hans|ko)$/)
    await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
  })

  for (const [prefix, lang, title, birthTime, pricing, packs] of [
    ['zh-hant', 'zh-Hant', '免費八字排盤', '出生時間', '價格方案', '積分包'],
    ['ko', 'ko', '무료 만세력', '태어난 시간', '요금 안내', '크레딧 팩'],
  ] as const) {
    test(`东方站工具首页渲染（${lang}）`, async ({ page }) => {
      const response = await page.goto(`/${prefix}/`)
      expect(response?.status()).toBe(200)
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
      await expect(page.getByLabel(birthTime, { exact: true })).toBeVisible()
    })

    test(`东方站定价页渲染（${lang}）`, async ({ page }) => {
      const response = await page.goto(`/${prefix}/pricing`)
      expect(response?.status()).toBe(200)
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(pricing)
      await expect(page.getByRole('heading', { name: packs, exact: true })).toBeVisible()
    })
  }
} else {
  // 西方站首页为 Life Path 计算器，只检查标题与日期输入，不提交表单。
  test('西方站首页渲染', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('data-site', 'west')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Life Path Number Calculator')
    await expect(page.getByLabel('Date of birth')).toBeVisible()
  })

  test('西方站定价页渲染', async ({ page }) => {
    const response = await page.goto('/pricing')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Credit packs', exact: true })).toBeVisible()
  })
}

test('健康接口返回本次版本且数据库可用', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.db?.status).toBe('up')
  // 发布流水线传入完整 SHA；本地对其他环境试跑时可不设。
  if (process.env.APP_VERSION) expect(body.version).toBe(process.env.APP_VERSION)
})

// 规范地址与认证页索引（openspec fix-seo-canonical-indexing，specs/seo「规范地址收敛」「认证页不进索引」），只读 GET
const origin = new URL(process.env.PRODUCTION_URL ?? 'https://arcanumber.com').origin

test('规范地址：结尾斜杠永久跳转到无斜杠地址，东方站根路径与裸路径保留路径跳到繁中', async ({
  request,
}) => {
  const cases: [string, string][] = isEasternSite
    ? [
        ['/', '/zh-hant'],
        ['/zh-hant/', '/zh-hant'],
        ['/pricing?ref=smoke', '/zh-hant/pricing?ref=smoke'],
      ]
    : [
        ['/pricing/', '/pricing'],
        ['/en/pricing', '/pricing'],
      ]
  for (const [from, to] of cases) {
    // 不属于东方站其他语言的浏览器语言（与不带 Accept-Language 的爬虫相同）落到繁中并永久跳转
    const response = await request.get(from, {
      maxRedirects: 0,
      headers: { 'accept-language': 'en-US' },
    })
    expect(response.status(), from).toBe(301)
    expect(response.headers().location, from).toBe(`${origin}${to}`)
  }
})

test('带回跳参数的登录页 noindex，canonical 为不带参数的登录页', async ({ page }) => {
  const path = isEasternSite ? '/zh-hant/login' : '/login'
  const response = await page.goto(`${path}?redirect=%2Fpricing`)
  expect(response?.status()).toBe(200)
  expect(response?.headers()['x-robots-tag']).toContain('noindex')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${origin}${path}`)
})
