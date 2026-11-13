import { expect, type Page, test } from '@playwright/test'

// 结果分享图（openspec redesign-home-chart-visuals tasks 7.2、7.3；specs/share-cards）：
// 浏览器本地生成 1080×1350 PNG，生成期间没有携带出生信息或结果的请求，结果出现后断网仍可生成，
// 导出失败时显示可重试的提示且结果与分享链接不受影响。东方站经 east.localhost 访问（features/site/site.ts）。

const HYDRATED = { waitUntil: 'networkidle' } as const

function eastUrl(path: string): string {
  const url = new URL(path, test.info().project.use.baseURL)
  url.hostname = 'east.localhost'
  return url.href
}

async function chartZhHant(page: Page) {
  await page.goto(eastUrl('/zh-hant'), HYDRATED)
  await page.getByLabel('年', { exact: true }).fill('1990')
  await page.getByLabel('月', { exact: true }).fill('5')
  await page.getByLabel('日', { exact: true }).fill('15')
  await page.getByLabel('出生時間').fill('10:30')
  await page.getByRole('button', { name: '立即排盤' }).click()
  await expect(page.getByRole('button', { name: '保存分享圖' })).toBeVisible()
}

/** 读取已生成图片的像素尺寸 */
async function generatedSize(page: Page) {
  const image = page.locator('[data-share-card-ready] img')
  // 本地 vite dev 首次按需编译生成模块较慢，放宽等待
  await expect(image).toBeVisible({ timeout: 20_000 })
  return image.evaluate((element: HTMLImageElement) => ({
    width: element.naturalWidth,
    height: element.naturalHeight,
  }))
}

test('繁中八字：本地生成 1080×1350 分享图，期间没有携带输入或结果的请求', async ({ page }) => {
  await chartZhHant(page)
  const requests: string[] = []
  page.on('request', (request) => requests.push(`${request.url()} ${request.postData() ?? ''}`))
  await page.getByRole('button', { name: '保存分享圖' }).click()
  expect(await generatedSize(page)).toEqual({ width: 1080, height: 1350 })
  await expect(page.getByRole('link', { name: '下載圖片' })).toHaveAttribute(
    'download',
    'ganjiday-bazi.png',
  )

  await page.getByLabel('在圖中顯示出生日期').check()
  await expect(page.locator('[data-share-card-ready]')).toHaveCount(0)
  await page.getByRole('button', { name: '保存分享圖' }).click()
  expect(await generatedSize(page)).toEqual({ width: 1080, height: 1350 })
  // 输入（出生日期）与结果（干支）都不应出现在任何请求的地址或请求体中
  expect(requests.filter((entry) => /1990|05-15|#r=|%E5%BA%9A|庚/.test(entry))).toEqual([])
})

test('结果出现后断网仍可生成分享图', async ({ page, context }) => {
  await chartZhHant(page)
  // 等待结果出现后的空闲预取完成
  await page.waitForTimeout(2500)
  await page.waitForLoadState('networkidle')
  await context.setOffline(true)
  await page.getByRole('button', { name: '保存分享圖' }).click()
  expect(await generatedSize(page)).toEqual({ width: 1080, height: 1350 })
  await context.setOffline(false)
})

test('画布导出失败时提示重试，结果与分享链接仍可用', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
      callback(null)
    }
  })
  await chartZhHant(page)
  await page.getByRole('button', { name: '保存分享圖' }).click()
  const alert = page.getByRole('alert').filter({ hasText: '分享圖生成失敗' })
  await expect(alert).toBeVisible()
  await expect(alert.getByRole('button', { name: '重試' })).toBeVisible()
  await expect(page.locator('#pillars')).toBeVisible()
  await expect(page.getByLabel('分享連結')).toHaveValue(/#r=/)
})

test('西方站生命灵数：生成分享图', async ({ page }) => {
  await page.goto('/', HYDRATED)
  await page.getByLabel('Date of birth').fill('1990-05-15')
  await page.getByRole('button', { name: 'Calculate' }).click()
  await page.getByRole('button', { name: 'Save share image' }).click()
  expect(await generatedSize(page)).toEqual({ width: 1080, height: 1350 })
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveAttribute(
    'download',
    'arcanumber-life-path.png',
  )
})
