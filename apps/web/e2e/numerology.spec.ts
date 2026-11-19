import { expect, test } from '@playwright/test'
import { compatibility } from '@xuanxue/numerology'
import { LIFE_PATH_NUMBERS } from '../src/features/tools/numerology/routes.ts'
import { fillDate } from './date-field.ts'

// 西方站数字命理页面（openspec add-numerology-tools tasks.md 2.1–2.3）：结果在浏览器本地计算；
// 等水合完成（主题按钮在西方站不显示，改等表单的提交按钮可用后再填写）。
async function hydrated(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => document.documentElement.dataset.site === 'west')
  await page.waitForLoadState('networkidle')
}

// Life Path 计算器在 `/life-path-number`（openspec separate-landing-homepage design.md D1），迁移前在首页
test('Life Path 工具页：输入 1987-11-29 显示 11、计算步骤与数字页链接', async ({ page }) => {
  await page.goto('/life-path-number')
  await hydrated(page)
  await expect(page).toHaveTitle(
    'Life Path Number Calculator: Free, With Every Step Shown | Arcanumber',
  )
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/life-path-number$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Life Path Number Calculator')
  await fillDate(page, 'Date of birth', '1987-11-29')
  await page.getByRole('button', { name: 'Calculate' }).click()
  const result = page.locator('#life-path-result')
  await expect(result).toContainText('Your life path number')
  await expect(result).toContainText('Master number')
  await expect(result).toContainText('Month 11 → 11 (kept)')
  await expect(result).toContainText('Day 29 → 2 + 9 = 11 (kept)')
  await expect(result).toContainText('Year 1987 → 1 + 9 + 8 + 7 = 25 → 2 + 5 = 7')
  await expect(result).toContainText('11 + 11 + 7 = 29 → 2 + 9 = 11')
  const link = result.getByRole('link', { name: 'Life Path Number 11' })
  await expect(link).toHaveAttribute('href', '/life-path-number/11')
  // 分享链接只含日期，打开后直接复现结果
  const shareField = result.getByLabel('Share link')
  await expect(shareField).toHaveValue(/\/life-path-number#r=/)
  const share = await shareField.inputValue()
  await page.goto('/numerology-calculator')
  await page.goto(share)
  await hydrated(page)
  await expect(page.locator('#life-path-result')).toContainText('Your life path number')
})

test('禁用 JS 的请求含 H1、表单标签、数字网格与 FAQPage', async ({ request }) => {
  const html = await (await request.get('/life-path-number')).text()
  expect(html).toMatch(/<h1[^>]*>Life Path Number Calculator<\/h1>/)
  // 日期为年 / 月 / 日分段（不用原生日期控件，其占位符随浏览器语言显示）
  expect(html).toMatch(/<legend[^>]*>Date of birth<\/legend>/)
  expect(html).not.toContain('type="date"')
  for (const value of LIFE_PATH_NUMBERS) expect(html).toContain(`href="/life-path-number/${value}"`)
  for (const type of ['FAQPage', 'WebApplication', 'BreadcrumbList'])
    expect(html).toContain(`"@type":"${type}"`)
  expect(html).toContain('What is a life path number?')
  // 首页是品牌 head：不再输出 FAQPage
  const home = await (await request.get('/')).text()
  expect(home).not.toContain('"@type":"FAQPage"')
  expect(home).toContain('"@type":"WebSite"')
})

test('完整计算器：不填姓名只显示日期类数字，姓名类提示解锁', async ({ page }) => {
  await page.goto('/numerology-calculator')
  await hydrated(page)
  await fillDate(page, 'Date of birth', '1987-11-29')
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
  await fillDate(page, 'Your date of birth', '1987-11-29')
  await fillDate(page, 'Their date of birth', '1990-05-15')
  await page.getByRole('button', { name: 'Calculate' }).click()
  const level = { high: 'High', medium: 'Medium', challenging: 'Challenging' }[expected.level]
  await expect(page.locator('section#compatibility')).toContainText(
    `${expected.left.value} & ${expected.right.value}`,
  )
  await expect(page.locator('section#compatibility')).toContainText(level)
  await expect(page.locator('section#row li')).toHaveCount(12)
})

// specs/chart-visuals「西方站浅色与深色」：出结果后在浅色与深色之间切换，推导图形与数字网格的文字
// 随 token 切换，两种主题下对比度均不低于 4.5:1（背景取文字所在格子的填充色，没有填充时取所在区块的底色）。
test('数字分布图在西方站浅色与深色下可读', async ({ page }) => {
  await page.goto('/numerology-chart')
  await hydrated(page)
  await fillDate(page, 'Date of birth', '1987-11-29')
  await page.getByLabel('Full name (optional)').fill('Morgan Avery Lee')
  await page.getByRole('button', { name: 'Calculate' }).click()
  await expect(page.locator('section#birth-grid svg[data-chart]')).toBeVisible()
  await expect(page.locator('section#life-path svg[data-chart]')).toBeVisible()
  const fills: Record<string, string[]> = {}
  for (const theme of ['light', 'dark'] as const) {
    await page.locator(`footer [data-theme-option="${theme}"]`).click()
    await expect(page.locator('html')).toHaveClass(
      theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
    )
    const texts = await page.evaluate(() => {
      const parse = (color: string) => {
        const probe = document.createElement('canvas').getContext('2d')
        if (!probe || color === 'none') return null
        probe.fillStyle = color
        probe.fillRect(0, 0, 1, 1)
        const [r = 0, g = 0, b = 0, a = 0] = probe.getImageData(0, 0, 1, 1).data
        return a === 0 ? null : ([r, g, b] as const)
      }
      const luminance = (rgb: readonly number[]) => {
        const [r = 0, g = 0, b = 0] = rgb.map((value) => {
          const channel = value / 255
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const backdrop = (text: Element) => {
        // 同组里有填充的格子优先；否则向上找第一个有底色的 HTML 元素
        for (const rect of text.parentElement?.querySelectorAll(':scope > rect') ?? []) {
          const fill = parse(getComputedStyle(rect).fill)
          if (fill) return fill
        }
        for (let node = text.closest('svg')?.parentElement; node; node = node.parentElement) {
          const color = parse(getComputedStyle(node).backgroundColor)
          if (color) return color
        }
        return null
      }
      return [...document.querySelectorAll('svg[data-chart] text')].map((text) => {
        const style = getComputedStyle(text)
        const ink = parse(style.fill)
        const ground = backdrop(text)
        if (!ink || !ground) return { text: text.textContent, fill: style.fill, ratio: 0 }
        const [high, low] = [luminance(ink), luminance(ground)].sort((a, b) => b - a)
        return {
          text: text.textContent,
          fill: style.fill,
          ratio: ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05),
        }
      })
    })
    expect(texts.length).toBeGreaterThan(20)
    for (const item of texts)
      expect(item.ratio, `${theme}: “${item.text}” ${item.fill}`).toBeGreaterThanOrEqual(4.5)
    fills[theme] = texts.map((item) => item.fill)
  }
  // 颜色确实随主题切换，而不是写死的同一组值
  expect(fills.light).not.toEqual(fills.dark)
})

test('数字页 22：完整说明、内嵌计算器与正文内 3 个相邻数字的链接', async ({ page }) => {
  const response = await page.goto('/life-path-number/22')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Life Path Number 22')
  // 面包屑 Home › Life Path Number › 22：第二级链接到父页，并输出 BreadcrumbList
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(crumbs.getByRole('link', { name: 'Life Path Number' })).toHaveAttribute(
    'href',
    '/life-path-number',
  )
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('22')
  expect(
    (await page.locator('script[type="application/ld+json"]').allTextContents()).some(
      (json) => JSON.parse(json)['@type'] === 'BreadcrumbList',
    ),
  ).toBe(true)
  await expect(page.getByRole('form', { name: 'Birth date' })).toBeVisible()
  await expect(page.locator('article')).toContainText('What Life Path Number 22 means')
  // 12 个数字的网格只留在父页；数字页在句子里链接相邻数字（大师数：另外两个大师数与根数），锚文本为目标页主关键词
  const main = page.locator('main')
  await expect(main.locator('a[href^="/life-path-number/"]')).toHaveText([
    'Life Path Number 11',
    'Life Path Number 33',
    'Life Path Number 4',
  ])
  await expect(main.locator('nav a[href^="/life-path-number/"]')).toHaveCount(0)
  // 正文内链合计 5 条：相性（长文里的一句）、3 个相邻数字、页尾转化条
  await expect(main.locator('article a')).toHaveText(['life path compatibility'])
  await expect(main.getByTestId('link-band').getByRole('link')).toHaveAttribute(
    'href',
    '/numerology-calculator',
  )
  await expect(main.locator('a:not(nav[aria-label="Breadcrumb"] a)')).toHaveCount(5)
  expect((await page.goto('/life-path-number/10'))?.status()).toBe(404)
  expect((await page.goto('/ko/numerology-calculator'))?.status()).toBe(404)
})
