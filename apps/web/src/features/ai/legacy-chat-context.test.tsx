import type { KeyValueStore } from '@xuanxue/platform'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { signHmacToken } from '../growth/tokens.ts'
import { ChatContextSummary } from './chat-context-summary-card.tsx'
import {
  CHAT_CONTEXT_PART,
  CHAT_CONTEXT_TTL_MS,
  type ChatContext,
  contextFromParts,
  LEGACY_KV_PREFIX,
  LEGACY_SCOPE,
  openChatContext,
  upgradeLegacyChatContext,
} from './legacy-chat-context.ts'
import { openSubjectContext, subjectSystemParts } from './subject-context.ts'

// adopt-subject-chat-readings tasks.md 4.2、4.3：旧链接只读验签与换发；旧对话摘要只对旧片段显示。

/** 内存 KV */
function memoryKv() {
  const data = new Map<string, string>()
  const kv = {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => {
      data.set(key, value)
    },
    delete: async (key: string) => {
      data.delete(key)
    },
  } as KeyValueStore
  return { kv, data }
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

/** 按发布前的 issueChatContext 写法生成旧令牌（签发代码已删除，只在测试中复现） */
async function legacyIssued(userId = 'user-a') {
  const store = memoryKv()
  const id = crypto.randomUUID()
  await store.kv.put(`${LEGACY_KV_PREFIX}${id}`, JSON.stringify(context))
  const token = await signHmacToken(SECRET, LEGACY_SCOPE, {
    v: 1,
    id,
    uid: userId,
    kind: context.kind,
    returnTo: '/zh-hant/bazi',
    exp: NOW + CHAT_CONTEXT_TTL_MS,
  })
  return { ...store, token }
}

describe('openChatContext（旧令牌，只读）', () => {
  it('本人在有效期内取回；他人、过期、篡改与换密钥被拒', async () => {
    const { kv, token } = await legacyIssued()
    const deps = { secret: SECRET, cache: kv, now: NOW + CHAT_CONTEXT_TTL_MS - 1 }
    expect(await openChatContext(deps, { userId: 'user-a', token })).toEqual({
      status: 'ok',
      context,
      returnTo: '/zh-hant/bazi',
    })
    expect(await openChatContext(deps, { userId: 'user-b', token })).toEqual({ status: 'invalid' })
    expect(
      await openChatContext(
        { ...deps, now: NOW + CHAT_CONTEXT_TTL_MS },
        { userId: 'user-a', token },
      ),
    ).toEqual({ status: 'expired', returnTo: '/zh-hant/bazi' })
    // 换一个 KV（结果不存在）视为已过期
    expect(
      await openChatContext({ ...deps, cache: memoryKv().kv }, { userId: 'user-a', token }),
    ).toEqual({ status: 'expired', returnTo: '/zh-hant/bazi' })
    const [body, signature] = token.split('.')
    expect(
      await openChatContext(deps, {
        userId: 'user-a',
        token: `${body?.slice(0, -2)}AA.${signature}`,
      }),
    ).toEqual({ status: 'invalid' })
    expect(
      await openChatContext({ ...deps, secret: `${SECRET}-other` }, { userId: 'user-a', token }),
    ).toEqual({ status: 'invalid' })
  })
})

describe('upgradeLegacyChatContext', () => {
  it('有效旧令牌换发绑定用户与当前空间的 chart-result 令牌，上下文与标题来自旧结果', async () => {
    const { kv, token } = await legacyIssued()
    const deps = { secret: SECRET, cache: kv, now: NOW }
    const upgraded = await upgradeLegacyChatContext(deps, {
      userId: 'user-a',
      workspaceId: 'ws-a',
      token,
      locale: 'zh-Hant',
    })
    if (upgraded.status !== 'ok') throw new Error(upgraded.status)
    const opened = await openSubjectContext(deps, {
      userId: 'user-a',
      workspaceId: 'ws-a',
      token: upgraded.token,
    })
    if (opened.status !== 'ok') throw new Error(opened.status)
    expect(opened.subjectType).toBe('chart-result')
    expect(opened.returnTo).toBe('/zh-hant/bazi')
    expect(opened.stored.context).toMatchObject({
      version: 'chart-result-v1',
      data: { kind: 'bazi-full', result: context.result },
    })
    expect(opened.stored.title).toBe('完整命盤分析 · 甲子 · — · 戊辰 · —')
    expect(opened.stored.suggestions).toHaveLength(3)
    // 新令牌只能在换发时的空间使用
    expect(
      await openSubjectContext(deps, {
        userId: 'user-a',
        workspaceId: 'ws-b',
        token: upgraded.token,
      }),
    ).toEqual({ status: 'invalid' })
  })

  it('过期旧令牌给出原页；他人令牌无效', async () => {
    const { kv, token } = await legacyIssued()
    const input = { workspaceId: 'ws-a', token, locale: 'en' }
    expect(
      await upgradeLegacyChatContext(
        { secret: SECRET, cache: kv, now: NOW + CHAT_CONTEXT_TTL_MS },
        { ...input, userId: 'user-a' },
      ),
    ).toEqual({ status: 'expired', returnTo: '/zh-hant/bazi' })
    expect(
      await upgradeLegacyChatContext(
        { secret: SECRET, cache: kv, now: NOW },
        { ...input, userId: 'user-b' },
      ),
    ).toEqual({ status: 'invalid' })
  })
})

describe('旧对话摘要', () => {
  it('带 data-chat-context 的旧 system parts 显示摘要；新对象对话不显示', () => {
    const legacy = contextFromParts([
      { type: 'text', text: 'legacy prompt' },
      { type: CHAT_CONTEXT_PART, data: context },
    ])
    expect(legacy).toEqual(context)
    const html = renderToStaticMarkup(<ChatContextSummary context={legacy as ChatContext} />)
    expect(html).toContain('data-testid="chat-context-summary"')
    expect(html).toContain('甲子 · — · 戊辰 · —')

    const subject = subjectSystemParts('chart-result', {
      version: 'chart-result-v1',
      data: { kind: 'bazi-full', result: context.result },
    })
    expect(contextFromParts(subject)).toBeNull()
    expect(contextFromParts([{ type: 'text', text: 'hi' }])).toBeNull()
  })
})
