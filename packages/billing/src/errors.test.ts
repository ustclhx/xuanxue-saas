import { expect, it } from 'vitest'
import { billingErrorDiagnostics, billingErrorMessage, isRetryableBillingError } from './errors.ts'
import { money } from './events/shared.ts'

it('redacts provider SDK key diagnostics before persisting bounded errors', () => {
  const error = new Error(
    'Invalid API Key provided: sk_test_fixture123\nBearer privateToken https://provider.test/private?secret=value',
  )
  const message = billingErrorMessage(error)
  expect(message).not.toContain('fixture123')
  expect(message).not.toContain('privateToken')
  expect(message).not.toContain('provider.test')
  expect(message).not.toContain('\n')
  expect(billingErrorMessage(new Error('x'.repeat(900)))).toHaveLength(500)
})

it('treats a non-USD amount as a distinguishable non-retryable currency mismatch', () => {
  expect(() => money(1000, 'USD')).not.toThrow()
  expect(() => money(1000, 'usd')).not.toThrow()
  let caught: unknown
  try {
    money(1000, 'EUR')
  } catch (error) {
    caught = error
  }
  expect(caught).toMatchObject({ code: 'BILLING_CURRENCY_MISMATCH' })
  expect(billingErrorMessage(caught)).toContain('BILLING_CURRENCY_MISMATCH')
  expect(isRetryableBillingError(caught)).toBe(false)
  // 金额非法等其他错误仍按可重试处理，交给服务商重投
  expect(() => money(-1, 'USD')).toThrow('Invalid billing amount')
  expect(isRetryableBillingError(new Error('temporary'))).toBe(true)
})

it('extracts Stripe SDK and AppError diagnostics for logs with keys redacted', () => {
  // 形状与 Stripe SDK 的 StripePermissionError 一致，不依赖 SDK 类
  const stripe = Object.assign(
    new Error('Permission denied for key rk_live_fixture9 (Enabling Invoices Read)'),
    { type: 'StripePermissionError', statusCode: 403, code: 'secret_key_required' },
  )
  const diagnostics = billingErrorDiagnostics(stripe)
  expect(diagnostics).toMatchObject({
    errorType: 'StripePermissionError',
    statusCode: 403,
    code: 'secret_key_required',
  })
  expect(diagnostics.message).toContain('Enabling Invoices Read')
  expect(diagnostics.message).not.toContain('fixture9')
  expect(billingErrorDiagnostics(new Error('token sk-proj_abc leaked')).message).not.toContain(
    'sk-proj_abc',
  )
  const appError = Object.assign(new Error('mismatch'), {
    name: 'AppError',
    code: 'BILLING_CURRENCY_MISMATCH',
    status: 409,
  })
  expect(billingErrorDiagnostics(appError)).toMatchObject({
    errorType: 'AppError',
    statusCode: 409,
    code: 'BILLING_CURRENCY_MISMATCH',
  })
})
