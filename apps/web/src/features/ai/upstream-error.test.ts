import { AppError } from '@xuanxue/shared'
import { APICallError } from 'ai'
import { expect, it } from 'vitest'
import { classifyUpstreamError, sanitizeErrorDetail } from './upstream-error.ts'

const apiError = (statusCode: number | undefined, data?: unknown) =>
  new APICallError({
    message: 'Authentication Fails, Your api key: sk-secret123 is invalid',
    url: 'https://api.deepseek.test/chat/completions',
    requestBodyValues: { messages: [{ role: 'user', content: 'private prompt' }] },
    ...(statusCode === undefined ? {} : { statusCode }),
    responseBody: '{"error":{"message":"sk-secret123 invalid"}}',
    data,
  })

it('classifies upstream HTTP failures without leaking bodies or keys', () => {
  const auth = classifyUpstreamError(
    apiError(401, { error: { code: 'invalid_api_key', type: 'authentication_error' } }),
  )
  expect(auth).toEqual({ category: 'auth', status: 401, detail: 'invalid_api_key' })
  expect(JSON.stringify(auth)).not.toMatch(/secret|prompt|deepseek/)
  expect(classifyUpstreamError(apiError(429))).toMatchObject({ category: 'rate_limit' })
  expect(classifyUpstreamError(apiError(503))).toMatchObject({ category: 'upstream_5xx' })
  expect(classifyUpstreamError(apiError(504))).toMatchObject({ category: 'timeout' })
  expect(classifyUpstreamError(apiError(400))).toMatchObject({ category: 'bad_request' })
  expect(classifyUpstreamError(apiError(undefined))).toMatchObject({ category: 'network' })
})

it('classifies local timeouts, empty replies and transport errors', () => {
  expect(
    classifyUpstreamError(new AppError('AI_UPSTREAM_TIMEOUT', 'idle', { status: 504 })),
  ).toEqual({ category: 'timeout', status: 504, detail: 'AI_UPSTREAM_TIMEOUT' })
  expect(classifyUpstreamError(new AppError('AI_EMPTY_REPLY', 'x', { status: 502 }))).toMatchObject(
    { category: 'empty_reply' },
  )
  expect(classifyUpstreamError(new TypeError('fetch failed'))).toEqual({
    category: 'network',
    detail: 'TypeError',
  })
  expect(classifyUpstreamError('boom')).toEqual({ category: 'unknown' })
})

it('caps and redacts key-like detail strings', () => {
  expect(sanitizeErrorDetail('bad key sk-abc_123 and whsec_xyz')).toBe(
    'bad key [redacted] and [redacted]',
  )
  expect(sanitizeErrorDetail('x'.repeat(300))).toHaveLength(120)
  expect(sanitizeErrorDetail({})).toBeUndefined()
})
