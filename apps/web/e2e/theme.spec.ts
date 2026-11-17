/// <reference lib="dom" />
import { expect, type Page, test } from '@playwright/test'

// 主题切换（openspec add-marketing-i18n-seo tasks.md 2.1）：浅色 / 深色 / 跟随系统三种模式可切换、
// 刷新后保留；首帧即为所选主题，没有先浅后深的闪烁。
// 三种模式在东方站上验证（未保存选择时跟随系统）；西方站首次到访默认浅色，见文件末尾的用例。
// `east.localhost` 由浏览器解析到本机，站点识别见 features/site/site.ts。

const html = (page: Page) => page.locator('html')
const east = (path: string) => {
  const url = new URL(path, test.info().project.use.baseURL)
  url.hostname = 'east.localhost'
  return url.href
}
// 主题切换在页脚设置行（不再浮动）；页面上可能有多组（如应用区侧栏），只取当前可见的一组
const option = (page: Page, value: string) =>
  page.locator(`[data-theme-option="${value}"]`).filter({ visible: true })

/** 截图中心像素的亮度（0–255）：在页面内用 canvas 解码截图 */
async function screenshotLuminance(page: Page) {
  const png = await page.screenshot()
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas 2d context unavailable')
    context.drawImage(bitmap, 0, 0)
    // 取左下角的空白像素，避开左上的文字与右下角的切换按钮
    const [r = 0, g = 0, b = 0] = context.getImageData(4, bitmap.height - 4, 1, 1).data
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }, png.toString('base64'))
}

test('三种模式可切换并在刷新后保留', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(east('/'))
  await expect(option(page, 'system')).toHaveAttribute('aria-pressed', 'true')
  await expect(html(page)).not.toHaveClass(/\bdark\b/)

  await option(page, 'dark').click()
  await expect(html(page)).toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(html(page)).toHaveClass(/\bdark\b/)
  await expect(option(page, 'dark')).toHaveAttribute('aria-pressed', 'true')

  // 浅色偏好优先于系统深色
  await page.emulateMedia({ colorScheme: 'dark' })
  await option(page, 'light').click()
  await expect(html(page)).not.toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(html(page)).not.toHaveClass(/\bdark\b/)
  await expect(option(page, 'light')).toHaveAttribute('aria-pressed', 'true')

  // 跟随系统：随系统设置变化
  await option(page, 'system').click()
  await expect(html(page)).toHaveClass(/\bdark\b/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html(page)).not.toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(option(page, 'system')).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull()
})

// 首帧：拦截全部外部脚本（应用打包产物不执行、不水合），页面只剩 SSR 输出与 <head> 中的内联脚本，
// 截图即刷新后浏览器最先绘制的画面。
for (const [name, setup] of [
  [
    '选择深色后刷新',
    async (page: Page) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto(east('/'))
      await option(page, 'dark').click()
      await expect(html(page)).toHaveClass(/\bdark\b/)
    },
  ],
  [
    '未设置偏好且系统为深色',
    async (page: Page) => {
      await page.emulateMedia({ colorScheme: 'dark' })
    },
  ],
] as const) {
  test(`首帧即为深色：${name}`, async ({ page }) => {
    await setup(page)
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )
    await page.goto(east('/'))
    await expect(html(page)).toHaveClass(/\bdark\b/)
    expect(await screenshotLuminance(page)).toBeLessThan(64)
  })
}

test('首帧为浅色：选择浅色后刷新（系统为深色）', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(east('/'))
  await option(page, 'light').click()
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue(),
  )
  await page.reload()
  await expect(html(page)).not.toHaveClass(/\bdark\b/)
  expect(await screenshotLuminance(page)).toBeGreaterThan(192)
})

// 西方站（refresh-visual-system-warm：site-visual-system「西方站浅色主题为默认」）：首次到访固定浅色、不跟随系统，
// 之后的选择照常保留；两站都显示主题切换。
const blockScripts = (page: Page) =>
  page.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue(),
  )

test('西方站首次到访：系统为深色时首帧仍为浅色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await blockScripts(page)
  await page.goto('/')
  await expect(html(page)).toHaveAttribute('data-site', 'west')
  await expect(html(page)).not.toHaveClass(/\bdark\b/)
  expect(await screenshotLuminance(page)).toBeGreaterThan(192)
})

test('西方站：水合后保持浅色并显示主题切换，选择深色后刷新首帧为深色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(option(page, 'light')).toHaveAttribute('aria-pressed', 'true')
  await expect(html(page)).not.toHaveClass(/\bdark\b/)

  await option(page, 'dark').click()
  await expect(html(page)).toHaveClass(/\bdark\b/)
  await blockScripts(page)
  await page.reload()
  await expect(html(page)).toHaveClass(/\bdark\b/)
  expect(await screenshotLuminance(page)).toBeLessThan(64)
})

test('西方站：改选跟随系统后不再写回浅色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await option(page, 'system').click()
  await expect(html(page)).toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(option(page, 'system')).toHaveAttribute('aria-pressed', 'true')
  await expect(html(page)).toHaveClass(/\bdark\b/)
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull()
})

// 主题切换不再浮动（site-visual-system「主题切换不遮挡正文」）：桌面与手机都在页脚设置行
for (const width of [1440, 390]) {
  test(`${width}px：两站没有浮动主题控件，页脚设置行可用`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const url of ['/', east('/zh-hant')]) {
      await page.goto(url)
      await expect(page.locator('[data-slot="theme-toggle"].fixed')).toHaveCount(0)
      await expect(page.locator('body[data-floating-controls]')).toHaveCount(0)
      const toggle = page.locator('[data-site-footer] [data-slot="theme-toggle"]')
      await expect(toggle).toBeVisible()
      await expect(toggle.locator('[data-theme-option="dark"]')).toBeEnabled()
    }
  })
}
