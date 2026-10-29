import { auditLog, type Database } from '@xuanxue/db'
import { afterEach, expect, it, vi } from 'vitest'
import { deliverOperations, sendOperationsChannel } from '../src/notifications/operations.ts'

const settings = vi.hoisted(() => new Map<string, string>())
vi.mock('@xuanxue/db', async (original) => ({
  ...(await original<typeof import('@xuanxue/db')>()),
  dbSettingStore: () => ({}),
  getSetting: async (_ctx: unknown, key: string) => settings.get(key) ?? '',
}))
afterEach(() => {
  settings.clear()
  vi.restoreAllMocks()
})

const secret = 'grok-sender-key-private'
const url = 'https://hooks.example.com/routines/private-routine?key=private-query'
const channels = {
  telegramBotToken: '',
  telegramChatId: '',
  discordWebhookUrl: '',
  webhookUrl: url,
  webhookSecret: secret,
}
const event = {
  event: 'refund.requested' as const,
  sourceId: 'refund-1',
  workspaceId: '01890a5d-ac96-774b-bcce-b302099a8057',
  amount: 199,
  currency: 'USD',
}

// 审计查询返回空（尚未发送），插入记录到 inserted，便于断言审计内容。
function fakeDb() {
  const inserted: unknown[] = []
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: (table: unknown) => ({
      values: async (value: unknown) => {
        expect(table).toBe(auditLog)
        inserted.push(value)
      },
    }),
  } as unknown as Database
  return { db, inserted }
}

it('通用 webhook 以 Bearer 认证 POST 结构化 JSON', async () => {
  const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
  await sendOperationsChannel('webhook', channels, event)
  const [target, init] = http.mock.calls[0] ?? []
  expect(target).toBe(url)
  expect(init?.method).toBe('POST')
  expect(init?.redirect).toBe('manual')
  expect(init?.headers).toMatchObject({
    'content-type': 'application/json',
    authorization: `Bearer ${secret}`,
    'idempotency-key': 'refund.requested:refund-1',
  })
  expect(JSON.parse(String(init?.body))).toEqual({
    v: 1,
    id: 'refund.requested:refund-1',
    ...event,
    text: expect.stringContaining('New refund request'),
  })
})

it('通用 webhook 的 HTTP 失败、重定向与网络异常都是 503，且不暴露地址与密钥', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: url } }))
    .mockRejectedValueOnce(new Error(`connect failed ${url} ${secret}`))
  for (let i = 0; i < 3; i++) {
    const error = await sendOperationsChannel('webhook', channels, event).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'OPERATIONS_WEBHOOK_DELIVERY_FAILED', status: 503 })
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toMatch(/private/)
  }
})

it('未配置或只配置一半时跳过通用 webhook，不发请求也不写审计', async () => {
  const http = vi.spyOn(globalThis, 'fetch')
  for (const partial of [
    {},
    { 'operations.webhookUrl': url },
    { 'operations.webhookSecret': secret },
  ]) {
    settings.clear()
    for (const [key, value] of Object.entries(partial)) settings.set(key, value)
    const { db, inserted } = fakeDb()
    await deliverOperations(db, event)
    expect(inserted).toEqual([])
  }
  expect(http).not.toHaveBeenCalled()
})

it('投递成功后按渠道审计 operations.sent.webhook，审计与日志不含地址和密钥', async () => {
  settings.set('operations.webhookUrl', url)
  settings.set('operations.webhookSecret', secret)
  const logs = (['log', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  )
  const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true }))
  const { db, inserted } = fakeDb()
  await deliverOperations(db, event)
  expect(http).toHaveBeenCalledTimes(1)
  expect(inserted).toEqual([
    {
      action: 'operations.sent.webhook',
      targetType: 'operations_event',
      targetId: 'refund.requested:refund-1',
      workspaceId: event.workspaceId,
    },
  ])
  const visible = JSON.stringify({ inserted, logs: logs.flatMap((spy) => spy.mock.calls) })
  expect(visible).not.toContain(secret)
  expect(visible).not.toContain('private-routine')
})
