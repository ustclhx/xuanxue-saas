import { createAuth } from '@xuanxue/auth'
import { defineTemplateConfig } from '@xuanxue/config'
import type { KeyValueStore } from '@xuanxue/platform'
import { newId } from '@xuanxue/shared'
import { afterAll, describe, expect, it } from 'vitest'
import {
  CHAT_CONTEXT_TTL_MS,
  LEGACY_KV_PREFIX,
  LEGACY_SCOPE,
  upgradeLegacyChatContext,
} from '../src/features/ai/legacy-chat-context.ts'
import {
  loadTemporarySubjectChat,
  startTemporarySubjectConversation,
  subjectLabels,
} from '../src/features/ai/subject-chat.server.ts'
import { signHmacToken } from '../src/features/growth/tokens.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// adopt-subject-chat-readings tasks.md 4.2：发布前签发的旧链接换发为 chart-result 临时上下文，
// 新令牌可建对话（首条 system 消息带 chart-result-v1 固定头、列表显示「结果」）；过期返回原页、他人无效。

const APP_URL = 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery-staple'
const SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const EMAIL_DOMAIN = `${newId()}.web-legacy-chat-context-test.example`
const RESULT = {
  lifePath: { value: 11, master: true },
  personalYear: { value: 4, master: false },
  currentYear: 2026,
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

async function member(name: string) {
  const email = `${name}-${newId()}@${EMAIL_DOMAIN}`
  expect((await post('/sign-up/email', { email, password: PASSWORD, name })).status).toBe(200)
  const res = await post('/sign-in/email', { email, password: PASSWORD })
  const { user } = (await res.json()) as { user: { id: string } }
  return { userId: user.id, workspaceId: user.id }
}

function memoryKv() {
  const data = new Map<string, string>()
  return {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => {
      data.set(key, value)
    },
    delete: async (key: string) => {
      data.delete(key)
    },
  } as KeyValueStore
}

/** 发布前 issueChatContext 的写法（签发代码已删除，只在测试中复现） */
async function legacyToken(cache: KeyValueStore, userId: string, now: number) {
  const id = crypto.randomUUID()
  await cache.put(
    `${LEGACY_KV_PREFIX}${id}`,
    JSON.stringify({ kind: 'numerology-full', result: RESULT }),
  )
  return signHmacToken(SECRET, LEGACY_SCOPE, {
    v: 1,
    id,
    uid: userId,
    kind: 'numerology-full',
    returnTo: '/numerology',
    exp: now + CHAT_CONTEXT_TTL_MS,
  })
}

afterAll(async () => {
  const ids = sql`select id from "user" where email like ${`%@${EMAIL_DOMAIN}`}`
  await sql`delete from ai_message where workspace_id in (${ids})`
  await sql`delete from ai_conversation where workspace_id in (${ids})`
  await sql`delete from session where user_id in (${ids})`
  await sql`delete from account where user_id in (${ids})`
  await sql`delete from member where user_id in (${ids})`
  await sql`delete from organization where id in (${ids})`
  await sql`delete from "user" where id in (${ids})`
})

describe('旧链接换发', () => {
  it('有效旧令牌换发后可凭新令牌建对话；过期返回原页；他人无效', async () => {
    const owner = await member('owner')
    const other = await member('other')
    const cache = memoryKv()
    const now = Date.now()
    const token = await legacyToken(cache, owner.userId, now)
    const ctx = { db, workspaceId: owner.workspaceId, userId: owner.userId, locale: 'en' }
    const deps = { secret: SECRET, cache }

    const upgraded = await upgradeLegacyChatContext(deps, { ...ctx, token })
    if (upgraded.status !== 'ok') throw new Error(upgraded.status)
    const page = await loadTemporarySubjectChat(ctx, deps, upgraded.token)
    expect(page).toMatchObject({
      status: 'ok',
      returnTo: '/numerology',
      subject: {
        type: 'chart-result',
        label: 'Result',
        title: 'Your full numerology reading · 11 · 4',
      },
    })
    const created = await startTemporarySubjectConversation(ctx, deps, upgraded.token)
    if (created.status !== 'ok') throw new Error(created.status)
    const [system] = await sql<{ parts: { type: string; text?: string }[] }[]>`
      select parts from ai_message where conversation_id = ${created.id} and role = 'system'`
    expect(system?.parts[0]?.text).toMatch(/^\[context type=chart-result version=chart-result-v1\]/)
    expect(system?.parts[0]?.text).toContain('"lifePath":{"value":11')
    const [row] = await sql<{ subject_type: string }[]>`
      select subject_type from ai_conversation where id = ${created.id}`
    expect(subjectLabels('en')({ subjectType: row?.subject_type ?? null })).toMatchObject({
      subjectLabel: 'Result',
    })

    expect(
      await upgradeLegacyChatContext(
        { ...deps, now: now + CHAT_CONTEXT_TTL_MS },
        { ...ctx, token },
      ),
    ).toEqual({ status: 'expired', returnTo: '/numerology' })
    expect(
      await upgradeLegacyChatContext(deps, {
        userId: other.userId,
        workspaceId: other.workspaceId,
        token,
        locale: 'en',
      }),
    ).toEqual({ status: 'invalid' })
  })
})
