import { createAuth } from '@xuanxue/auth'
import { defineTemplateConfig } from '@xuanxue/config'
import { grant } from '@xuanxue/credits'
import { aiConversation, aiMessage, scoped } from '@xuanxue/db'
import { AppError, newId } from '@xuanxue/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { chatCostContext } from '../src/features/ai/chat-cost.server.ts'
import { subjectSystemParts } from '../src/features/ai/subject-context.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// adopt-subject-chat-readings tasks.md 3.1：对话输入区的余额与固定前缀长度；
// 无对话为 0，旧带盘对话与对象对话返回首条 system 消息文本长度，他人对话 404。

const APP_URL = 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery-staple'
const SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const EMAIL_DOMAIN = `${newId()}.web-chat-cost-test.example`

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

    expect(await chatCostContext(db, ctx)).toEqual({ availableCredits: 120, prefixChars: 0 })

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
})
