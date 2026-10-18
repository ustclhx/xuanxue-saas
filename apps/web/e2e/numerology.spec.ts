import { expect, test } from '@playwright/test'
import { compatibility } from '@xuanxue/numerology'
import { LIFE_PATH_NUMBERS } from '../src/features/tools/numerology/routes.ts'

// 西方站数字命理页面（openspec add-numerology-tools tasks.md 2.1–2.3）：结果在浏览器本地计算；
// 等水合完成（主题按钮在西方站不显示，改等表单的提交按钮可用后再填写）。
async function hydrated(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => document.documentElement.dataset.site === 'west')
  await page.waitForLoadState('networkidle')
}

test('首页：输入 1987-11-29 显示 11、计算步骤与数字页链接', async ({ page }) => {
  await page.goto('/')
  await hydrated(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Life Path Number Calculator')
  await page.getByLabel('Date of birth').fill('1987-11-29')
  await page.getByRole('button', { name: 'Calculate' }).click()
  const result = page.locator('#life-path-result')
  await expect(result).toContainText('Your life path number')
  await expect(result).toContainText('Master number')
  await expect(result).toContainText('Month 11 → 11 (kept)')
  await expect(result).toContainText('Day 29 → 2 + 9 = 11 (kept)')
  await expect(result).toContainText('Year 1987 → 1 + 9 + 8 + 7 = 25 → 2 + 5 = 7')
  await expect(result).toContainText('11 + 11 + 7 = 29 → 2 + 9 = 11')
  const link = result.getByRole('link', { name: 'Read the full meaning of Life Path 11 →' })
  await expect(link).toHaveAttribute('href', '/life-path-number/11')
  // 分享链接只含日期，打开后直接复现结果
  const shareField = result.getByLabel('Share link')
  await expect(shareField).toHaveValue(/#r=/)
  const share = await shareField.inputValue()
  await page.goto('/numerology-calculator')
  await page.goto(share)
  await hydrated(page)
  await expect(page.locator('#life-path-result')).toContainText('Your life path number')
})

test('禁用 JS 的请求含 H1、表单标签、数字网格与 FAQPage', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toMatch(/<h1[^>]*>Life Path Number Calculator<\/h1>/)
  expect(html).toMatch(/<label[^>]*>Date of birth<input[^>]*type="date"/)
  for (const value of LIFE_PATH_NUMBERS) expect(html).toContain(`href="/life-path-number/${value}"`)
  expect(html).toContain('"@type":"FAQPage"')
  expect(html).toContain('What is a life path number?')
})

test('完整计算器：不填姓名只显示日期类数字，姓名类提示解锁', async ({ page }) => {
  await page.goto('/numerology-calculator')
  await hydrated(page)
  await page.getByLabel('Date of birth').fill('1987-11-29')
  await page.getByRole('button', { name: 'Calculate' }).click()
  await expect(page.locator('section#life-path')).toContainText('11')
  await expect(page.locator('section#birthday')).toContainText('Day 29 → 2 + 9 = 11 (kept)')
  await expect(page.locator('section#personal-year')).toContainText(
    `Personal Year ${new Date().getFullYear()}`,
  )
  for (const id of ['expression', 'soul-urge', 'personality'])
    await expect(page.locator(`section#${id}`)).toContainText('Add your name to unlock')

  // 非拉丁姓名：提示只支持拉丁字母，日期类数字照常显示
  await page.getByLabel('Full name (optional)').fill('王小明')
  await page.getByRole('button', { name: 'Calculate' }).click()
  await expect(page.getByText('Only Latin letters are supported')).toBeVisible()
  await expect(page.locator('section#life-path')).toBeVisible()

  // 带重音的姓名按基础字母计算
  await page.getByLabel('Full name (optional)').fill('Hélène Dupont')
  await page.getByRole('button', { name: 'Calculate' }).click()
  await expect(page.locator('section#expression')).toContainText('Letters total')
})

test('相性：两个生日输出双方生命灵数与固定表等级', async ({ page }) => {
  const first = { year: 1987, month: 11, day: 29 }
  const second = { year: 1990, month: 5, day: 15 }
  const expected = compatibility(first, second)
  await page.goto('/life-path-compatibility')
  await hydrated(page)
  await page.getByLabel('Your date of birth').fill('1987-11-29')
  await page.getByLabel('Their date of birth').fill('1990-05-15')
  await page.getByRole('button', { name: 'Calculate' }).click()
  const level = { high: 'High', medium: 'Medium', challenging: 'Challenging' }[expected.level]
  await expect(page.locator('section#compatibility')).toContainText(
    `${expected.left.value} & ${expected.right.value}`,
  )
  await expect(page.locator('section#compatibility')).toContainText(level)
  await expect(page.locator('section#row li')).toHaveCount(12)
})

test('数字页 22：完整说明、内嵌计算器与其他 11 个数字页链接', async ({ page }) => {
  const response = await page.goto('/life-path-number/22')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Life Path Number 22')
  await expect(page.getByRole('form', { name: 'Birth date' })).toBeVisible()
  await expect(page.locator('article')).toContainText('What Life Path Number 22 means')
  for (const value of LIFE_PATH_NUMBERS.filter((value) => value !== 22))
    await expect(page.locator(`nav a[href="/life-path-number/${value}"]`).first()).toBeVisible()
  await expect(
    page.locator('nav a[href="/life-path-number/22"][aria-current="page"]'),
  ).toBeVisible()
  expect((await page.goto('/life-path-number/10'))?.status()).toBe(404)
  expect((await page.goto('/ko/numerology-calculator'))?.status()).toBe(404)
})
