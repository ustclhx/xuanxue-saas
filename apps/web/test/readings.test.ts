import { createAuth } from '@xuanxue/auth'
import { defineTemplateConfig } from '@xuanxue/config'
import { getCreditBalance, grant } from '@xuanxue/credits'
import {
  aiModel,
  auditLog,
  dbSettingStore,
  READING_KINDS,
  type SettingKey,
  type SettingStore,
  setting,
  settingDefaults,
  user,
} from '@xuanxue/db'
import type { EmailQueueMessage } from '@xuanxue/email/queue'
import { newId } from '@xuanxue/shared'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { eq, inArray, like } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { runAdminAction } from '../src/features/admin/action.ts'
import {
  invalidateReadingSettings,
  READING_SETTING_KEYS,
  readingSettingsInput,
  writeReadingSettings,
} from '../src/features/admin/settings-readings.ts'
import { readingDefinition } from '../src/features/readings/catalog.ts'
import { readingConfig } from '../src/features/readings/config.ts'
import { deleteReadingWithContent } from '../src/features/readings/delete.ts'
import { workspaceContentDeletionStep } from '../src/features/readings/deletion.server.ts'
import { handleReadingRequest, type ReadingDeps } from '../src/features/readings/generate.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// add-reading-monetization tasks.md 1.2：后台修改详批设置后前台读取到新值。
// tasks.md 2.4：其余四种详批各一个成功生成的用例。
// tasks.md 2.2：POST /api/readings 的成功结算、无输出失败退回、连续点击不重复扣费；
// 模型一律为 AI SDK 的模拟模型（fake provider），不发起真实调用。

// iztro 在 vitest workers 池的 CJS 回退加载下取不到 lunar-typescript 的导出（vite dev 与构建产物正常），
// 集成测试改用固定的紫微命盘；复算本身由 catalog.test.ts 在 Node 中对照真实引擎验证。
vi.mock('@xuanxue/bazi/ziwei', () => ({
  computeZiwei: (input: { time: unknown }) =>
    input.time === null
      ? { status: 'requiresHour', engineVersion: '1.0.0' }
      : {
          status: 'ok',
          engineVersion: '1.0.0',
          used: { year: 1990, month: 5, day: 17, hour: 8, minute: 30 },
          timeIndex: 4,
          fiveElementsClass: 'fire6th',
          soulPalaceBranch: 'chou',
          bodyPalaceBranch: 'you',
          palaces: [
            {
              key: 'soul',
              stem: 'ji',
              branch: 'chou',
              isBodyPalace: false,
              majorStars: [{ star: 'ziwei', brightness: 'miao', mutagen: null }],
            },
          ],
          mutagens: [],
        },
}))

const db = createAdminTestDb()
const sql = db.$client
const APP_URL = 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery-staple'
const EMAIL_DOMAIN = `${newId()}.web-readings-test.example`
const MODEL_KEY_PREFIX = `readings-test-${newId()}-`
const BIRTH = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 17,
  time: { hour: 8, minute: 30 },
  gender: 'female',
  location: { city: 'taipei' },
}
const SECTIONS = ['總論', '性格', '事業', '財運', '感情', '健康作息提示', '未來十年大運', '建議']
const REPORT = SECTIONS.map((title) =>
  title === '財運'
    ? `## ${title}\n\n財運平穩，宜量入为出。\n\n今年可以買進台積電股票。`
    : `## ${title}\n\n${title}的內容。`,
).join('\n\n')

const auth = createAuth(
  { BETTER_AUTH_SECRET: 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz', APP_URL },
  db,
  {
    config: defineTemplateConfig({
      app: { name: 'TestApp', url: APP_URL, supportEmail: 'support@example.test' },
      auth: { oauth: [], turnstile: false },
    }),
    sendEmail: async () => {},
  },
)

async function member(credits: number) {
  const email = `reader-${newId()}@${EMAIL_DOMAIN}`
  const post = (path: string, body: unknown) =>
    auth.handler(
      new Request(`${APP_URL}/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: APP_URL },
        body: JSON.stringify(body),
      }),
    )
  const signUp = await post('/sign-up/email', { email, password: PASSWORD, name: 'Reader' })
  expect(signUp.status).toBe(200)
  const { user: created } = (await signUp.json()) as { user: { id: string } }
  const signIn = await post('/sign-in/email', { email, password: PASSWORD })
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(';')[0] ?? '')
    .join('; ')
  const [ws] = await sql<{ id: string; slug: string }[]>`
    select id, slug from organization where id = ${created.id}`
  if (!ws) throw new Error('personal workspace missing')
  if (credits > 0)
    await grant(db, { workspaceId: ws.id, source: 'admin', sourceRef: newId(), amount: credits })
  return { userId: created.id, workspaceId: ws.id, slug: ws.slug, cookie, email }
}

async function textModel() {
  const key = `${MODEL_KEY_PREFIX}${newId()}`
  await db.insert(aiModel).values({
    key,
    kind: 'text',
    provider: 'mock',
    providerModelId: 'mock-model',
    // 模型自身按 token 计费；详批以按次快照覆盖
    pricing: { mode: 'token', inputPer1k: 1, outputPer1k: 1 },
  })
  return key
}

function reportModel(text: string) {
  const chunks = text.match(/.{1,16}/gs) ?? []
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start' as const, id: 't1' },
          ...chunks.map((delta) => ({ type: 'text-delta' as const, id: 't1', delta })),
          { type: 'text-end' as const, id: 't1' },
          {
            type: 'finish' as const,
            finishReason: { unified: 'stop' as const, raw: undefined },
            usage: {
              inputTokens: {
                total: 900,
                noCache: 900,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 2500, text: 2500, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  })
}

/** 输出任何内容前就失败的服务商 */
function failingModel() {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new Error('provider down')
    },
  })
}

/** 只在 `release()` 后才继续输出，用于在生成过程中再次点击 */
function gatedModel(text: string) {
  let open!: () => void
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'text-start', id: 't1' })
          controller.enqueue({ type: 'text-delta', id: 't1', delta: text.slice(0, 20) })
          await gate
          controller.enqueue({ type: 'text-delta', id: 't1', delta: text.slice(20) })
          controller.enqueue({ type: 'text-end', id: 't1' })
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage: {
              inputTokens: {
                total: 900,
                noCache: 900,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 2500, text: 2500, reasoning: undefined },
            },
          })
          controller.close()
        },
      }),
    }),
  })
  return { model, release: () => open() }
}

function settingsFor(modelKey: string, overrides: Partial<Record<SettingKey, unknown>> = {}) {
  const store: SettingStore = {
    async find(key) {
      if (key in overrides) return overrides[key]
      if (key.endsWith('.modelKey')) return modelKey
      return undefined
    },
  }
  return { store }
}

function deps(model: MockLanguageModelV4, modelKey: string, overrides = {}) {
  const pending: Promise<unknown>[] = []
  const sent: EmailQueueMessage[] = []
  const value: ReadingDeps = {
    db,
    auth,
    env: {},
    waitUntil: (promise) => {
      pending.push(promise)
    },
    languageModelFactory: () => model,
    retryDelay: async () => {},
    settings: settingsFor(modelKey, overrides),
    emailQueue: {
      available: true,
      value: {
        send: async (message) => {
          sent.push(message)
        },
      },
    },
  }
  return { deps: value, sent, settled: () => Promise.all(pending) }
}

function post(who: { cookie: string }, body: unknown, readingDeps: ReadingDeps) {
  return handleReadingRequest(
    new Request(`${APP_URL}/api/readings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: who.cookie },
      body: JSON.stringify(body),
    }),
    readingDeps,
  )
}

const unlock = (input: unknown = BIRTH) => ({
  kind: 'bazi-full',
  input,
  locale: 'zh-Hant',
  site: 'east',
})

async function readings(workspaceId: string) {
  return sql<
    { id: string; status: string; content: string; credits: number; message_id: string | null }[]
  >`select id, status, content, credits, message_id from reading
    where workspace_id = ${workspaceId} order by id`
}

async function holds(workspaceId: string) {
  return sql<{ status: string; amount: number; captured_amount: number }[]>`
    select status, amount, captured_amount from credit_hold where workspace_id = ${workspaceId}`
}

afterAll(async () => {
  const ids = sql`select id from "user" where email like ${`%@${EMAIL_DOMAIN}`}`
  await sql`delete from reading where workspace_id in (${ids})`
  await sql`delete from ai_message where workspace_id in (${ids})`
  await sql`delete from ai_conversation where workspace_id in (${ids})`
  await sql`delete from credit_hold_allocation where hold_id in
    (select id from credit_hold where workspace_id in (${ids}))`
  await sql`delete from credit_ledger where workspace_id in (${ids})`
  await sql`delete from credit_hold where workspace_id in (${ids})`
  await sql`delete from credit_grant where workspace_id in (${ids})`
  await sql`delete from credit_debt where workspace_id in (${ids})`
  await sql`delete from session where user_id in (${ids})`
  await sql`delete from account where user_id in (${ids})`
  await sql`delete from member where user_id in (${ids})`
  await sql`delete from organization where id in (${ids})`
  await sql`delete from "user" where id in (${ids})`
  await db.delete(aiModel).where(like(aiModel.key, `${MODEL_KEY_PREFIX}%`))
})

describe('POST /api/readings', () => {
  it('成功：按设置的积分结算，保存带声明、已做合规替换的报告并投递报告邮件', async () => {
    const who = await member(300)
    const modelKey = await textModel()
    const run = deps(reportModel(REPORT), modelKey)
    const response = await post(who, unlock(), run.deps)
    expect(response.status).toBe(200)
    const readingId = response.headers.get('x-reading-id')
    expect(readingId).toBeTruthy()
    // 未配置发信通道（log）：邮件照常入队（jobs 只记录），但前台不提「已寄信」
    expect(response.headers.get('x-reading-email')).toBe('none')
    const stream = await response.text()
    expect(stream).toContain('總論')
    await run.settled()

    expect((await getCreditBalance(db, who.workspaceId)).available).toBe(200)
    expect(await holds(who.workspaceId)).toEqual([
      { status: 'captured', amount: 100, captured_amount: 100 },
    ])
    const [saved] = await readings(who.workspaceId)
    expect(saved).toMatchObject({ id: readingId, status: 'ready', credits: 100 })
    expect(saved?.content.startsWith('> 本報告依傳統命理推算')).toBe(true)
    expect(saved?.content).not.toContain('台積電')
    // 混入的简体字在保存前换成繁体
    expect(saved?.content).toContain('財運平穩，宜量入為出。')
    expect(saved?.content).toContain('理財與投資決策請依自身狀況審慎評估')
    expect(saved?.content).toContain('如有不適請諮詢專業醫師。')
    const [row] = await sql<{ model_key: string; prompt_version: string; locale: string }[]>`
      select model_key, prompt_version, locale from reading where id = ${readingId}`
    expect(row).toEqual({ model_key: modelKey, prompt_version: 'bazi-full.v2', locale: 'zh-Hant' })
    expect(run.sent).toEqual([
      expect.objectContaining({
        template: 'reading-ready',
        to: who.email,
        locale: 'zh-Hant',
        idempotencyKey: `reading-ready:${readingId}`,
        // 测试请求来自未登记的 localhost:3000，链接保留请求 origin（已登记 Host 的跨站规范地址见 site.test.ts）
        props: { url: `${APP_URL}/app/${who.slug}/readings/${readingId}` },
      }),
    ])
    // 报告关联承载预扣与结算的消息，超时兜底沿用 ai_message 处理器
    expect(saved?.message_id).toBeTruthy()
  })

  it('发信通道为 resend 且邮箱已验证时，响应标明报告邮件已入队；未验证时不提邮件', async () => {
    const modelKey = await textModel()
    const unverified = await member(300)
    const first = deps(reportModel(REPORT), modelKey)
    const plain = await post(unverified, unlock(), { ...first.deps, emailTransport: 'resend' })
    expect(plain.headers.get('x-reading-email')).toBe('none')
    await plain.text()
    await first.settled()

    const verified = await member(300)
    await sql`update "user" set email_verified = true where id = ${verified.userId}`
    const second = deps(reportModel(REPORT), modelKey)
    const response = await post(verified, unlock(), { ...second.deps, emailTransport: 'resend' })
    expect(response.status).toBe(200)
    expect(response.headers.get('x-reading-email')).toBe('queued')
    await response.text()
    await second.settled()
    expect(second.sent).toEqual([expect.objectContaining({ to: verified.email })])
  })

  it('模型在输出任何内容前失败：预扣全额退回，报告标记失败且可以重试', async () => {
    const who = await member(150)
    const modelKey = await textModel()
    const failed = deps(failingModel(), modelKey)
    const response = await post(who, unlock(), failed.deps)
    await response.text()
    await failed.settled()
    expect((await getCreditBalance(db, who.workspaceId)).available).toBe(150)
    expect(await holds(who.workspaceId)).toEqual([
      { status: 'released', amount: 100, captured_amount: 0 },
    ])
    expect((await readings(who.workspaceId)).map((r) => r.status)).toEqual(['failed'])
    expect(failed.sent).toEqual([])

    const retry = deps(reportModel(REPORT), modelKey)
    const again = await post(who, unlock(), retry.deps)
    expect(again.headers.get('x-reading-id')).toBeTruthy()
    await again.text()
    await retry.settled()
    expect((await readings(who.workspaceId)).map((r) => r.status)).toEqual(['failed', 'ready'])
    expect((await getCreditBalance(db, who.workspaceId)).available).toBe(50)
  })

  it('模型正常结束但章节不全（如输出截断）：预扣全额退回，报告标记失败、不保存残缺正文', async () => {
    const who = await member(150)
    const modelKey = await textModel()
    const partial = deps(reportModel('## 總論\n\n只寫了總論就結束。'), modelKey)
    const response = await post(who, unlock(), partial.deps)
    expect(response.status).toBe(200)
    await response.text()
    await partial.settled()
    expect((await getCreditBalance(db, who.workspaceId)).available).toBe(150)
    expect(await holds(who.workspaceId)).toEqual([
      { status: 'released', amount: 100, captured_amount: 0 },
    ])
    const [saved] = await readings(who.workspaceId)
    expect(saved).toMatchObject({ status: 'failed', content: '' })
    expect(partial.sent).toEqual([])
  })

  it('生成过程中再次点击（含携带篡改命盘的请求）：返回同一份报告，不重复扣费', async () => {
    const who = await member(300)
    const modelKey = await textModel()
    const gated = gatedModel(REPORT)
    const first = deps(gated.model, modelKey)
    const response = await post(who, unlock(), first.deps)
    const readingId = response.headers.get('x-reading-id')

    const second = deps(reportModel(REPORT), modelKey)
    const clicked = await post(
      who,
      unlock({ chart: { dayMaster: 'gui' }, ...BIRTH, month: 5 }),
      second.deps,
    )
    expect(clicked.status).toBe(200)
    expect(await clicked.json()).toEqual({ reading: { id: readingId, status: 'generating' } })

    gated.release()
    await response.text()
    await first.settled()
    await second.settled()
    expect((await readings(who.workspaceId)).map((r) => r.id)).toEqual([readingId])
    expect(await holds(who.workspaceId)).toHaveLength(1)
    expect((await getCreditBalance(db, who.workspaceId)).available).toBe(200)

    // 已完成的报告在 10 分钟内仍按同一请求返回
    const third = deps(reportModel(REPORT), modelKey)
    expect(await (await post(who, unlock(), third.deps)).json()).toEqual({
      reading: { id: readingId, status: 'ready' },
    })
    expect((await getCreditBalance(db, who.workspaceId)).available).toBe(200)
  })

  it('余额不足返回 402 且不留下报告；关闭或未选定模型的详批返回 404', async () => {
    const who = await member(50)
    const modelKey = await textModel()
    const poor = deps(reportModel(REPORT), modelKey)
    const response = await post(who, unlock(), poor.deps)
    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({ error: { code: 'INSUFFICIENT_CREDITS' } })
    expect(await readings(who.workspaceId)).toEqual([])

    const disabled = deps(reportModel(REPORT), modelKey, { 'readings.bazi-full.enabled': false })
    expect((await post(who, unlock(), disabled.deps)).status).toBe(404)
    const unset = deps(reportModel(REPORT), '')
    expect((await post(who, unlock(), unset.deps)).status).toBe(404)
    // 语言与站点不匹配、输入非法
    expect((await post(who, { ...unlock(), locale: 'ko' }, poor.deps)).status).toBe(400)
    expect((await post(who, unlock({ ...BIRTH, month: 13 }), poor.deps)).status).toBe(400)
  })

  it('未登录返回 401', async () => {
    const modelKey = await textModel()
    const run = deps(reportModel(REPORT), modelKey)
    expect((await post({ cookie: '' }, unlock(), run.deps)).status).toBe(401)
  })
})

describe('删除（隐私政策「如何删除数据」）', () => {
  async function generated(who: Awaited<ReturnType<typeof member>>) {
    const run = deps(reportModel(REPORT), await textModel())
    const response = await post(who, unlock(), run.deps)
    const id = response.headers.get('x-reading-id')
    await response.text()
    await run.settled()
    if (!id) throw new Error('reading id missing')
    return id
  }
  const conversationParts = (workspaceId: string) =>
    sql<{ parts: unknown[]; title: string }[]>`
      select m.parts, c.title from ai_message m join ai_conversation c on c.id = m.conversation_id
      where m.workspace_id = ${workspaceId}`

  it('删除一份报告时一并清空其 AI 对话正文与会话标题', async () => {
    const who = await member(100)
    const id = await generated(who)
    expect((await conversationParts(who.workspaceId)).some((row) => row.parts.length > 0)).toBe(
      true,
    )

    expect(await deleteReadingWithContent(db, who.workspaceId, id)).toBe(true)
    expect(await readings(who.workspaceId)).toEqual([])
    expect(await conversationParts(who.workspaceId)).toEqual([
      { parts: [], title: '' },
      { parts: [], title: '' },
    ])
    // 其他空间的报告不能删
    const other = await member(0)
    expect(await deleteReadingWithContent(db, other.workspaceId, id)).toBe(false)
  })

  it('删除账号的步骤清除个人空间的报告、AI 正文与订阅记录', async () => {
    const who = await member(100)
    await generated(who)
    await sql`insert into newsletter_subscriber (id, email, confirm_token) values (${newId()}, ${who.email.toUpperCase()}, ${newId()})`
    await sql.begin((tx) =>
      workspaceContentDeletionStep.execute?.(
        { actorUserId: who.userId, workspaceIds: [who.workspaceId], db },
        tx,
      ),
    )
    expect(await readings(who.workspaceId)).toEqual([])
    expect((await conversationParts(who.workspaceId)).every((row) => row.parts.length === 0)).toBe(
      true,
    )
    expect(
      await sql`select 1 from newsletter_subscriber where lower(email) = lower(${who.email})`,
    ).toHaveLength(0)
  })
})

describe('其余详批类型（tasks.md 2.4）', () => {
  const cases = [
    { kind: 'ziwei-full', locale: 'zh-Hant', site: 'east', input: BIRTH },
    {
      kind: 'saju-compat',
      locale: 'ko',
      site: 'east',
      input: {
        a: { ...BIRTH, location: { city: 'seoul' } },
        b: { ...BIRTH, year: 1988, gender: 'male', location: { city: 'busan' } },
      },
    },
    {
      kind: 'numerology-full',
      locale: 'en',
      site: 'west',
      input: { year: 1987, month: 11, day: 29, name: 'Ada' },
    },
    {
      kind: 'tarot-spread',
      locale: 'ko',
      site: 'east',
      input: { reading: 'three-card:major-00,major-01r,major-02', question: '이직' },
    },
  ] as const

  for (const item of cases)
    it(`${item.kind}（${item.locale}）：复算后生成，按章节保存并结算`, async () => {
      const definition = readingDefinition(item.kind, item.locale)
      if (!definition) throw new Error(`${item.kind} missing`)
      const report = definition.prompt.sections
        .map((title) => `## ${title}\n\n${title} …`)
        .join('\n\n')
      const who = await member(100)
      const modelKey = await textModel()
      const model = reportModel(report)
      const run = deps(model, modelKey)
      const response = await post(
        who,
        { kind: item.kind, input: item.input, locale: item.locale, site: item.site },
        run.deps,
      )
      expect(response.status).toBe(200)
      const readingId = response.headers.get('x-reading-id')
      await response.text()
      await run.settled()
      const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt ?? [])
      expect(prompt).toContain(definition.prompt.system.slice(0, 20))

      expect((await getCreditBalance(db, who.workspaceId)).available).toBe(0)
      const [saved] = await readings(who.workspaceId)
      expect(saved).toMatchObject({ id: readingId, status: 'ready' })
      expect(saved?.content.startsWith(`> ${definition.disclaimer}`)).toBe(true)
      for (const title of definition.prompt.sections)
        expect(saved?.content).toContain(`## ${title}`)
      if (definition.healthSection)
        expect(saved?.content).toContain(definition.healthSection.notice)
      const [row] = await sql<{ prompt_version: string; locale: string; kind: string }[]>`
        select prompt_version, locale, kind from reading where id = ${readingId}`
      expect(row).toEqual({
        prompt_version: definition.prompt.version,
        locale: item.locale,
        kind: item.kind,
      })
      expect(run.sent).toHaveLength(1)
    })

  it('塔罗：牌义来自服务端，问题作为数据传给模型；单张牌阵返回 400', async () => {
    const who = await member(100)
    const modelKey = await textModel()
    const model = reportModel('## Overview\n\nok')
    const run = deps(model, modelKey)
    const body = {
      kind: 'tarot-spread',
      input: { reading: 'three-card:major-00,major-01r,major-02', meaning: 'fake' },
      locale: 'en',
      site: 'west',
    }
    const response = await post(who, body, run.deps)
    await response.text()
    await run.settled()
    const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt ?? [])
    expect(prompt).toContain('The Fool')
    expect(prompt).not.toContain('fake')
    const single = await post(
      who,
      { ...body, input: { reading: 'daily:major-00' } },
      deps(reportModel('x'), modelKey).deps,
    )
    expect(single.status).toBe(400)
    // 塔罗报告语言须与站点一致
    expect((await post(who, { ...body, site: 'east' }, run.deps)).status).toBe(400)
  })
})

describe('详批运行时设置', () => {
  it('后台修改后清除缓存，前台读取到新值，并按类型审计新旧值', async () => {
    const admin = { id: newId() }
    const modelKey = await textModel()
    const original = await db
      .select()
      .from(setting)
      .where(inArray(setting.key, READING_SETTING_KEYS))
    const cached = new Map<string, string>()
    const cache = {
      get: async (key: string) => cached.get(key) ?? null,
      put: async (key: string, value: string) => {
        cached.set(key, value)
      },
      delete: async (key: string) => {
        cached.delete(key)
      },
    }
    const ctx = { store: dbSettingStore(db), cache }
    try {
      await db.insert(user).values({
        ...admin,
        name: 'Readings admin',
        email: `${admin.id}@readings-settings.test`,
        role: 'admin',
      })
      const before = await readingConfig(ctx, 'tarot-spread')
      const input = readingSettingsInput.parse({
        readings: [
          { kind: 'bazi-full', enabled: true, credits: 120, modelKey: ` ${modelKey} ` },
          { kind: 'tarot-spread', enabled: false, credits: 80, modelKey: '' },
        ],
      })
      await runAdminAction({ db, admin, ip: '203.0.113.20' }, 'setting.readings.update', (scope) =>
        writeReadingSettings(scope, input),
      )
      // 缓存未清除前仍是旧值
      expect(await readingConfig(ctx, 'tarot-spread')).toEqual(before)
      await invalidateReadingSettings(cache)
      expect(await readingConfig(ctx, 'bazi-full')).toEqual({
        enabled: true,
        credits: 120,
        modelKey,
      })
      expect(await readingConfig(ctx, 'tarot-spread')).toEqual({
        enabled: false,
        credits: 80,
        modelKey: '',
      })
      const records = await db.select().from(auditLog).where(eq(auditLog.actorUserId, admin.id))
      expect(records.map((r) => r.targetId).sort()).toEqual([
        'readings.bazi-full',
        'readings.tarot-spread',
      ])
      expect(records.find((r) => r.targetId === 'readings.tarot-spread')?.meta).toMatchObject({
        changes: {
          'readings.tarot-spread.enabled': { oldValue: before.enabled, newValue: false },
        },
      })

      await expect(
        runAdminAction({ db, admin }, 'setting.readings.update', (scope) =>
          writeReadingSettings(
            scope,
            readingSettingsInput.parse({
              readings: [{ kind: 'saju-full', enabled: true, credits: 100, modelKey: 'missing' }],
            }),
          ),
        ),
      ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
      expect(
        readingSettingsInput.safeParse({
          readings: [{ kind: 'saju-full', enabled: true, credits: 0, modelKey: '' }],
        }).success,
      ).toBe(false)
    } finally {
      await db.delete(setting).where(inArray(setting.key, READING_SETTING_KEYS))
      if (original.length) await db.insert(setting).values(original)
      await createAdminTestDb('migrator').delete(auditLog).where(eq(auditLog.actorUserId, admin.id))
      await db.delete(user).where(eq(user.id, admin.id))
    }
  })

  it('每种详批都有设置项', () => {
    for (const kind of READING_KINDS)
      expect(settingDefaults[`readings.${kind}.credits`]).toBeGreaterThan(0)
  })
})
