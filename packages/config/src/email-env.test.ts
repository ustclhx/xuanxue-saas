import { describe, expect, it } from 'vitest'
import { emailTransportConfig, withEmailEnv } from './email-env.ts'
import { EnvValidationError, envSchema, loadEnv } from './env.ts'

const schema = withEmailEnv(envSchema)
const HYPERDRIVE = { connectionString: 'postgres://app:app@localhost:5432/app' }

describe('withEmailEnv', () => {
  it('默认使用 log 通道，不要求 Resend 变量', () => {
    const env = loadEnv({ HYPERDRIVE }, schema)
    expect(env.EMAIL_TRANSPORT).toBe('log')
    expect(env.HYPERDRIVE).toBe(HYPERDRIVE)
    expect(emailTransportConfig(env)).toEqual({ transport: 'log' })
  })

  it('resend 通道要求 RESEND_API_KEY，错误只含变量名', () => {
    let error: unknown
    try {
      loadEnv({ HYPERDRIVE, EMAIL_TRANSPORT: 'resend' }, schema)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(EnvValidationError)
    expect((error as EnvValidationError).missing).toEqual(['RESEND_API_KEY'])
    expect((error as Error).message).not.toContain('re_')
  })

  it('resend 通道变量齐全时返回发送配置', () => {
    const env = loadEnv(
      { HYPERDRIVE, EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_test_key' },
      schema,
    )
    expect(emailTransportConfig(env)).toEqual({ transport: 'resend', apiKey: 're_test_key' })
  })

  it('未知通道视为非法取值', () => {
    expect(() => loadEnv({ HYPERDRIVE, EMAIL_TRANSPORT: 'smtp' }, schema)).toThrow(
      'Invalid environment: invalid EMAIL_TRANSPORT',
    )
  })
})
