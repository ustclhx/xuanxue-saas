import { expect, test } from '@playwright/test'
import { fillTime } from './date-field.ts'

// 日语（东方站，openspec add-locales-eu-ja 第 4 组，任务 4.11）：ja 处于 pending 状态——
// 预览 / 本地主机按地址可访问并整体 noindex，正式域名返回 404，不进站点地图与既有页面的 hreflang。
const localSite = (baseURL: string | undefined, site: string) => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${site}.localhost`
  return url.origin
}
const SHICHU = `/ja/${encodeURIComponent('四柱推命')}`
const CARD = `/ja/${encodeURI('タロット/意味')}/the-sun`
const HYDRATED = { waitUntil: 'networkidle' } as const

test('本地东方站按地址可访问 ja 页面：lang、Title、H1 与 hreflang 自指', async ({
  page,
  baseURL,
}) => {
  const east = localSite(baseURL, 'east')
  for (const [path, title] of [
    ['/ja', '干支日｜生年月日で占う無料の四柱推命・紫微斗数・タロット'],
    [SHICHU, '四柱推命 無料｜命式を自動計算（通変星・蔵干・大運）｜干支日'],
    [
      `/ja/${encodeURIComponent('タロット')}`,
      '無料タロット占い｜スリーカードで過去・現在・未来｜干支日',
    ],
  ] as const) {
    const response = await page.goto(`${east}${path}`)
    expect(response?.status(), path).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    await expect(page).toHaveTitle(title)
    await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveCount(1)
    await expect(page.locator('a[href*="arcanumber"]')).toHaveCount(0)
  }
  await page.goto(`${east}${CARD}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'タロット「太陽」の意味：正位置・逆位置',
  )
  // 既有页面的 hreflang 不出现未发布的 ja
  await page.goto(`${east}/zh-hant/${encodeURIComponent('八字排盤')}`)
  await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveCount(0)
})

test('正式域名上 ja 返回 404，站点地图不列 ja；西方站 /ja 也是 404', async ({
  request,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:3000'
  const host = (value: string) => ({ maxRedirects: 0, headers: { host: value } })
  for (const path of ['/ja', SHICHU, CARD])
    expect((await request.get(`${origin}${path}`, host('ganjiday.com'))).status(), path).toBe(404)
  const east = host(new URL(localSite(baseURL, 'east')).host)
  const west = host(new URL(localSite(baseURL, 'west')).host)
  expect((await request.get(`${origin}/ja`, west)).status()).toBe(404)
  const index = await (await request.get(`${origin}/sitemap.xml`, east)).text()
  expect(index).not.toContain('/sitemap/ja.xml')
  expect((await request.get(`${origin}/sitemap/ja.xml`, east)).status()).toBe(404)
  // 本地 / 预览主机按地址可访问（staging 的 *.workers.dev 整体 noindex，见 site/gate.ts）
  expect((await request.get(`${origin}/ja`, east)).status()).toBe(200)
})

test('四柱推命：东京默认，1950 年サマータイム减 1 小时，通変星与天中殺标签，不链接概念页', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${localSite(baseURL, 'east')}${SHICHU}`, HYDRATED)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('無料の四柱推命 命式計算')
  await page.getByLabel('年', { exact: true }).fill('1950')
  await page.getByLabel('月', { exact: true }).fill('7')
  await page.getByLabel('日', { exact: true }).fill('15')
  await fillTime(page, '出生時間', '12:00')
  await page.getByRole('button', { name: '命式を出す' }).click()
  const pillars = page.locator('#pillars')
  await expect(pillars).toBeVisible()
  await expect(pillars).toContainText('1950-07-15 11:00')
  await expect(pillars).toContainText('東京')
  await expect(pillars).toContainText('サマータイムのため1時間戻して計算')
  await expect(pillars).toContainText('通変星')
  await expect(page.locator('#shensha [data-shensha="kongWang"]')).toContainText('天中殺')
  // 第一期没有 ja 的八字概念页与命盤查詢：结果与延伸阅读中不出现这些链接
  await page.locator('#luck [data-decade="0"]').click()
  await expect(page.locator('a[href*="/ja/%E5%85%AB%E5%AD%97"]')).toHaveCount(0)
  await expect(page.locator(`a[href*="${encodeURIComponent('命盤查詢')}"]`)).toHaveCount(0)
  expect(errors).toEqual([])
})
