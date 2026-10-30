import type { KeyValueStore } from '@xuanxue/platform'
import { describe, expect, it } from 'vitest'
import {
  CHAT_CONTEXT_TTL_MS,
  type ChatContext,
  contextFromParts,
  contextMessageParts,
  contextSystemText,
  issueChatContext,
  openChatContext,
} from './chat-context.ts'

/** 内存 KV：记录 TTL，便于断言 30 分钟过期 */
function memoryKv() {
  const data = new Map<string, string>()
  const ttls = new Map<string, number | undefined>()
  const kv = {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      data.set(key, value)
      ttls.set(key, options?.expirationTtl)
    },
    delete: async (key: string) => {
      data.delete(key)
    },
  } as KeyValueStore
  return { kv, data, ttls }
}

const SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const NOW = Date.UTC(2026, 9, 30, 12)
const context: ChatContext = {
  kind: 'bazi-full',
  result: {
    pillars: { year: { stem: 'jia', branch: 'zi' }, day: { stem: 'wu', branch: 'chen' } },
    dayMaster: 'wu',
  },
}

async function issued() {
  const store = memoryKv()
  const token = await issueChatContext(
    { secret: SECRET, cache: store.kv, now: NOW },
    { userId: 'user-a', context, returnTo: '/zh-hant/bazi' },
  )
  return { ...store, token }
}

describe('chat context token', () => {
  it('签发：结果存入 KV 并按 30 分钟过期，令牌不含出生信息与结果正文', async () => {
    const { token, ttls, data } = await issued()
    expect([...ttls.values()]).toEqual([CHAT_CONTEXT_TTL_MS / 1000])
    expect(JSON.parse([...data.values()][0] ?? '')).toEqual(context)
    const body = JSON.parse(atob((token.split('.')[0] ?? '').replace(/-/g, '+').replace(/_/g, '/')))
    expect(Object.keys(body).sort()).toEqual(['exp', 'id', 'kind', 'returnTo', 'uid', 'v'])
    expect(token).not.toContain('jia')
    const opened = await openChatContext(
      { secret: SECRET, cache: memoryKv().kv, now: NOW },
      { userId: 'user-a', token },
    )
    // 换一个 KV（结果不存在）视为已过期
    expect(opened).toEqual({ status: 'expired', returnTo: '/zh-hant/bazi' })
  })

  it('本人在有效期内取回复算结果', async () => {
    const { kv, token } = await issued()
    const opened = await openChatContext(
      { secret: SECRET, cache: kv, now: NOW + CHAT_CONTEXT_TTL_MS - 1 },
      { userId: 'user-a', token },
    )
    expect(opened).toEqual({ status: 'ok', context, returnTo: '/zh-hant/bazi' })
  })

  it('他人使用被拒', async () => {
    const { kv, token } = await issued()
    expect(
      await openChatContext({ secret: SECRET, cache: kv, now: NOW }, { userId: 'user-b', token }),
    ).toEqual({ status: 'invalid' })
  })

  it('过期被拒，并给出结果页路径', async () => {
    const { kv, token } = await issued()
    expect(
      await openChatContext(
        { secret: SECRET, cache: kv, now: NOW + CHAT_CONTEXT_TTL_MS },
        { userId: 'user-a', token },
      ),
    ).toEqual({ status: 'expired', returnTo: '/zh-hant/bazi' })
  })

  it('篡改或换密钥的令牌被拒', async () => {
    const { kv, token } = await issued()
    const [body, signature] = token.split('.')
    const forged = `${body?.slice(0, -2)}AA.${signature}`
    expect(
      await openChatContext(
        { secret: SECRET, cache: kv, now: NOW },
        { userId: 'user-a', token: forged },
      ),
    ).toEqual({ status: 'invalid' })
    expect(
      await openChatContext(
        { secret: `${SECRET}-other`, cache: kv, now: NOW },
        { userId: 'user-a', token },
      ),
    ).toEqual({ status: 'invalid' })
  })
})

describe('chat context message', () => {
  it('system 文本附带结构化结果，parts 可还原上下文', () => {
    const text = contextSystemText(context)
    expect(text).toContain(JSON.stringify(context))
    expect(text).toMatch(/do not predict specific events/)
    const parts = contextMessageParts(context)
    expect(contextFromParts(parts)).toEqual(context)
    expect(contextFromParts([{ type: 'text', text: 'hi' }])).toBeNull()
  })
})
