import { expect, test } from '@playwright/test'

// 生产只读冒烟（production-deployment spec「生产冒烟只读」）：只访问页面与健康接口，
// 不注册、不登录、不支付，也不提交任何表单，生产库中不会留下冒烟数据。
const hostname = new URL(process.env.PRODUCTION_URL ?? 'https://arcanumber.com').hostname
const isEasternSite = ['ganjiday.com', 'east.localhost'].includes(hostname)

if (isEasternSite) {
  test('东方站根路径直接进入语言首页', async ({ page }) => {
    // 根路径不再展示语言选择页，按浏览器语言 302 到 /zh-hant/、/zh-hans/ 或 /ko/
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/(zh-hant|zh-hans|ko)\/$/)
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
