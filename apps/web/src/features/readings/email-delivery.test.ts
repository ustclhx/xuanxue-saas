import { describe, expect, it } from 'vitest'
import { readingEmailDelivery } from './generate.ts'

// product-improve-ai-content tasks.md 2.5：只有邮件交给真实发信通道且用户有已验证邮箱时才算 queued
describe('报告邮件提示的真实性', () => {
  const base = {
    transport: 'resend',
    queueAvailable: true,
    email: 'reader@example.test',
    emailVerified: true,
  } as const

  it('log 通道（含未设置）：不提邮件', () => {
    expect(readingEmailDelivery({ ...base, transport: 'log' })).toBe('none')
    expect(readingEmailDelivery({ ...base, transport: undefined })).toBe('none')
  })

  it('没有可用邮箱（为空或未验证）或邮件队列不可用：不提邮件', () => {
    expect(readingEmailDelivery({ ...base, email: '' })).toBe('none')
    expect(readingEmailDelivery({ ...base, email: null })).toBe('none')
    expect(readingEmailDelivery({ ...base, emailVerified: false })).toBe('none')
    expect(readingEmailDelivery({ ...base, queueAvailable: false })).toBe('none')
  })

  it('真实发信通道且邮箱已验证：queued', () => {
    expect(readingEmailDelivery(base)).toBe('queued')
  })
})
