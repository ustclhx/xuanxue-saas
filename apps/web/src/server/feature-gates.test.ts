import type { CreateAuthDeps } from '@xuanxue/auth'
import type { Database } from '@xuanxue/db'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  template: { billing: { enabled: false }, credits: { enabled: false, dailyEnabled: false } },
  auth: vi.fn((_env: unknown, _db: unknown, deps: CreateAuthDeps) => deps),
  grant: vi.fn(),
  daily: vi.fn(),
}))
vi.mock('./template-config.ts', () => ({ templateConfig: mocks.template }))
vi.mock('@xuanxue/auth', () => ({ createAuth: mocks.auth }))
vi.mock('@xuanxue/billing', () => ({ grantSignupBonus: mocks.grant }))
vi.mock('@xuanxue/credits', () => ({ grantDailyCredits: mocks.daily }))
// 注册赠送资格按数据库中的注册时间判断（signup-eligibility.ts），这里只验证开关
vi.mock('../features/billing/signup-eligibility.ts', () => ({
  signupBonusConfig: vi.fn(async () => ({ signupBonusCredits: 15 })),
}))
vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({ server: (handler: unknown) => handler }),
}))

import { createWebAuth } from './auth.ts'
import { requireFeature } from './feature-gates.ts'
import { resolveWorkspaceMaxSeats } from './workspace-data.ts'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.template.billing.enabled = false
  mocks.template.credits.enabled = false
  mocks.template.credits.dailyEnabled = false
})

it('resolves workspace membership seats without billing plans or seed when billing is disabled', async () => {
  const sql = {
    unsafe: vi.fn(() => {
      throw new Error('Billing tables must not be read')
    }),
  }
  await expect(resolveWorkspaceMaxSeats('workspace', sql)).resolves.toBeNull()
  expect(sql.unsafe).not.toHaveBeenCalled()
})

it('keeps authentication configured and skips default credit grants after email verification', async () => {
  const deps = createWebAuth(
    { APP_URL: 'https://example.test', BETTER_AUTH_SECRET: 'fixture' },
    {} as Database,
    { site: 'west', sendEmail: vi.fn() },
  ) as unknown as CreateAuthDeps
  expect(deps.config).toBe(mocks.template)
  await deps.onEmailVerified?.({ id: 'user', email: 'user@example.test' })
  expect(mocks.grant).not.toHaveBeenCalled()
  mocks.template.credits.enabled = true
  await deps.onEmailVerified?.({ id: 'user', email: 'user@example.test' })
  expect(mocks.grant).toHaveBeenCalledOnce()
  expect(mocks.daily).not.toHaveBeenCalled()
})

it('「版本 B」开启每日积分时，邮箱验证同时领取当天每日积分，领取失败不影响验证', async () => {
  const deps = createWebAuth(
    { APP_URL: 'https://example.test', BETTER_AUTH_SECRET: 'fixture' },
    {} as Database,
    { site: 'west', sendEmail: vi.fn() },
  ) as unknown as CreateAuthDeps
  mocks.template.credits.enabled = true
  mocks.template.credits.dailyEnabled = true
  mocks.grant.mockResolvedValue({ status: 'granted', credits: 15 })
  mocks.daily.mockRejectedValueOnce(new Error('db down'))
  await expect(deps.onEmailVerified?.({ id: 'user', email: 'user@example.test' })).resolves.toEqual(
    {
      status: 'granted',
      credits: 15,
    },
  )
  expect(mocks.daily).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user', enabled: true }),
  )
})

it('denies disabled billing and credits entrypoints with 404', () => {
  for (const feature of ['billing', 'credits'] as const) {
    expect(() => requireFeature(feature)).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND', status: 404 }),
    )
    mocks.template[feature].enabled = true
    expect(() => requireFeature(feature)).not.toThrow()
  }
})
