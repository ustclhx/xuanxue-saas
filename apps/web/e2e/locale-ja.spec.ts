import { expect, test } from '@playwright/test'
import { fillTime } from './date-field.ts'

// 日语（东方站，openspec add-locales-eu-ja 第 4 组，任务 4.11），2026-11-21 发布（rollout.ts）：
// 正式域名可访问，进入站点地图与东方站既有页面的 hreflang；西方站 /ja 仍 404。
// 未发布语言的拦截机制由单元测试（rollout.test.ts、rollout-discovery.test.ts）覆盖。
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
  // 已发布：东方站既有页面的 hreflang 列出 ja 版本
  await page.goto(`${east}/zh-hant/${encodeURIComponent('八字排盤')}`)
  await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute(
    'href',
    `https://ganjiday.com${SHICHU}`,
  )
})

test('正式域名上 ja 不再 404，站点地图列出 ja；西方站 /ja 仍是 404', async ({
  request,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:3000'
  const host = (value: string) => ({ maxRedirects: 0, headers: { host: value } })
  // 本地是 http：正式域名的请求先 301 到 https 同一地址（规范化），不再是发布前的 404
  for (const path of ['/ja', SHICHU, CARD]) {
    const response = await request.get(`${origin}${path}`, host('ganjiday.com'))
    expect(response.status(), path).toBe(301)
    expect(response.headers().location, path).toBe(`https://ganjiday.com${path}`)
  }
  const east = host(new URL(localSite(baseURL, 'east')).host)
  const west = host(new URL(localSite(baseURL, 'west')).host)
  expect((await request.get(`${origin}/ja`, west)).status()).toBe(404)
  const index = await (await request.get(`${origin}/sitemap.xml`, east)).text()
  expect(index).toContain('/sitemap/ja.xml')
  const sitemap = await request.get(`${origin}/sitemap/ja.xml`, east)
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).toContain(`<loc>https://ganjiday.com${SHICHU}</loc>`)
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
