import { expect, test } from '@playwright/test'
import { fillTimeByName } from './date-field.ts'

test('简体路径的繁体别名 301 到可正常访问的简体规范页', async ({ request }) => {
  for (const [alias, slug] of [
    ['大運', '大运'],
    ['身強身弱', '身强身弱'],
  ]) {
    const response = await request.get(`/zh-hans/${encodeURI(`八字/${alias}`)}`, {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(301)
    expect(decodeURI(response.headers().location ?? '')).toBe(`/zh-hans/八字/${slug}`)
    const canonical = await request.get(`/zh-hans/${encodeURI(`八字/${slug}`)}`)
    expect(canonical.status()).toBe(200)
  }
})

for (const [locale, base, slug, title, submit] of [
  ['zh-hant', '八字', '空亡', '空亡是什麼：日空、年空與所在柱的查閱方式', '立即排盤'],
  ['ko', '사주', '공망', '공망 뜻과 확인 방법: 일공과 연공 구분하기', '즉시 만세력'],
] as const) {
  test(`${locale} 空亡概念页提交后滚动到神煞并高亮空亡项`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/${locale}/${encodeURI(`${base}/${slug}`)}/`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.locator('article')).toContainText(locale === 'ko' ? '공망' : '空亡')
    const faq = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(faq.map((json) => JSON.parse(json)).some((data) => data['@type'] === 'FAQPage')).toBe(
      true,
    )
    await page.locator('input[name="year"]').fill('1990')
    await page.locator('input[name="month"]').fill('5')
    await page.locator('input[name="day"]').fill('15')
    // 时间为分段字段（#210），提交值在同名隐藏字段中
    await fillTimeByName(page, 'time', '10:30')
    await page.getByRole('button', { name: submit, exact: true }).click()
    await expect(page.locator('#void')).toHaveAttribute('data-concept-focus', 'true')
    await expect(page.locator('#void')).toHaveCSS('outline-style', 'solid')
    await expect(page.locator('#void')).toBeInViewport()
    await expect
      .poll(() =>
        page
          .locator('#shensha')
          .evaluate((element) => Math.abs(element.getBoundingClientRect().top - 24)),
      )
      .toBeLessThan(8)
    // 再次提交仍重新滚动并高亮；与主工具页（八字排盤 / 만세력）之间共享输入。
    await page.getByRole('button', { name: submit, exact: true }).click()
    await expect(page.locator('#void')).toHaveAttribute('data-concept-focus', 'true')
    await page.goto(`/${locale}/${encodeURI(locale === 'ko' ? '만세력' : '八字排盤')}`, {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('input[name="year"]')).toHaveValue('1990')
    expect(errors).toEqual([])
  })
}

test('概念说明在禁用脚本时可读；不存在的 slug 和错误语言命名空间返回 404', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/zh-hant/八字/十神/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.locator('article')).toContainText('十神')
  await expect(page.getByRole('button', { name: '立即排盤' })).toBeDisabled()
  await context.close()
  for (const path of ['/zh-hant/八字/不存在/', '/ko/八字/空亡/', '/zh-hant/사주/공망/'])
    expect((await request.get(path)).status()).toBe(404)
  // specs/eastern-tool-pages「概念页链接到工具页」：排盘入口指向八字主词工具页，正文不以语言首页为入口
  const html = await (await request.get(`/zh-hant/${encodeURI('八字/大運')}`)).text()
  expect(html).toContain(`href="/zh-hant/${encodeURI('八字排盤')}"`)
  expect(html).not.toMatch(/<a href="\/zh-hant\/?">[^<]*八字排盤/)
})
