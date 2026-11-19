import { expect, type Page, test } from '@playwright/test'

// 第 7 组对照验收（openspec refresh-visual-system-warm tasks 7.2）发现的问题的回归用例：
// 日期分段在窄容器里不裁切数字、翻牌结果的标题层级、东方每日页的日主页签与中性初始态、枢纽页的未提交样例。
test.use({ reducedMotion: 'reduce' })

const site = (baseURL: string | undefined, name: 'east' | 'west') => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${name}.localhost`
  return url.origin
}

/** 日期各段里的数字是否完整显示：输入框的内容宽度不超过可见宽度 */
async function expectDateSegmentsFit(page: Page, field: string, label: string) {
  const parts = page.locator(`fieldset[data-field="${field}"] [data-part]`)
  await expect(parts).toHaveCount(3)
  const clipped = await parts.evaluateAll((inputs) =>
    inputs
      .map((input) => input as HTMLInputElement)
      .filter((input) => input.scrollWidth > input.clientWidth)
      .map((input) => `${input.dataset.part}: ${input.scrollWidth} > ${input.clientWidth}`),
  )
  expect(clipped, label).toEqual([])
}

for (const [name, host, path, field, viewport] of [
  // 手机上的个人日卡片（英语单位 “Month” 最宽）
  ['每日数字 390', 'west', '/daily-numerology', 'birthDate', { width: 390, height: 844 }],
  // 两列表单在刚过 sm 断点时每列最窄
  ['Life Path 640', 'west', '/life-path-number', 'birthDate', { width: 640, height: 900 }],
  ['Life Path 390', 'west', '/life-path-number', 'birthDate', { width: 390, height: 844 }],
  ['相性 768', 'west', '/life-path-compatibility', 'first', { width: 768, height: 900 }],
  ['紫微斗數 390', 'east', '/zh-hant/紫微斗數排盤', 'birthDate', { width: 390, height: 844 }],
] as const) {
  test(`日期分段不裁切数字：${name}`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport)
    await page.goto(`${site(baseURL, host)}${encodeURI(path)}`)
    const group = page.locator(`fieldset[data-field="${field}"]`)
    // 东方站出生信息表单用自己的年月日分段（没有这个 fieldset）时跳过
    test.skip((await group.count()) === 0, '该页不使用 DateField')
    await group.locator('[data-part="year"]').fill('1990')
    await group.locator('[data-part="month"]').fill('12')
    await group.locator('[data-part="day"]').fill('28')
    await page.locator('h1').click()
    await expectDateSegmentsFit(page, field, name)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    )
  })
}

for (const [host, path, shuffle] of [
  ['west', '/tarot', /^Shuffle the deck$/],
  ['east', '/zh-hans/塔罗', /^洗牌$/],
] as const) {
  test(`翻牌结果的标题从 H2 开始：${path}`, async ({ page, baseURL }) => {
    await page.goto(`${site(baseURL, host)}${encodeURI(path)}`)
    await expect(page.getByTestId('tarot-table')).toHaveAttribute('data-hydrated', 'true')
    await page.getByRole('button', { name: shuffle }).click()
    await page.getByTestId('tarot-cut-spread').locator('button').nth(20).click()
    await page.locator('[data-slot-index="0"]').click()
    await page.locator('[data-slot-index="1"]').click()
    await page.locator('[data-slot-index="2"]').click()
    await expect(page.getByTestId('tarot-result-card')).toHaveCount(3)
    // 页面 H1 之后的第一个标题是结果里的 H2，不跳到 H3
    const levels = await page
      .locator('main :is(h1, h2, h3, h4)')
      .evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))))
    expect(levels[0]).toBe(1)
    for (let index = 1; index < levels.length; index += 1)
      expect((levels[index] ?? 0) - (levels[index - 1] ?? 0)).toBeLessThanOrEqual(1)
    await expect(page.locator('#card-1 h2')).toHaveCount(1)
  })
}

for (const path of ['/zh-hans/每日运势', '/zh-hant/每日運勢', '/ko/오늘의-운세']) {
  test(`东方每日页 ${path}：页签列表里只有页签，未选择前是中性状态`, async ({ page, baseURL }) => {
    await page.goto(`${site(baseURL, 'east')}${encodeURI(path)}`)
    const tablist = page.getByRole('tablist')
    await expect(tablist.locator(':scope > *')).toHaveCount(10)
    await expect(tablist.locator(':scope > :not([role="tab"])')).toHaveCount(0)
    // 新会话：没有选中的日主，十个面板都在 HTML 里但不显示，只有一句中性提示
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(0)
    await expect(page.locator('[role="tabpanel"]')).toHaveCount(10)
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(0)
    await expect(page.getByTestId('daily-master-neutral')).toBeVisible()
    // 选一个日主后显示它的面板，中性提示消失
    const tab = page.getByRole('tab').nth(6)
    await expect(async () => {
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 })
    }).toPass()
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1)
    await expect(page.getByTestId('daily-master-neutral')).toHaveCount(0)
  })
}

for (const [path, heading] of [
  ['/destiny-number', 'Expression'],
  ['/soul-urge-number', 'Soul Urge'],
] as const) {
  test(`枢纽页 ${path} 未提交时显示虚构姓名的样例结果`, async ({ browser, baseURL }) => {
    // 样例在服务端输出：禁用脚本也能看到
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(`${site(baseURL, 'west')}${path}`)
    const example = page.getByTestId('name-example')
    await expect(example).toContainText('Example · Morgan Avery Lee (fictional)')
    await expect(example.locator('h2')).toContainText(heading)
    await expect(example).toContainText('Enter a name above')
    await context.close()
  })
}
