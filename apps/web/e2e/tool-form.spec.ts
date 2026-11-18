/// <reference lib="dom" />
import { expect, type Page, test } from '@playwright/test'
import { chooseOption } from './select.ts'

// 出生信息表单（openspec refresh-visual-system-warm 5.1、5.2；specs/tool-pages「工具页紧凑布局」）：
// 手机首屏可见提交按钮、进阶选项默认收起，出生地改用 @xuanxue/ui 的 Select 后条件字段仍然联动。
const MOBILE = { width: 390, height: 844 }

function siteUrl(path: string, site: 'east' | 'west') {
  const url = new URL(path, test.info().project.use.baseURL)
  // `east.localhost` 由浏览器解析到本机，站点识别见 features/site/site.ts
  if (site === 'east') url.hostname = 'east.localhost'
  return url.href
}
const eastUrl = (path: string) => siteUrl(path, 'east')

async function expectSubmitInFirstScreen(
  page: Page,
  path: string,
  submit: string,
  site: 'east' | 'west' = 'east',
) {
  await page.setViewportSize(MOBILE)
  await page.goto(siteUrl(path, site))
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 })
  // 不滚动：提交按钮整体在 390×844 的首屏内
  await expect(page.getByRole('button', { name: submit, exact: true })).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
}

// 三个主工具页（openspec separate-landing-homepage tasks 5.1）：H1 + 简介 + 表单在首屏，长文、FAQ 与内链在结果容器之后
for (const [name, site, path, submit, article] of [
  ['八字排盤', 'east', '/zh-hant/八字排盤', '立即排盤', '八字命盤怎麼看'],
  ['八字排盘', 'east', '/zh-hans/八字排盘', '立即排盘', '八字命盘怎么看'],
  ['만세력', 'east', '/ko/만세력', '즉시 만세력', '만세력 보는 법'],
  ['Life Path Number', 'west', '/life-path-number', 'Calculate', 'What is a life path number?'],
] as const) {
  test(`${name}：手机首屏可见 H1 与提交按钮，长文与 FAQ 在表单和结果之后`, async ({ page }) => {
    await expectSubmitInFirstScreen(page, path, submit, site)
    const order = await page.evaluate((title) => {
      const main = document.querySelector('main')
      const form = main?.querySelector('form')
      const result = main?.querySelector('#life-path-result, #result')
      const heading = [...(main?.querySelectorAll('h2') ?? [])].find(
        (element) => element.textContent?.trim() === title,
      )
      const faq = main?.querySelector('details:not(form details)')
      const after = (a: Element | null | undefined, b: Element | null | undefined) =>
        Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      return {
        resultAfterForm: after(form, result),
        articleAfterResult: after(result, heading),
        faqAfterArticle: after(heading, faq),
        // H1 与表单之间只有面包屑与简介，没有长文或区块标题
        headingsBeforeForm: [...(main?.querySelectorAll('h2, h3') ?? [])].filter((element) =>
          after(element, form),
        ).length,
      }
    }, article)
    expect(order).toEqual({
      resultAfterForm: true,
      articleAfterResult: true,
      faqAfterArticle: true,
      headingsBeforeForm: 0,
    })
  })
}

test('紫微斗數排盤：手机首屏可见 H1 与提交按钮，进阶选项收起', async ({ page }) => {
  await expectSubmitInFirstScreen(page, '/zh-hant/紫微斗數排盤', '排紫微命盤')
  const advanced = page.locator('form details')
  await expect(advanced).not.toHaveAttribute('open', '')
  await expect(page.getByRole('checkbox', { name: '真太陽時校正' })).toBeHidden()
  await advanced.locator('summary').click()
  await expect(page.getByRole('checkbox', { name: '真太陽時校正' })).toBeVisible()
})

// 双人表单两组出生信息的高度超过一屏：提交按钮吸附在视口底部（gunghap-page.tsx），两人的进阶选项默认收起
test('사주궁합：手机首屏可见提交按钮，进阶选项收起', async ({ page }) => {
  await expectSubmitInFirstScreen(page, '/ko/사주궁합', '궁합 보기')
  const advanced = page.locator('form details')
  await expect(advanced).toHaveCount(2)
  for (const details of await advanced.all()) await expect(details).not.toHaveAttribute('open', '')
  // 滚到页面底部后按钮回到表单末尾，不遮挡表单之后的内容
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.getByRole('button', { name: '궁합 보기', exact: true })).not.toBeInViewport()
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
