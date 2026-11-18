/// <reference lib="dom" />
import { type Browser, expect, type Page, test } from '@playwright/test'

// 品牌落地页（openspec separate-landing-homepage tasks 4.1–4.3，specs/home-hub）：
// 首页不含工具表单，首屏唯一主按钮指向本语言主工具页；今日条服务端只输出骨架，
// 浏览器内填入当日干支 / Universal Day，填入前后尺寸不变。
const HOMES = [
  { name: '繁中', east: true, path: '/zh-hant', tool: `/zh-hant/${encodeURI('八字排盤')}` },
  { name: '简中', east: true, path: '/zh-hans', tool: `/zh-hans/${encodeURI('八字排盘')}` },
  { name: '韩语', east: true, path: '/ko', tool: `/ko/${encodeURI('만세력')}` },
  { name: '西方站', east: false, path: '/', tool: '/life-path-number' },
] as const

function homeUrl(home: (typeof HOMES)[number]) {
  const url = new URL(home.path, test.info().project.use.baseURL)
  // `east.localhost` 由浏览器解析到本机，站点识别见 features/site/site.ts
  if (home.east) url.hostname = 'east.localhost'
  return url.href
}

/** 今日条色带、其中两行文字的尺寸，以及到下一个区块的距离 */
const stripMetrics = (page: Page) =>
  page.evaluate(() => {
    const section = document.querySelector('[data-landing-block="today"]')
    const band = section?.querySelector('.bg-surface-2')
    const next = section?.nextElementSibling
    if (!section || !band || !next) return null
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }
    const lines = [...(band.firstElementChild?.children ?? [])].map(
      (line) => line.getBoundingClientRect().height,
    )
    return {
      band: box(band),
      lines,
      // 相对位置：未执行脚本的页面不加载站点字体，上方文字折行可能不同，不比较绝对位置
      gapToNext: next.getBoundingClientRect().top - section.getBoundingClientRect().bottom,
    }
  })

async function measure(browser: Browser, url: string, viewport: { width: number; height: number }) {
  // 未执行脚本时的页面即服务端输出的骨架
  const staticContext = await browser.newContext({ viewport, javaScriptEnabled: false })
  const staticPage = await staticContext.newPage()
  await staticPage.goto(url)
  const skeleton = await stripMetrics(staticPage)
  const skeletonText = await staticPage.locator('[data-landing-block="today"]').innerText()
  await staticContext.close()

  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(url)
  await expect(page.locator('[data-landing-block="today"]')).toHaveAttribute('data-today', 'ready')
  await page.evaluate(() => document.fonts.ready)
  const filled = await stripMetrics(page)
  const filledText = await page.locator('[data-landing-block="today"]').innerText()
  await context.close()
  return { skeleton, filled, skeletonText, filledText }
}

for (const home of HOMES) {
  test.describe(`落地页（${home.name}）`, () => {
    test('没有工具表单，唯一主按钮指向主工具页', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(homeUrl(home))
      await expect(page.locator('main h1')).toHaveCount(1)
      await expect(page.locator('main :is(form, input, select, textarea)')).toHaveCount(0)
      const cta = page.locator('main [data-landing-cta]')
      await expect(cta).toHaveCount(1)
      await expect(cta).toHaveAttribute('href', home.tool)
      // 手机首屏内可见
      await expect(cta).toBeInViewport()
      await cta.click()
      await expect(page).toHaveURL((url) => url.pathname === home.tool)
      await expect(page.locator('main form').first()).toBeVisible()
    })

    test('今日条：服务端只有骨架，填入当日信息后尺寸与到下一区块的距离不变', async ({
      browser,
    }) => {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
      ]) {
        const { skeleton, filled, skeletonText, filledText } = await measure(
          browser,
          homeUrl(home),
          viewport,
        )
        expect(skeleton, `${viewport.width}px`).not.toBeNull()
        expect(filled, `${viewport.width}px`).toEqual(skeleton)
        // 骨架不含日期数字；填入后有当年年份与当日干支 / Universal Day
        expect(skeletonText).not.toMatch(/\d/)
        expect(filledText).toContain(String(new Date().getFullYear()))
        expect(filledText).toMatch(
          home.east
            ? /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/
            : /Universal Day (?:[1-9]|11|22)\b/,
        )
      }
    })
  })
}

test('首屏次要链接是页内锚点，滚动到样例报告', async ({ page }) => {
  await page.goto('/')
  await page.locator('main a[href="#sample"]').click()
  await expect(page).toHaveURL((url) => url.pathname === '/' && url.hash === '#sample')
  await expect(page.locator('#sample')).toBeInViewport()
})
