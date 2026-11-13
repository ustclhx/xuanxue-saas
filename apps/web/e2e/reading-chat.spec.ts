import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { DEFAULT_FREE_FEATURES } from '@xuanxue/entitlements'
import { newId } from '@xuanxue/shared'
import { followUpQuestions } from '../src/features/readings/follow-up-questions.ts'
import { fixtureDb, register, simulateClientIp } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

// adopt-subject-chat-readings tasks.md 5.3：报告页内追问（离线）。本地没有真实模型：
// 报告行直接写库，发送消息时拦截 POST /api/ai/chat 返回模拟的 UI message 流；
// 计费与上下文写入由 test/readings-subjects.test.ts、test/ai-subject-chat.test.ts 覆盖。
// 设置 EVIDENCE_DIR 时另存 390 / 1440、浅色 / 深色截图（证据不进仓库）。

const UUID = '[0-9a-f-]{36}'
const OPENERS = followUpQuestions('numerology-full', 'en')
const FIRST = OPENERS[0] ?? ''
const REPORT = `## Overview

Your life path **11** is a master number.

## Life Path

- Sensitive to atmosphere`

const evidenceDir = process.env.EVIDENCE_DIR
  ? join(process.env.EVIDENCE_DIR.replace(/^~/, homedir()), 'report-chat')
  : undefined

test.beforeEach(async ({ page }) => {
  await simulateClientIp(page)
  await stubTurnstile(page)
})

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true })
})

const slugOf = (page: Page) => new URL(page.url()).pathname.split('/')[2] ?? ''

async function seedReading(slug: string) {
  const sql = fixtureDb()
  try {
    const [ws] = await sql<{ id: string }[]>`select id from organization where slug = ${slug}`
    if (!ws) throw new Error('workspace missing')
    const id = newId()
    await sql`insert into reading (id, workspace_id, user_id, kind, input_hash, input, locale,
      engine_version, prompt_version, model_key, credits, status, content)
      values (${id}, ${ws.id}, ${ws.id}, 'numerology-full', ${newId()},
        ${sql.json({ fullName: 'E2E Reader', birthDate: '1987-11-29' })}, 'en',
        'numerology@1', 'numerology-full.v1', 'e2e-model', 100, 'ready', ${REPORT})`
    return id
  } finally {
    await sql.end()
  }
}

/** 让空间的权益包含一个按次计费的测试模型（与 ai-chat.spec.ts 相同做法） */
async function seedChatModel(slug: string) {
  const sql = fixtureDb()
  const tag = `e2e-reading-chat-${newId().slice(-8)}`
  const modelId = newId()
  try {
    const [workspace] = await sql`select id from organization where slug = ${slug}`
    if (!workspace) throw new Error('Workspace fixture is missing')
    const planId = newId()
    const priceId = newId()
    const features = JSON.stringify({ ...DEFAULT_FREE_FEATURES, models: [tag] })
    await sql`insert into plan (id,key,name,type,credits,features,sort,active)
      values (${planId},${tag},'E2E reading chat','subscription',0,${features}::jsonb,1000,false)`
    await sql`insert into plan_price (id,plan_id,provider,provider_price_id,interval,amount,currency,active)
      values (${priceId},${planId},'stripe',${`e2e:${priceId}`},'month',0,'usd',false)`
    await sql`insert into subscription (id,workspace_id,plan_id,plan_price_id,provider,
      provider_subscription_id,status,current_period_start,current_period_end,
      cancel_at_period_end,canceled_at,last_event_at)
      values (${newId()},${workspace.id},${planId},${priceId},'stripe',${`e2e:${planId}`},
        'canceled',now(),now()+interval '1 day',true,now(),now())`
    const pricing = {
      mode: 'per_call',
      credits: 2,
      limits: { maxInputTokens: 8000, maxOutputTokens: 2000 },
    }
    await sql`insert into ai_model (id,key,kind,provider,provider_model_id,pricing,min_plan_features,sort)
      values (${modelId},${tag},'text','anthropic','gpt-fixture',${sql.json(pricing)},${sql.json([tag])},-1000)`
  } finally {
    await sql.end()
  }
  return { modelId, key: tag }
}

async function removeModel(modelId: string) {
  const sql = fixtureDb()
  try {
    await sql`update ai_model set enabled = false where id = ${modelId}`
  } finally {
    await sql.end()
  }
}

function uiStream(conversationId: string, messageId: string, deltas: string[]) {
  const chunks = [
    { type: 'start', messageId, messageMetadata: { conversationId, messageId } },
    { type: 'start-step' },
    { type: 'text-start', id: 't1' },
    ...deltas.map((delta) => ({ type: 'text-delta', id: 't1', delta })),
    { type: 'text-end', id: 't1' },
    { type: 'finish-step' },
    { type: 'finish' },
  ]
  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`
}

const STREAM_HEADERS = {
  'content-type': 'text/event-stream',
  'x-vercel-ai-ui-message-stream': 'v1',
}

/** 390 / 1440 × 浅色 / 深色截图追问区（只在设置 EVIDENCE_DIR 时） */
async function capture(page: Page, name: string) {
  if (!evidenceDir) return
  mkdirSync(evidenceDir, { recursive: true })
  const viewport = page.viewportSize()
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    // 西方站默认深色主题不跟随系统：截图时直接切换根元素的 dark 类
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle('dark', dark),
      scheme === 'dark',
    )
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      const section = page.getByTestId('reading-chat')
      await section.scrollIntoViewIfNeeded()
      // 390 宽不得出现横向滚动
      if (width === 390)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        )
      await section.screenshot({ path: join(evidenceDir, `${name}-${width}-${scheme}.png`) })
    }
  }
  await page.emulateMedia({ colorScheme: 'light' })
  if (viewport) await page.setViewportSize(viewport)
}

test('ready 报告页内追问：开场问题、回复、刷新后同一对话、他人 404', async ({ page, browser }) => {
  test.setTimeout(300_000)
  await register(page, `reading-chat-${newId()}@example.com`)
  const slug = slugOf(page)
  const id = await seedReading(slug)
  const model = await seedChatModel(slug)
  const reportUrl = `/app/${slug}/readings/${id}`
  try {
    // 模型列表经 KV 缓存（TTL 60 秒）：刷新直到追问区出现可点击的开场问题
    const opener = page.getByRole('button', { name: FIRST })
    await expect(async () => {
      await page.goto(reportUrl)
      // 追问区懒加载并读取两个 server function，dev 冷启动时较慢
      await expect(opener).toBeEnabled({ timeout: 30_000 })
    }).toPass({ timeout: 150_000, intervals: [2_000, 5_000] })
    const section = page.getByTestId('reading-chat')
    await expect(section.getByRole('heading', { name: 'Ask about this report' })).toBeVisible()
    for (const question of OPENERS)
      await expect(section.getByRole('button', { name: question })).toBeVisible()
    // 新建对话前即显示「预计 · 余额」
    await expect(section.getByTestId('chat-cost')).toContainText(/credits per message · Balance/)
    await capture(page, 'empty')

    const bodies: { conversationId?: string }[] = []
    const messageId = newId()
    await page.route('**/api/ai/chat', async (route) => {
      const body = route.request().postDataJSON() as { conversationId?: string }
      bodies.push(body)
      await route.fulfill({
        status: 200,
        headers: { ...STREAM_HEADERS, 'x-conversation-id': body.conversationId ?? '' },
        body: uiStream(body.conversationId ?? '', messageId, [
          'Per your report, ',
          'Life Path 11.',
        ]),
      })
    })
    await expect(async () => {
      if (bodies.length === 0) await opener.click()
      expect(bodies.length).toBeGreaterThan(0)
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000] })
    const messages = section.getByRole('list', { name: 'Messages' })
    await expect(messages.getByRole('listitem', { name: 'Assistant' })).toHaveText(
      /Per your report, Life Path 11\./,
    )
    const conversationId = bodies[0]?.conversationId ?? ''
    expect(conversationId).toMatch(new RegExp(`^${UUID}$`))
    const sql = fixtureDb()
    try {
      const [conversation] = await sql<{ subject_type: string; subject_id: string }[]>`
        select subject_type, subject_id from ai_conversation where id = ${conversationId}`
      expect(conversation).toEqual({ subject_type: 'reading', subject_id: id })
      // 模拟的流不经服务端：把这一轮写进历史，验证刷新后仍进入同一对话
      const [ws] = await sql<{ id: string }[]>`select id from organization where slug = ${slug}`
      await sql`insert into ai_message (id, workspace_id, conversation_id, role, parts) values
        (${newId()}, ${ws?.id ?? ''}, ${conversationId}, 'user', ${sql.json([{ type: 'text', text: FIRST }])}),
        (${messageId}, ${ws?.id ?? ''}, ${conversationId}, 'assistant', ${sql.json([{ type: 'text', text: 'Per your report, Life Path 11.' }])})`
    } finally {
      await sql.end()
    }
    await capture(page, 'reply')

    await page.reload()
    await expect(
      page.getByTestId('reading-chat').getByRole('listitem', { name: 'Assistant' }),
    ).toHaveText(/Per your report, Life Path 11\./, { timeout: 30_000 })

    // 他人以同一报告 ID 打开报告页 404；追问区不会出现
    const strangerContext = await browser.newContext()
    const stranger = await strangerContext.newPage()
    await simulateClientIp(stranger)
    await stubTurnstile(stranger)
    await register(stranger, `reading-chat-stranger-${newId()}@example.com`, 'Stranger')
    const response = await stranger.goto(reportUrl)
    expect(response?.status()).toBe(404)
    await expect(stranger.getByTestId('reading-chat')).toHaveCount(0)
    await strangerContext.close()
  } finally {
    await removeModel(model.modelId)
  }
})

test('没有可用对话模型：报告正文正常，追问区显示空态与购买入口', async ({ page }) => {
  test.setTimeout(150_000)
  await register(page, `reading-chat-none-${newId()}@example.com`)
  const slug = slugOf(page)
  const id = await seedReading(slug)
  await page.goto(`/app/${slug}/readings/${id}`)
  const report = page.getByTestId('reading-report')
  await expect(report.getByRole('heading', { level: 2, name: 'Life Path' })).toBeVisible()
  const empty = page.getByTestId('report-chat-unavailable')
  await expect(empty).toBeVisible({ timeout: 60_000 })
  await expect(empty.getByRole('link', { name: 'Buy credits' })).toHaveAttribute(
    'href',
    `/app/${slug}/billing#credit-packs`,
  )
  await expect(page.getByTestId('reading-chat').locator('textarea')).toHaveCount(0)
  await capture(page, 'unavailable')
})
