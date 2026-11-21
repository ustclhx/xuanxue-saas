import { expect, test } from '@playwright/test'

// 西班牙语（openspec add-locales-eu-ja 第 5 组，任务 5.11）：es 属于西方站、发布状态为 pending。
// 本地 `west.localhost` 是预览主机，pending 语言可直接访问（整体 noindex）；正式域名上返回 404，
// 且英文页面的 hreflang、站点地图不出现 es。路径按关键词地图（决策 2）。
const west = (baseURL: string | undefined) => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = 'west.localhost'
  return url.origin
}

test('西班牙语落地页与 Life Path 工具：本地路径、H1、canonical 与只在西方站内的 hreflang', async ({
  page,
  baseURL,
}) => {
  const origin = west(baseURL)
  expect((await page.goto(`${origin}/es`))?.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://arcanumber.com/es',
  )
  await expect(page).toHaveTitle('Arcanumber: numerología y tarot gratis, paso a paso')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    'https://arcanumber.com/',
  )
  await expect(page.locator('a[href*="ganjiday"]')).toHaveCount(0)

  expect((await page.goto(`${origin}/es/numero-de-vida`))?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calcula tu número de vida')
  await expect(page).toHaveTitle(/^Número de vida: calcúlalo gratis paso a paso \| Arcanumber$/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    'https://arcanumber.com/life-path-number',
  )
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute(
    'href',
    'https://arcanumber.com/es/numero-de-vida',
  )
  // 数字网格链接到西班牙语数字页
  await expect(page.locator('a[href="/es/numero-de-vida/7"]').first()).toBeVisible()

  expect((await page.goto(`${origin}/es/numero-de-vida/7`))?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Número de vida 7 en numerología',
  )
  await expect(page).toHaveTitle(/^Número de vida 7: significado, amor y misión/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    'https://arcanumber.com/life-path-number/7',
  )
  await expect(page.locator('main a[href="/es/compatibilidad-numerologica"]').first()).toBeVisible()
})

test('西班牙语塔罗：牌阵子路径、牌义页（Sota 带 Paje）与牌义索引', async ({ page, baseURL }) => {
  const origin = west(baseURL)
  expect((await page.goto(`${origin}/es/tarot/si-o-no`))?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tarot sí o no')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    'https://arcanumber.com/tarot/yes-or-no',
  )

  expect((await page.goto(`${origin}/es/tarot/cartas/the-sun`))?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'El Sol: significado en el tarot, al derecho e invertida',
  )
  await expect(page.locator('main')).toContainText('Al derecho')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    'https://arcanumber.com/tarot/cards/the-sun',
  )

  expect((await page.goto(`${origin}/es/tarot/cartas/page-of-pentacles`))?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sota de Oros (Paje)')

  expect((await page.goto(`${origin}/es/tarot/cartas`))?.status()).toBe(200)
  await expect(page.locator('main a[href="/es/tarot/cartas/the-moon"]')).toHaveCount(1)
})

test('西班牙语只走本地路径：英文路径段、其他语言的西语路径与西班牙语的英文页返回 404', async ({
  request,
  baseURL,
}) => {
  const local = baseURL ?? 'http://localhost:3000'
  const host = { headers: { host: new URL(west(baseURL)).host }, maxRedirects: 0 }
  for (const path of [
    '/es/life-path-number',
    '/es/tarot/cards/the-sun',
    '/es/tarot/daily',
    '/tarot/cartas',
    '/tarot/carta-del-dia',
    '/numero-de-vida',
    '/ko/numero-de-vida',
  ])
    expect((await request.get(`${local}${path}`, host)).status(), path).toBe(404)
})

test('es 未发布：正式域名返回 404，英文页面 hreflang 与站点地图不含 es', async ({
  request,
  baseURL,
}) => {
  const local = baseURL ?? 'http://localhost:3000'
  const production = { headers: { host: 'arcanumber.com' }, maxRedirects: 0 }
  expect((await request.get(`${local}/es`, production)).status()).toBe(404)
  expect((await request.get(`${local}/es/numero-de-vida`, production)).status()).toBe(404)
  // 可发现位置只看发布状态、不看主机（rollout.ts）：在预览主机上读取同一份输出
  const preview = { headers: { host: new URL(west(baseURL)).host }, maxRedirects: 0 }
  const en = await request.get(`${local}/life-path-number`, preview)
  expect(en.status()).toBe(200)
  expect((await en.text()).toLowerCase()).not.toContain('hreflang="es"')
  const index = await request.get(`${local}/sitemap.xml`, preview)
  expect(await index.text()).not.toContain('/sitemap/es.xml')
})

test('定价页：西班牙语以 USD 显示（es-419 格式，不与比索的 $ 混淆）', async ({ page, baseURL }) => {
  const origin = west(baseURL)
  expect((await page.goto(`${origin}/es/pricing`))?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Precios')
  await expect(page.locator('main')).toContainText(/USD\s?\d/)
  await expect(page.locator('main')).not.toContainText(/\d,\d{2}\s?US\$/)
})
