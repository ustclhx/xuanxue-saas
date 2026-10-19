import { expect, test } from '@playwright/test'
import { encodeReading } from '@xuanxue/tarot'
import { encodeShareInput } from '../src/features/tools/share.ts'
import { stubTurnstile } from './turnstile.ts'

// API 的确认与投递由 growth 集成测试覆盖；这里验证真实页面的结果接线与三语表单。
const scenarios = [
  {
    locale: 'en',
    path: '/',
    sourceTool: 'life-path',
    share: { date: '1987-11-29' },
    result: { kind: 'numerology', lifePath: 11 },
    label: 'Career',
  },
  {
    locale: 'zh-Hant',
    path: '/zh-hant',
    sourceTool: 'bazi',
    share: { year: '1990', month: '5', day: '15', time: '10:30' },
    result: { kind: 'bazi', dayMaster: 'geng' },
    label: '事業',
  },
  {
    locale: 'ko',
    path: `/ko/${encodeURI('타로')}/오늘의-카드`,
    sourceTool: 'tarot-daily',
    share: {
      reading: encodeReading({ spread: 'daily', cards: [{ cardId: 'major-00', reversed: false }] }),
    },
    result: { kind: 'tarot', cards: [{ cardId: 'major-00', reversed: false }] },
    label: '직업',
  },
]

for (const scenario of scenarios)
  test(`${scenario.locale} 结果后可提交来源、主题与结果摘要`, async ({ page }) => {
    await stubTurnstile(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(scenario.path, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-slot="reading-optin"]')).toHaveCount(0)
    await page.goto(`${scenario.path}#r=${encodeShareInput(scenario.share)}`, {
      waitUntil: 'networkidle',
    })
    // hash-only 导航不会重新挂载页面，重载以模拟邮件中的新访问。
    await page.reload({ waitUntil: 'networkidle' })
    const card = page.locator('[data-slot="reading-optin"]')
    await expect(card).toBeVisible()
    await expect(card.locator('option[value="career"]')).toHaveText(scenario.label)
    await expect(card.getByRole('button')).toBeEnabled()
    await card.locator('input[name="email"]').fill('reader@example.test')
    await card.locator('input[name="name"]').fill('Reader')
    await card.locator('select').selectOption('career')
    let submission: unknown
    await page.route('**/api/newsletter', async (route) => {
      submission = route.request().postDataJSON()
      await route.fulfill({ json: { ok: true } })
    })
    await card.getByRole('button').click()
    await expect(card.getByRole('status')).not.toBeEmpty()
    expect(submission).toMatchObject({
      email: 'reader@example.test',
      reading: {
        name: 'Reader',
        sourceTool: scenario.sourceTool,
        locale: scenario.locale,
        topic: 'career',
        result: scenario.result,
      },
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })
