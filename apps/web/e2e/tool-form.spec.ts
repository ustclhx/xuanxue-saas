import { expect, type Page, test } from '@playwright/test'
import { chooseOption } from './select.ts'

// 出生信息表单（openspec refresh-visual-system-warm 5.1、5.2；specs/tool-pages「工具页紧凑布局」）：
// 手机首屏可见提交按钮、进阶选项默认收起，出生地改用 @xuanxue/ui 的 Select 后条件字段仍然联动。
const MOBILE = { width: 390, height: 844 }

function eastUrl(path: string) {
  const url = new URL(path, test.info().project.use.baseURL)
  // `east.localhost` 由浏览器解析到本机，站点识别见 features/site/site.ts
  url.hostname = 'east.localhost'
  return url.href
}

async function expectSubmitInFirstScreen(page: Page, path: string, submit: string) {
  await page.setViewportSize(MOBILE)
  await page.goto(eastUrl(path))
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 })
  // 不滚动：提交按钮整体在 390×844 的首屏内
  await expect(page.getByRole('button', { name: submit, exact: true })).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
}

test('紫微斗數排盤：手机首屏可见 H1 与提交按钮，进阶选项收起', async ({ page }) => {
  await expectSubmitInFirstScreen(page, '/zh-hant/紫微斗數排盤', '排紫微命盤')
  const advanced = page.locator('form details')
  await expect(advanced).not.toHaveAttribute('open', '')
  await expect(page.getByRole('checkbox', { name: '真太陽時校正' })).toBeHidden()
  await advanced.locator('summary').click()
  await expect(page.getByRole('checkbox', { name: '真太陽時校正' })).toBeVisible()
})

// 双人表单两组出生信息的高度超过一屏：需要第 6 组（gunghap-page.tsx 的页面布局）配合，本组只改共用字段
test.fixme('사주궁합：手机首屏可见提交按钮', async ({ page }) => {
  await expectSubmitInFirstScreen(page, '/ko/사주궁합', '궁합 보기')
})

test('出生地选择「其他地點」后出现时区与经度字段，选回城市后收起', async ({ page }) => {
  await page.goto(eastUrl('/zh-hant/紫微斗數排盤'))
  const form = page.getByRole('form')
  const place = form.getByRole('combobox', { name: '出生地', exact: true })
  await expect(place).toHaveText('台北')
  await chooseOption(place, '其他地點（手選時區）')
  await expect(
    form.getByRole('combobox', { name: '時區（不含夏令時）', exact: true }),
  ).toBeVisible()
  await expect(form.locator('input[name="longitude"]')).toBeVisible()
  await chooseOption(form.getByRole('combobox', { name: '出生地', exact: true }), '台北')
  await expect(form.locator('input[name="longitude"]')).toHaveCount(0)
})
