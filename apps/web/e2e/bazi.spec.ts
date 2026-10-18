import { expect, type Page, test } from '@playwright/test'

// 东方站排盘页面（openspec add-bazi-saju-chart tasks.md 2.2、2.3、3.1、3.2）。
// 本地 Host 未登记时按西方站主题渲染，但语言前缀与页面内容相同，足以验证结构与结果。
const ZIWEI = `/zh-hant/${encodeURIComponent('紫微斗數排盤')}`
const MINGPAN = `/zh-hant/${encodeURIComponent('命盤查詢')}`
const GUNGHAP = `/ko/${encodeURIComponent('사주궁합')}`

async function fillBirth(
  page: Page,
  labels: { year: string; month: string; day: string; time: string },
  value: { year: string; month: string; day: string; time: string },
) {
  await page.getByLabel(labels.year, { exact: true }).fill(value.year)
  await page.getByLabel(labels.month, { exact: true }).fill(value.month)
  await page.getByLabel(labels.day, { exact: true }).fill(value.day)
  await page.getByLabel(labels.time).fill(value.time)
}

const zhLabels = { year: '年', month: '月', day: '日', time: '出生時間' }
const koLabels = { year: '년', month: '월', day: '일', time: '태어난 시간' }
// 提交前等待水合：否则表单按原生 GET 提交并刷新页面
const HYDRATED = { waitUntil: 'networkidle' } as const
const sample = { year: '1990', month: '5', day: '15', time: '10:30' }

const blockIds = (page: Page) =>
  page
    .locator('#result > section, #result > div > section, #result > div > div > section')
    .evaluateAll((sections) => sections.map((section) => section.id))

test('繁中首页：提交样例后依次显示 7 个区块与样例命盘的值', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/zh-hant', HYDRATED)
  await expect(page).toHaveTitle('免費八字排盤｜生辰八字命盤查詢、大運流年與喜用神線上解析')
  await fillBirth(page, zhLabels, sample)
  await page.getByRole('button', { name: '立即排盤' }).click()

  await expect(page.locator('#weight')).toBeVisible()
  expect(await blockIds(page)).toEqual([
    'pillars',
    'elements',
    'strength',
    'useful-god',
    'luck',
    'shensha',
    'weight',
  ])
  // 1990-05-15 10:30 台北男 = 庚午 辛巳 庚辰 辛巳（docs/design/visual-system.md 样例）
  const pillars = page.locator('#pillars [data-pillar]')
  await expect(pillars).toHaveCount(4)
  for (const [key, text] of [
    ['year', /庚.*午/s],
    ['month', /辛.*巳/s],
    ['day', /庚.*辰/s],
    ['hour', /辛.*巳/s],
  ] as const)
    await expect(page.locator(`#pillars [data-pillar="${key}"]`)).toHaveText(text)
  await expect(page.locator('#pillars')).toContainText('排盤時間：1990-05-15 10:30（台北，國曆）')
  await expect(page.locator('#strength [data-verdict="strong"]')).toHaveText('身強')
  await expect(page.locator('#useful-god')).toContainText('用神 水、喜神 木')
  await expect(page.locator('#luck')).toContainText('7 歲 3 個月起運')
  await expect(page.locator('#shensha [data-shensha="kongWang"]')).toContainText('申酉')
  await expect(page.locator('#weight [data-weight]')).toHaveText('4 兩 4 錢')

  // 大运可点进：第三步展开十年详情与流年，并链接到大運概念页
  const third = page.locator('#luck [data-decade="2"]')
  await third.click()
  await expect(third).toHaveAttribute('aria-expanded', 'true')
  const panel = page.locator('#luck [data-decade-panel="2"]')
  await expect(panel).toContainText('甲申 大運 · 偏財 · 2017–2026 年')
  await expect(panel.locator('li')).toHaveCount(10)
  await expect(panel.getByRole('link', { name: '大運怎麼看？→' })).toHaveAttribute(
    'href',
    `/zh-hant/${encodeURI('八字/大運')}#luck`,
  )

  // 订阅 / 解锁插槽位于结果之后，没有弹窗
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // 分享链接复现同一结果
  const href = await page.locator('#result input[readonly]').inputValue()
  expect(href).toContain('#r=')
  await page.goto('about:blank')
  await page.goto(href, HYDRATED)
  await expect(page.locator('#weight [data-weight]')).toHaveText('4 兩 4 錢')
  expect(errors).toEqual([])
})

test.describe('禁用脚本', () => {
  test.use({ javaScriptEnabled: false })
  test('首页仍输出 H1 与表单标签', async ({ page }) => {
    await page.goto('/zh-hant')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('免費八字排盤')
    const form = page.getByRole('form', { name: '出生資料' })
    for (const label of ['曆法', '性別', '出生日期'])
      await expect(form.locator('legend', { hasText: label })).toBeVisible()
    for (const label of ['出生時間', '不知道出生時辰', '真太陽時校正'])
      await expect(form.getByLabel(label, { exact: true })).toBeVisible()
    await expect(form.getByRole('combobox', { name: '出生地' })).toBeVisible()
    await expect(form.getByRole('button', { name: '立即排盤' })).toBeVisible()
  })
})

test('八字切到紫微与命盘查询时保留输入，紫微无时辰提示且不出盘', async ({ page }) => {
  await page.goto('/zh-hant', HYDRATED)
  await fillBirth(page, zhLabels, sample)
  await page.getByLabel('女', { exact: true }).check({ force: true })
  await page
    .getByRole('navigation', { name: '延伸閱讀' })
    .getByRole('link', { name: '紫微斗數排盤' })
    .click()

  await expect(page).toHaveURL(new RegExp(`${ZIWEI}$`))
  await expect(page.getByLabel('年', { exact: true })).toHaveValue('1990')
  await expect(page.getByLabel('月', { exact: true })).toHaveValue('5')
  await expect(page.getByLabel('日', { exact: true })).toHaveValue('15')
  await expect(page.getByLabel('出生時間')).toHaveValue('10:30')
  await expect(page.getByLabel('女', { exact: true })).toBeChecked()

  await page.getByRole('button', { name: '排紫微命盤' }).click()
  await expect(page.locator('#palaces [data-palace]')).toHaveCount(12)

  await page.getByLabel('不知道出生時辰').check()
  await page.getByRole('button', { name: '排紫微命盤' }).click()
  await expect(page.locator('[data-ziwei="requires-hour"]')).toContainText('需要出生時辰')
  await expect(page.locator('#palaces')).toHaveCount(0)

  await page.goto(MINGPAN, HYDRATED)
  await expect(page.getByLabel('年', { exact: true })).toHaveValue('1990')
  await expect(page.getByLabel('不知道出生時辰')).toBeChecked()
  await page.getByRole('button', { name: '查詢命盤' }).click()
  await expect(page.locator('#pillars')).toContainText('需要出生時辰')
  await expect(page.locator('#luck [data-decade]')).toHaveCount(10)
})

test('韩语만세력：6 个区块顺序、진태양시提示与韩国夏令时样例', async ({ page }) => {
  await page.goto('/ko', HYDRATED)
  await expect(page).toHaveTitle('만세력 - 무료 사주 만세력 조회 (사주팔자 · 대운 · 신살)')
  await expect(page.getByLabel('출생지')).toHaveValue('seoul')
  const trueSolar = page.getByLabel('진태양시 보정')
  await expect(trueSolar).not.toBeChecked()
  await expect(page.getByText('많은 국내 만세력은 진태양시 보정을 기본으로 켭니다')).toBeVisible()

  // 1987-07-01 10:30 서울：서머타임 기간이라 표준시 09:30으로 계산
  await fillBirth(page, koLabels, { year: '1987', month: '7', day: '1', time: '10:30' })
  await page.getByRole('button', { name: '즉시 만세력' }).click()
  await expect(page.locator('#shensha')).toBeVisible()
  expect(await blockIds(page)).toEqual([
    'pillars',
    'elements',
    'strength',
    'useful-god',
    'luck',
    'shensha',
  ])
  await expect(page.locator('#pillars')).toContainText('계산 시각: 1987-07-01 09:30 (서울, 양력)')
  await expect(page.locator('#pillars')).toContainText('서머타임 1시간을 뺐습니다')
  // 시주는 09:30 기준 巳시
  await expect(page.locator('#pillars [data-pillar="hour"]')).toContainText('巳')
  // 신살·귀인·공망：모든 기준별 행
  await expect(page.locator('#shensha [data-shensha]')).toHaveCount(13)
  await expect(page.locator('#shensha [data-shensha="kongWang"]')).toHaveCount(2)
})

test('사주궁합：두 사람을 제출하면 점수와 항목별 가감점을 보여 준다', async ({ page }) => {
  await page.goto(GUNGHAP, HYDRATED)
  for (const [prefix, value] of [
    ['a_', sample],
    ['b_', { year: '1992', month: '8', day: '3', time: '07:00' }],
  ] as const) {
    await page.locator(`input[name="${prefix}year"]`).fill(value.year)
    await page.locator(`input[name="${prefix}month"]`).fill(value.month)
    await page.locator(`input[name="${prefix}day"]`).fill(value.day)
    await page.locator(`input[name="${prefix}time"]`).fill(value.time)
  }
  await page.getByRole('button', { name: '궁합 보기' }).click()
  const score = page.locator('#score [data-score]')
  await expect(score).toHaveText(/^\d{1,3}점$/)
  await page.getByText('점수 구성 보기').click()
  const items = page.locator('#score [data-item]')
  await expect(items.first()).toBeVisible()
  await expect(page.locator('#score [data-item="elementComplementAB"]')).toContainText(/[+−]?\d+/)
  // 항목 합계 = 표시 점수（0–100 범위 안）
  const deltas = await items.locator('td').allTextContents()
  const sum = deltas.reduce(
    (total, text) => total + Number(text.replace('−', '-').replace('+', '')),
    60,
  )
  await expect(score).toHaveText(`${Math.max(0, Math.min(100, sum))}점`)
  await expect(page.locator('#pillars')).toContainText('일주 庚辰')
})
