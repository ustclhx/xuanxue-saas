import { createAuth } from '@xuanxue/auth'
import { defineTemplateConfig } from '@xuanxue/config'
import { grant } from '@xuanxue/credits'
import { aiConversation, aiMessage, type JsonValue, reading, scoped } from '@xuanxue/db'
import type { KeyValueStore } from '@xuanxue/platform'
import { AppError, newId } from '@xuanxue/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { chatCostContext } from '../src/features/ai/chat-cost.server.ts'
import {
  startSubjectConversation,
  startTemporarySubjectConversation,
} from '../src/features/ai/subject-chat.server.ts'
import {
  issueSubjectContext,
  SUBJECT_CONTEXT_TTL_MS,
  subjectSystemParts,
  subjectSystemText,
} from '../src/features/ai/subject-context.ts'
import { registerConversationSubject } from '../src/features/ai/subjects.ts'
import { westDayFacts, westFacts, westPersonalFacts } from '../src/features/daily/facts.ts'
import { dailyContext } from '../src/features/daily/subject.ts'
import { readingDefinition } from '../src/features/readings/catalog.ts'
import { chartResultContext } from '../src/features/readings/subjects.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// adopt-subject-chat-readings tasks.md 3.1：对话输入区的余额与固定前缀长度；
// 首发按实际对象上下文估算，已有对话返回首条 system 消息文本长度，他人对象与对话 404。

const APP_URL = 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery-staple'
const SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const EMAIL_DOMAIN = `${newId()}.web-chat-cost-test.example`
const BIRTH = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 17,
  time: { hour: 8, minute: 30 },
  gender: 'female',
  location: { city: 'taipei' },
} as const

function memoryCache(): KeyValueStore {
  const values = new Map<string, string>()
  return {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => {
      values.set(key, value)
    },
    delete: async (key: string) => {
      values.delete(key)
    },
  } as KeyValueStore
}

const db = createAdminTestDb()
const sql = db.$client
const auth = createAuth({ BETTER_AUTH_SECRET: SECRET, APP_URL }, db, {
  site: 'west',
  config: defineTemplateConfig({
    app: { name: 'TestApp', url: APP_URL, supportEmail: 'support@example.test' },
    auth: { oauth: [], turnstile: false },
  }),
  sendEmail: async () => {},
})

const post = (path: string, body: unknown) =>
  auth.handler(
    new Request(`${APP_URL}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP_URL },
      body: JSON.stringify(body),
    }),
  )

async function member(name: string, credits = 0) {
  const email = `${name}-${newId()}@${EMAIL_DOMAIN}`
  expect((await post('/sign-up/email', { email, password: PASSWORD, name })).status).toBe(200)
  const res = await post('/sign-in/email', { email, password: PASSWORD })
  const { user } = (await res.json()) as { user: { id: string } }
  if (credits > 0)
    await grant(db, { workspaceId: user.id, source: 'admin', sourceRef: newId(), amount: credits })
  return { userId: user.id, workspaceId: user.id }
}
type Member = Awaited<ReturnType<typeof member>>

async function conversation(owner: Member, systemParts?: unknown[]) {
  const s = scoped(db, owner.workspaceId)
  const [row] = await s
    .insert(aiConversation, { userId: owner.userId, title: '', modelKey: '' })
    .returning({ id: aiConversation.id })
  if (!row) throw new Error('conversation insert failed')
  if (systemParts)
    await s.insert(aiMessage, { conversationId: row.id, role: 'system', parts: systemParts })
  await s.insert(aiMessage, {
    conversationId: row.id,
    role: 'user',
    parts: [{ type: 'text', text: 'not part of the prefix' }],
  })
  return row.id
}

afterAll(async () => {
  const ids = sql`select id from "user" where email like ${`%@${EMAIL_DOMAIN}`}`
  await sql`delete from ai_message where workspace_id in (${ids})`
  await sql`delete from ai_conversation where workspace_id in (${ids})`
  await sql`delete from reading where workspace_id in (${ids})`
  await sql`delete from credit_ledger where workspace_id in (${ids})`
  await sql`delete from credit_grant where workspace_id in (${ids})`
  await sql`delete from session where user_id in (${ids})`
  await sql`delete from account where user_id in (${ids})`
  await sql`delete from member where user_id in (${ids})`
  await sql`delete from organization where id in (${ids})`
  await sql`delete from "user" where id in (${ids})`
})

describe('chatCostContext', () => {
  it('返回可用余额与首条 system 消息的文本长度（按码点），他人对话 404', async () => {
    const owner = await member('owner', 120)
    const other = await member('other')
    const ctx = { workspaceId: owner.workspaceId, userId: owner.userId }

    expect(await chatCostContext(db, ctx)).toEqual({
      availableCredits: 120,
      prefixChars: 0,
      minOutputTokens: 256,
    })

    const plain = await conversation(owner)
    expect((await chatCostContext(db, { ...ctx, conversationId: plain })).prefixChars).toBe(0)

    // 旧带盘对话：文本片段 + data-chat-context 数据片段，只计文本
    const legacyText = '命盤 context 😀'
    const legacy = await conversation(owner, [
      { type: 'text', text: legacyText },
      { type: 'data-chat-context', data: { kind: 'bazi-full', result: { long: 'x'.repeat(500) } } },
    ])
    expect((await chatCostContext(db, { ...ctx, conversationId: legacy })).prefixChars).toBe(
      [...legacyText].length,
    )

    const parts = subjectSystemParts('reading', { version: 'reading-v1', text: 'REPORT BODY' })
    const subject = await conversation(owner, parts)
    const subjectText = (parts[0] as { text: string }).text
    expect(await chatCostContext(db, { ...ctx, conversationId: subject })).toEqual({
      availableCredits: 120,
      prefixChars: subjectText.length,
      minOutputTokens: 256,
    })

    const error = await chatCostContext(db, {
      workspaceId: other.workspaceId,
      userId: other.userId,
      conversationId: subject,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).status).toBe(404)
    // 同空间参数下的他人用户同样 404
    await expect(
      chatCostContext(db, {
        workspaceId: owner.workspaceId,
        userId: other.userId,
        conversationId: subject,
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('首次报告估算包含 4232 字正文与真实复算命盘，等于新建后的固定前缀', async () => {
    const owner = await member('reading-owner', 20)
    const other = await member('reading-other')
    const body = `${'报告😀'.repeat(1410)}结论`
    expect([...body]).toHaveLength(4232)
    const [report] = await scoped(db, owner.workspaceId)
      .insert(reading, {
        userId: owner.userId,
        kind: 'bazi-full',
        inputHash: newId(),
        input: BIRTH,
        locale: 'zh-Hant',
        engineVersion: 'bazi@test',
        promptVersion: 'bazi-full.v2',
        modelKey: 'reading-model',
        credits: 0,
        status: 'ready',
        content: body,
      })
      .returning({ id: reading.id })
    if (!report) throw new Error('reading insert failed')
    const subject = { type: 'reading', id: report.id }
    const initial = await chatCostContext(db, { ...owner, subject })
    const created = await startSubjectConversation({ db, ...owner, locale: 'en' }, subject)
    const persisted = await chatCostContext(db, { ...owner, conversationId: created.id })
    expect(initial).toEqual(persisted)
    const [system] = await sql<{ parts: { text?: string }[] }[]>`
      select parts from ai_message where conversation_id = ${created.id} and role = 'system'`
    const text = system?.parts[0]?.text ?? ''
    expect(text).toContain(body)
    expect(text).toContain('"pillars"')
    expect(initial.prefixChars).toBe([...text].length)
    expect(initial.prefixChars).toBeGreaterThan(4232)
    for (const input of [
      { ...other, subject },
      { ...owner, userId: other.userId, subject },
      { ...owner, workspaceId: other.workspaceId, subject },
    ])
      await expect(chatCostContext(db, input)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      })
  })

  it('chart-result 与 daily 令牌首发估算等于创建后前缀，拒绝他人、跨空间、过期和无效令牌', async () => {
    const owner = await member('temporary-owner')
    const other = await member('temporary-other')
    const now = Date.now()
    const deps = { secret: SECRET, cache: memoryCache(), now }
    const definition = readingDefinition('bazi-full', 'zh-Hant')
    if (!definition) throw new Error('missing bazi definition')
    const chart = JSON.parse(
      JSON.stringify(definition.recompute(BIRTH, new Date(now)).result),
    ) as JsonValue
    const date = { year: 2026, month: 11, day: 16 }
    const contexts = [
      { type: 'chart-result', context: chartResultContext('bazi-full', chart) },
      {
        type: 'daily',
        context: dailyContext(
          westFacts(westDayFacts(date), westPersonalFacts({ year: 1990, month: 5, day: 17 }, date)),
        ),
      },
    ]
    for (const { type, context } of contexts) {
      const { token } = await issueSubjectContext(deps, {
        ...owner,
        subjectType: type,
        context,
        returnTo: '/app',
      })
      const initial = await chatCostContext(db, { ...owner, token }, deps)
      expect(initial.prefixChars).toBe([...subjectSystemText(type, context)].length)
      const created = await startTemporarySubjectConversation(
        { db, ...owner, locale: 'en' },
        deps,
        token,
      )
      if (created.status !== 'ok') throw new Error('temporary conversation not created')
      expect(await chatCostContext(db, { ...owner, conversationId: created.id })).toEqual(initial)
      const expired = { ...deps, now: now + SUBJECT_CONTEXT_TTL_MS }
      for (const [input, contextDeps] of [
        [{ ...other, token }, deps],
        [{ ...owner, userId: other.userId, token }, deps],
        [{ ...owner, workspaceId: other.workspaceId, token }, deps],
        [{ ...owner, token }, expired],
        [{ ...owner, token: 'invalid' }, deps],
      ] as const) {
        await expect(chatCostContext(db, input, contextDeps)).rejects.toMatchObject({
          code: 'NOT_FOUND',
          message: 'Not found',
          status: 404,
        })
      }
      // 对话存在时完全使用持久前缀，既不重新鉴权对象，也不再要求令牌有效或可取 KV。
      expect(
        await chatCostContext(
          db,
          {
            ...owner,
            conversationId: created.id,
            token,
          },
          expired,
        ),
      ).toEqual(initial)
      expect(
        await chatCostContext(db, {
          ...owner,
          conversationId: created.id,
          token: 'invalid',
          subject: { type: 'missing', id: 'gone' },
        }),
      ).toEqual(initial)
    }
  })

  it('首发对象执行与新建对话相同的上下文校验，并拒绝对象与令牌并传', async () => {
    const owner = await member('invalid-context')
    const unregister = registerConversationSubject('invalid-cost-context', {
      label: () => 'Invalid context',
      resolve: async () => ({ context: async () => ({ version: 'v1' }) }),
    })
    try {
      await expect(
        chatCostContext(db, {
          ...owner,
          subject: { type: 'invalid-cost-context', id: 'id' },
        }),
      ).rejects.toMatchObject({ code: 'INVALID_SUBJECT_CONTEXT', status: 422 })
      await expect(
        chatCostContext(db, {
          ...owner,
          subject: { type: 'reading', id: newId() },
          token: 'invalid',
        }),
      ).rejects.toMatchObject({ status: 400 })
    } finally {
      unregister()
    }
  })
})
