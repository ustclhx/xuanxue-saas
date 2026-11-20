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

  // 语言首页是品牌落地页，八字排盤 / 만세력在关键词 URL 上（openspec separate-landing-homepage D1）
  for (const [prefix, lang, homeTitle, tool, title, birthTime, pricing, packs] of [
    [
      'zh-hant',
      'zh-Hant',
      '干支日｜免費八字排盤、紫微斗數與塔羅',
      '八字排盤',
      '免費八字排盤',
      '出生時間',
      '價格方案',
      '單次購買積分',
    ],
    [
      'ko',
      'ko',
      '간지데이 | 무료 만세력·사주·타로',
      '만세력',
      '무료 만세력',
      '태어난 시간',
      '요금 안내',
      '크레딧 단건 구매',
    ],
  ] as const) {
    test(`东方站首页渲染（${lang}）`, async ({ page }) => {
      const response = await page.goto(`/${prefix}/`)
      expect(response?.status()).toBe(200)
      await expect(page).toHaveURL(new RegExp(`/${prefix}$`))
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
      await expect(page).toHaveTitle(homeTitle)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      // 首页指向主工具页的链接（页头导航；落地页上线后还有主按钮）
      await expect(page.locator(`a[href="/${prefix}/${encodeURI(tool)}"]`).first()).toBeAttached()
    })

    test(`东方站主工具页渲染（${lang}）`, async ({ page }) => {
      const response = await page.goto(`/${prefix}/${encodeURI(tool)}`)
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
  // 西方站首页是品牌落地页，Life Path 计算器在 /life-path-number（openspec separate-landing-homepage D1）
  test('西方站首页渲染', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('data-site', 'west')
    await expect(page).toHaveTitle('Numerology & Tarot Calculators, Free | Arcanumber')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('a[href="/life-path-number"]').first()).toBeAttached()
  })

  // 只检查标题与日期输入，不提交表单
  test('西方站 Life Path 工具页渲染', async ({ page }) => {
    const response = await page.goto('/life-path-number')
    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('data-site', 'west')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Life Path Number Calculator')
    await expect(page.getByLabel('Date of birth')).toBeVisible()
  })

  test('西方站定价页渲染', async ({ page }) => {
    const response = await page.goto('/pricing')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible()
    // 订阅上线后积分包区块标题为「Buy credits once」，未上线时为「Credit packs」
    await expect(
      page.getByRole('heading', { name: /^(Credit packs|Buy credits once)$/ }),
    ).toBeVisible()
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

test('规范地址：结尾斜杠永久跳转到无斜杠地址，东方站旧 /en 跳到英文首页 /、裸路径保留路径跳到繁中', async ({
  request,
  baseURL,
}) => {
  // 跳转目标沿用请求的 origin（本地冒烟为 localhost），与 canonical 使用的站点规范域名不同
  const requestOrigin = new URL(baseURL ?? origin).origin
  const cases: [string, string][] = isEasternSite
    ? [
        // 使用者 2026-11-20：东方站 `/` 是英文首页（不跳转），旧英文入口页 /en 301 到 `/`
        ['/en', '/'],
        ['/zh-hant/', '/zh-hant'],
        ['/pricing?ref=smoke', '/zh-hant/pricing?ref=smoke'],
      ]
    : [
        ['/pricing/', '/pricing'],
        ['/en/pricing', '/pricing'],
      ]
  for (const [from, to] of cases) {
    // 跳转只取决于地址，与浏览器语言无关
    const response = await request.get(from, {
      maxRedirects: 0,
      headers: { 'accept-language': 'en-US' },
    })
    expect(response.status(), from).toBe(301)
    expect(response.headers().location, from).toBe(`${requestOrigin}${to}`)
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
