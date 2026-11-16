import { randomUUID } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { DEFAULT_FREE_FEATURES } from '@xuanxue/entitlements'
import { fixtureDb, register, simulateClientIp } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

// add-ui-design-system 8.7：账单页按「订阅 / 积分包 / 免费积分」分区，390px 无横向滚动。
// 套餐与价格只在本用例内写入隔离库并在结束时删除；价格无支付密钥时不可购买，但足以作为分区的数据来源。

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test('账单页三分区按数据来源渲染，窄屏无横向滚动', async ({ page }) => {
  const sql = fixtureDb()
  const suffix = randomUUID()
  const subPlan = randomUUID()
  const packPlan = randomUUID()
  const features = JSON.stringify(DEFAULT_FREE_FEATURES)
  try {
    await sql`insert into plan (id, key, name, type, credits, credit_expiry_days, features, active)
      values (${subPlan}, ${`e2e-sub-${suffix}`}, 'Sections Pro', 'subscription', 1000, null, ${features}::jsonb, true),
             (${packPlan}, ${`e2e-pack-${suffix}`}, 'Sections Pack', 'credit_pack', 500, null, ${features}::jsonb, true)`
    await sql`insert into plan_price (id, plan_id, provider, provider_price_id, interval, amount, currency, active)
      values (${randomUUID()}, ${subPlan}, 'stripe', ${`e2e-sub-${suffix}`}, 'month', 1900, 'usd', true),
             (${randomUUID()}, ${packPlan}, 'stripe', ${`e2e-pack-${suffix}`}, null, 500, 'usd', true)`

    await simulateClientIp(page)
    await stubTurnstile(page)
    await register(page, `billing-sections-${suffix}@example.com`)
    const workspacePath = new URL(page.url()).pathname.replace(/\/$/, '')
    await page.goto(`${workspacePath}/billing`)

    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible()
    // 项目修正：账单页沿用项目改版（#153），不渲染模板的「订阅 / 积分余额 / 积分包」三个分区；
    // 核对同样的数据来源（当前套餐、余额与购买区），窄屏无横向滚动的断言不变
    const main = page.getByRole('main')
    await expect(main.getByText('Current plan: Free')).toBeVisible()
    await expect(main.getByText(/^Available credits: 0 ·/)).toBeVisible()
    await expect(main.getByRole('heading', { name: 'Choose a plan or credit pack' })).toBeVisible()
    // 无支付密钥：没有可用的购买入口
    await expect(main.getByText('Payments are currently unavailable.')).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(main.getByText('Current plan: Free')).toBeVisible()
    await expectNoHorizontalScroll(page)

    await page.goto('/pricing')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalScroll(page)
  } finally {
    await sql`delete from plan_price where plan_id in (${subPlan}, ${packPlan})`
    await sql`delete from plan where id in (${subPlan}, ${packPlan})`
    await sql.end()
  }
})
