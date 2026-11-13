import { createAuth } from '@xuanxue/auth'
import { defineTemplateConfig } from '@xuanxue/config'
import { reading } from '@xuanxue/db'
import { AppError, newId } from '@xuanxue/shared'
import { afterAll, describe, expect, it } from 'vitest'
import {
  loadSubjectChat,
  startSubjectConversation,
} from '../src/features/ai/subject-chat.server.ts'
import { resolveConversationSubject } from '../src/features/ai/subjects.ts'
import { followUpQuestions } from '../src/features/readings/follow-up-questions.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// adopt-subject-chat-readings tasks.md 2.2：`reading` 对象只对本人、本空间、已就绪的报告可解析；
// 报告对话的首条 system 消息带 reading-v1 固定头与报告正文，不含出生输入。
// subject-chat.server.ts 副作用导入 subject-providers.ts，即生产中的注册方式。

const APP_URL = 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery-staple'
const SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const EMAIL_DOMAIN = `${newId()}.web-readings-subjects-test.example`
const REPORT_BODY = `## 命盤總覽\n\nREPORT-BODY-${newId()} 日主庚金，身強。`
const BIRTH = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 17,
  time: { hour: 8, minute: 30 },
  gender: 'female',
  location: { city: 'taipei' },
  name: 'Alice Wang',
} as const

const db = createAdminTestDb()
const sql = db.$client
const auth = createAuth({ BETTER_AUTH_SECRET: SECRET, APP_URL }, db, {
  site: 'east',
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
type Member = Awaited<ReturnType<typeof member>>

const ctxOf = (who: Member, locale = 'en') => ({
  db,
  workspaceId: who.workspaceId,
  userId: who.userId,
  locale,
})

async function report(owner: Member, status: 'ready' | 'generating' | 'failed' = 'ready') {
  const [row] = await db
    .insert(reading)
    .values({
      workspaceId: owner.workspaceId,
      userId: owner.userId,
      kind: 'bazi-full',
      inputHash: newId(),
      input: BIRTH,
      locale: 'zh-Hant',
      engineVersion: 'bazi@test',
      promptVersion: 'bazi-full.v2',
      modelKey: 'reading-model',
      credits: 0,
      status,
      content: status === 'ready' ? REPORT_BODY : '',
    })
    .returning({ id: reading.id })
  if (!row) throw new Error('reading insert failed')
  return row.id
}

async function expect404(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(AppError)
  expect((error as AppError).status).toBe(404)
}

afterAll(async () => {
  const ids = sql`select id from "user" where email like ${`%@${EMAIL_DOMAIN}`}`
  await sql`delete from ai_message where workspace_id in (${ids})`
  await sql`delete from ai_conversation where workspace_id in (${ids})`
  await sql`delete from reading where workspace_id in (${ids})`
  await sql`delete from session where user_id in (${ids})`
  await sql`delete from account where user_id in (${ids})`
  await sql`delete from member where user_id in (${ids})`
  await sql`delete from organization where id in (${ids})`
  await sql`delete from "user" where id in (${ids})`
})

describe('reading 对话对象', () => {
  it('只解析本人、本空间、已就绪的报告；其余一律 null', async () => {
    const owner = await member('owner')
    const other = await member('other')
    const ready = await report(owner)
    const resolved = await resolveConversationSubject(ctxOf(owner), 'reading', ready)
    expect(resolved).toMatchObject({
      title: '完整命盤分析',
      defaultModelKey: 'reading-model',
      // 推荐问题跟随报告语言，不跟随界面语言
      suggestions: followUpQuestions('bazi-full', 'zh-Hant'),
    })

    // 他人
    expect(await resolveConversationSubject(ctxOf(other), 'reading', ready)).toBeNull()
    // 他人报告放在自己的空间参数下（空间对、用户不对）
    expect(
      await resolveConversationSubject(
        { ...ctxOf(other), workspaceId: owner.workspaceId },
        'reading',
        ready,
      ),
    ).toBeNull()
    // 同一用户、另一空间
    expect(
      await resolveConversationSubject(
        { ...ctxOf(owner), workspaceId: other.workspaceId },
        'reading',
        ready,
      ),
    ).toBeNull()
    expect(
      await resolveConversationSubject(ctxOf(owner), 'reading', await report(owner, 'generating')),
    ).toBeNull()
    expect(
      await resolveConversationSubject(ctxOf(owner), 'reading', await report(owner, 'failed')),
    ).toBeNull()
    expect(await resolveConversationSubject(ctxOf(owner), 'reading', newId())).toBeNull()
    expect(await resolveConversationSubject(ctxOf(owner), 'reading', 'not-a-uuid')).toBeNull()
    // chart-result 只经临时令牌使用
    expect(await resolveConversationSubject(ctxOf(owner), 'chart-result', ready)).toBeNull()

    await expect404(startSubjectConversation(ctxOf(other), { type: 'reading', id: ready }))
    await expect404(loadSubjectChat(ctxOf(other), { type: 'reading', id: ready }))
  })

  it('新建对话写入 reading-v1 上下文：含报告正文与复算命盘，不含出生输入', async () => {
    const owner = await member('writer')
    const id = await report(owner)
    const created = await startSubjectConversation(ctxOf(owner), { type: 'reading', id })
    const [conversation] = await sql<{ subject_type: string; title: string; model_key: string }[]>`
      select subject_type, title, model_key from ai_conversation where id = ${created.id}`
    expect(conversation).toEqual({
      subject_type: 'reading',
      title: '完整命盤分析',
      model_key: 'reading-model',
    })
    const [system] = await sql<{ parts: { type: string; text?: string }[] }[]>`
      select parts from ai_message where conversation_id = ${created.id} and role = 'system'`
    const text = system?.parts[0]?.text ?? ''
    expect(text.startsWith('[context type=reading version=reading-v1]')).toBe(true)
    expect(text).toContain(REPORT_BODY)
    expect(text).toContain('"pillars"')
    expect(text).toContain('"engineVersion":"bazi@test"')
    for (const leaked of ['Alice', 'taipei', '1990-05-17', '"day":17', '"calendar"', '"location"'])
      expect(text, leaked).not.toContain(leaked)

    const chat = await loadSubjectChat(ctxOf(owner, 'zh-Hant'), { type: 'reading', id })
    expect(chat.conversation?.id).toBe(created.id)
    expect(chat.subject.label).toBe('報告')
  })
})
