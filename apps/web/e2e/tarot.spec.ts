import { expect, type Page, test } from '@playwright/test'

// 塔罗牌阵页（openspec add-tarot-reading tasks.md 2.1–2.3）：开启减少动态效果，洗牌直接进入铺牌，
// 牌位淡入；切牌、逐张翻牌或全部翻开后检查结果、分享链接与判定依据。
test.use({ reducedMotion: 'reduce' })

const site = (baseURL: string | undefined, name: 'east' | 'west') => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${name}.localhost`
  return url.origin
}

/** 等待页面完成水合，避免脚本加载前的点击退化为原生表单提交 */
async function hydrated(page: Page) {
  await expect(page.getByTestId('tarot-table')).toHaveAttribute('data-hydrated', 'true')
}

async function draw(page: Page, shuffle: RegExp, cut = 30) {
  await hydrated(page)
  await page.getByRole('button', { name: shuffle }).click()
  const spread = page.getByTestId('tarot-cut-spread')
  await expect(page.getByTestId('tarot-table')).toHaveAttribute('data-stage', 'cut')
  await spread.locator('button').nth(cut).click()
  await expect(page.getByTestId('tarot-table')).toHaveAttribute('data-stage', 'reveal')
}

async function resultCards(page: Page) {
  return page
    .getByTestId('tarot-result-card')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-card')))
}

test('英语三张牌：模板填入问题，键盘逐张翻牌，分享链接复现同一组牌', async ({ page, baseURL }) => {
  const west = site(baseURL, 'west')
  await page.goto(`${west}/tarot`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Free Three-Card Tarot')
  // 首屏不加载牌面图片
  await expect(page.locator('img[src^="/tarot/"]')).toHaveCount(0)
  await hydrated(page)
  await page.getByRole('button', { name: 'What should I focus on in love?' }).click()
  await expect(page.getByLabel('Your question')).toHaveValue('What should I focus on in love?')
  await draw(page, /^Shuffle the deck$/)
  // 发牌后焦点在第一张，Enter 连续翻开
  const slots = page.getByTestId('tarot-slot')
  for (let i = 0; i < 3; i++) {
    await expect(page.locator(`[data-slot-index="${i}"]`)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(slots.nth(i)).toHaveAttribute('data-revealed', 'true')
  }
  await expect(page.getByTestId('tarot-result-card')).toHaveCount(3)
  const cards = await resultCards(page)
  expect(new Set(cards).size).toBe(3)
  await expect(page.locator('[data-testid="tarot-slot"] img')).toHaveCount(3)
  for (const alt of await page
    .locator('[data-testid="tarot-slot"] img')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('alt'))))
    expect(alt).toMatch(/, (Upright|Reversed)$/)

  await expect(page.getByLabel('Share link')).toHaveValue(/#r=/)
  const link = await page.getByLabel('Share link').inputValue()
  expect(link).toContain('#r=')
  expect(link).not.toContain('love')
  const shared = await page.context().newPage()
  await shared.goto(link)
  await expect(shared.getByTestId('tarot-result-card')).toHaveCount(3)
  expect(await resultCards(shared)).toEqual(cards)
  await shared.close()
})

test('关闭逆位后三张牌均为正位', async ({ page, baseURL }) => {
  await page.goto(`${site(baseURL, 'west')}/tarot`)
  await hydrated(page)
  await page.getByLabel('Include reversed cards').uncheck()
  await draw(page, /^Shuffle the deck$/, 5)
  await page.getByRole('button', { name: 'Reveal all' }).click()
  await expect(page.getByTestId('tarot-orientation')).toHaveText(['Upright', 'Upright', 'Upright'])
})

test('凯尔特十字出 10 张不重复的牌及牌位名称', async ({ page, baseURL }) => {
  await page.goto(`${site(baseURL, 'west')}/tarot/celtic-cross`)
  await draw(page, /^Shuffle the deck$/, 70)
  await expect(page.getByTestId('tarot-slot')).toHaveCount(10)
  await page.getByRole('button', { name: 'Reveal all' }).click()
  await expect(page.getByTestId('tarot-result-card')).toHaveCount(10)
  expect(new Set(await resultCards(page)).size).toBe(10)
  for (const name of ['Present', 'Challenge', 'Foundation', 'Integration'])
    await expect(page.locator('#result')).toContainText(name)
})

test('是/否显示答案、该牌的理由与判定依据', async ({ page, baseURL }) => {
  await page.goto(`${site(baseURL, 'west')}/tarot/yes-or-no`)
  await draw(page, /^Shuffle the deck$/, 12)
  await page.getByRole('button', { name: /Reveal the/ }).click()
  await expect(page.getByTestId('tarot-answer')).toHaveText(/^(Yes|No|Maybe)$/)
  await expect(page.getByTestId('tarot-answer-reason')).toContainText('fixed entertainment mapping')
  await expect(page.locator('#answer')).toContainText('Every card has one fixed answer')
})

for (const { locale, path, shuffle, title, positions } of [
  {
    locale: 'zh-hant',
    path: '/塔羅',
    shuffle: /^洗牌$/,
    title: '免費三張牌塔羅',
    positions: ['過去', '現在', '未來'],
  },
  {
    locale: 'ko',
    path: '/타로',
    shuffle: /^카드 셔플$/,
    title: '무료 쓰리 카드 타로',
    positions: ['과거', '현재', '미래'],
  },
]) {
  test(`东方站 ${locale} 抽三张牌，牌位与牌名本地化`, async ({ page, baseURL }) => {
    const east = site(baseURL, 'east')
    await page.goto(`${east}/${locale}${encodeURI(path)}`)
    await expect(page.locator('html')).toHaveAttribute('data-site', 'east')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      'https://xuanxue-west.example/tarot',
    )
    await draw(page, shuffle)
    await page.getByRole('button', { name: /全部翻開|모두 열기/ }).click()
    await expect(page.getByTestId('tarot-result-card')).toHaveCount(3)
    for (const name of positions) await expect(page.locator('#result')).toContainText(name)
    await expect(page.locator('[data-testid="tarot-slot"] img').first()).toHaveAttribute(
      'alt',
      /(正位|逆位|정방향|역방향)$/,
    )
  })
}
