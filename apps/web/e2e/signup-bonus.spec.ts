import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import templateConfig from '../../../template.config.ts'
import { APP_URL, emailLink, fixtureDb, register, simulateClientIp } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

test('signup credits require email verification and repeat claims grant only once', async ({
  page,
}) => {
  test.skip(
    templateConfig.auth.requireEmailVerification,
    'This flow begins with an unverified session',
  )
  // 衍生项目可把注册赠送设为 0：此时账户页没有领取入口，用例不适用。
  test.skip(
    templateConfig.billing.signupBonusCredits === 0,
    'billing.signupBonusCredits 为 0，无注册赠送',
  )
  const email = `signup-${randomUUID()}@example.com`
  const sql = fixtureDb()
  try {
    await simulateClientIp(page)
    await stubTurnstile(page)
    await register(page, email)
    const [account] = await sql`select id from "user" where email=${email}`
    if (!account) throw new Error('Missing registered fixture')
    await page.goto('/account')
    await expect(
      page.getByRole('button', {
        name: `Verify email to claim ${templateConfig.billing.signupBonusCredits} credits`,
      }),
    ).toBeVisible()
    expect(
      await sql`select id from credit_grant where workspace_id=${account.id} and source='signup'`,
    ).toHaveLength(0)
    await page
      .getByRole('button', {
        name: `Verify email to claim ${templateConfig.billing.signupBonusCredits} credits`,
      })
      .click()
    await expect(
      page.getByText('Verification email sent. Your credits will be added after verification.'),
    ).toBeVisible()
    await page.goto(await emailLink(email))
    await expect(page).toHaveURL(/\/account\/?$/)
    await expect(
      page.getByRole('button', { name: 'Claim signup credits', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Claim signup credits', exact: true }).click()
    await expect(
      page.getByText('This email has already received its signup credits.'),
    ).toBeVisible()
    const grants =
      await sql`select amount from credit_grant where workspace_id=${account.id} and source='signup'`
    expect(grants).toEqual([{ amount: templateConfig.billing.signupBonusCredits }])
    // 2026-11-18「版本 B」：验证时一并领取当天每日积分，新用户首日合计 20（注册 15 + 每日 5），进入 App 区不重复发放
    if (templateConfig.credits.dailyEnabled) {
      await page.goto('/app')
      await expect(page).toHaveURL(APP_URL)
      await expect
        .poll(
          async () =>
            (
              await sql`select coalesce(sum(amount), 0)::int as total from credit_grant
                where workspace_id=${account.id} and source in ('signup', 'daily')`
            )[0]?.total,
        )
        .toBe(20)
    }
  } finally {
    await sql.end()
  }
})
