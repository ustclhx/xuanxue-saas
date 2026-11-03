import { env } from 'cloudflare:workers'
import { defineTemplateConfig, type SiteId } from '@xuanxue/config'
import { createDb } from '@xuanxue/db'
import * as schema from '@xuanxue/db/schema'
import type { KeyValueStore } from '@xuanxue/platform'
import { createCloudflareKv } from '@xuanxue/platform/cloudflare'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { type AuthEmail, createAuth } from '../src/index.ts'
import { siteScopedAdapter } from '../src/site-adapter.ts'
import {
  app,
  cookieHeader,
  countingRateLimiter,
  nextIp,
  PASSWORD,
  signUpBody,
  silenceExpectedErrors,
  testEnv,
  testUsers,
  withoutCookieCache,
} from './helpers.ts'

// Spike 1.1（openspec split-site-accounts 决策 2）：在 Better Auth 1.7.7 上验证按站点包装 adapter。
//
// 不新增迁移（迁移只有 2.1 一份）：
// - 数据库：beforeAll 以 migrator 给 user / account / verification 加可空的 site 列，并把
//   user_email_unique 换成 (site, email) 唯一索引；afterAll 还原。列可空，其他并行测试文件不受影响。
// - drizzle schema：只在本文件内把三张表替换为带 site 列的定义（vi.mock），其他文件仍用原 schema。
vi.mock('@xuanxue/db/schema', async (importOriginal) => {
  const original = await importOriginal<typeof import('@xuanxue/db/schema')>()
  const { boolean, pgTable, text, timestamp, uuid } = await import('drizzle-orm/pg-core')
  const timestamps = {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }
  // 与 packages/db/src/schema/auth.ts 一致，只多一个 site 列（外键与索引不影响查询，省略）
  const user = pgTable('user', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: text('role'),
    banned: boolean('banned').default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires', { withTimezone: true }),
    twoFactorEnabled: boolean('two_factor_enabled').default(false),
    locale: text('locale'),
    timezone: text('timezone'),
    site: text('site'),
    ...timestamps,
  })
  const account = pgTable('account', {
    id: uuid('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    site: text('site'),
    ...timestamps,
  })
  const verification = pgTable('verification', {
    id: uuid('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    site: text('site'),
    ...timestamps,
  })
  return { ...original, user, account, verification }
})

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'
const ORIGIN: Record<SiteId, string> = { east: EAST, west: WEST }

const SPIKE_PREFIX = 'site-spike'
const SPIKE_DOMAIN = `${SPIKE_PREFIX}.auth-test.example`
const users = testUsers(SPIKE_PREFIX)
const { email } = users
// 整个文件共用一个连接池：每次 createDb 都会新建最多 5 个连接，本地 PG 的连接数有限
const db = createDb(env.HYPERDRIVE)
const raw = () => db.$client
/** DDL 用 migrator，用完即关，不占用并行测试的连接 */
async function migrator(run: (sql: ReturnType<typeof createDb>['$client']) => Promise<void>) {
  const sql = createDb(env.HYPERDRIVE_MIGRATOR, { max: 1 }).$client
  try {
    await run(sql)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

beforeAll(() =>
  migrator(async (sql) => {
    await sql`alter table "user" add column if not exists site text`
    await sql`alter table account add column if not exists site text`
    await sql`alter table verification add column if not exists site text`
    await sql`alter table "user" drop constraint if exists user_email_unique`
    await sql`create unique index if not exists spike_user_site_email_unique on "user" (site, email)`
  }),
)
afterEach(() => {
  vi.restoreAllMocks()
})
afterAll(async () => {
  await users.cleanup()
  await migrator(async (sql) => {
    // 之前中断的运行可能留下同邮箱的两站账户，恢复全局唯一约束前一并清掉
    const stale = (
      await sql<{ id: string }[]>`select id from "user" where email like ${`%.${SPIKE_DOMAIN}`}`
    ).map((u) => u.id)
    if (stale.length) {
      await sql`delete from audit_log where actor_user_id in ${sql(stale)} or workspace_id in ${sql(stale)}
        or (target_type = 'user' and target_id in ${sql(stale)})`
      await sql`delete from session where user_id in ${sql(stale)}`
      await sql`delete from member where organization_id in ${sql(stale)} or user_id in ${sql(stale)}`
      await sql`delete from organization where id in ${sql(stale)}`
      await sql`delete from account where user_id in ${sql(stale)}`
      await sql`delete from "user" where id in ${sql(stale)}`
    }
    await sql`delete from verification where site is not null`
    await sql`drop index if exists spike_user_site_email_unique`
    await sql`alter table "user" add constraint user_email_unique unique (email)`
    await sql`alter table verification drop column if exists site`
    await sql`alter table account drop column if exists site`
    await sql`alter table "user" drop column if exists site`
  })
})

/** 一个站点的入口：与生产一样按请求创建 auth，站点只来自入口（决策 1） */
function siteClient(site: SiteId, options: { kv?: boolean } = {}) {
  const cache: KeyValueStore | undefined =
    options.kv === false ? undefined : createCloudflareKv(env.CACHE)
  const sent: AuthEmail[] = []
  const ip = nextIp()
  const rateLimiter = countingRateLimiter(1000)
  const origin = ORIGIN[site]
  const makeAuth = () =>
    createAuth({ ...testEnv, APP_URL: WEST }, db, {
      cache,
      rateLimiter,
      clientIp: ip,
      hosts: ['ganjiday.com', 'arcanumber.com'],
      site,
      config: defineTemplateConfig({ app, auth: { oauth: ['google'], turnstile: false } }),
      sendEmail: async (message) => {
        sent.push(message)
      },
    })
  const request = (
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    makeAuth().handler(
      new Request(`${origin}/api/auth${path}`, {
        method,
        headers: {
          origin,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )
  return {
    site,
    sent,
    makeAuth,
    post: (path: string, body: unknown, headers?: Record<string, string>) =>
      request('POST', path, body, headers),
    get: (path: string, headers?: Record<string, string>) =>
      request('GET', path, undefined, headers),
  }
}

const usersByEmail = (address: string) =>
  raw()<
    { id: string; site: string | null }[]
  >`select id, site from "user" where email = ${address} order by site`

describe('Better Auth 1.7.7 adapter 按站点包装（spike 1.1）', () => {
  it('同一邮箱可在两站各注册一个账户；user 与 account 都写入各自站点', async () => {
    const address = email('both')
    const east = siteClient('east')
    const west = siteClient('west')
    expect((await east.post('/sign-up/email', signUpBody(address))).status).toBe(200)
    expect(
      (await west.post('/sign-up/email', signUpBody(address, 'west-password-123'))).status,
    ).toBe(200)
    const rows = await usersByEmail(address)
    expect(rows.map((r) => r.site)).toEqual(['east', 'west'])
    const accounts = await raw()<
      { site: string | null; user_id: string }[]
    >`select site, user_id from account where user_id in ${raw()(rows.map((r) => r.id))} order by site`
    expect(accounts).toEqual([
      { site: 'east', user_id: rows[0]?.id },
      { site: 'west', user_id: rows[1]?.id },
    ])
    // 同站重复注册仍被拒绝
    silenceExpectedErrors(/already exists/i)
    expect((await east.post('/sign-up/email', signUpBody(address))).status).toBe(422)
  })

  it('密码登录只在本站生效：另一站的密码与「账户不存在」返回同样的错误', async () => {
    silenceExpectedErrors(/Invalid email or password/i)
    const address = email('signin')
    const east = siteClient('east')
    const west = siteClient('west')
    expect((await east.post('/sign-up/email', signUpBody(address))).status).toBe(200)

    const ok = await east.post('/sign-in/email', { email: address, password: PASSWORD })
    expect(ok.status).toBe(200)
    const cross = await west.post('/sign-in/email', { email: address, password: PASSWORD })
    const missing = await west.post('/sign-in/email', {
      email: email('nobody'),
      password: PASSWORD,
    })
    expect(cross.status).toBe(401)
    expect(missing.status).toBe(401)
    expect(await cross.json()).toEqual(await missing.json())
  })

  it('邮箱验证码只在本站有效：东方站的 OTP 不能在西方站登录', async () => {
    silenceExpectedErrors(/invalid otp/i, /INVALID_OTP/)
    const address = email('otp')
    const east = siteClient('east')
    const west = siteClient('west')
    expect((await east.post('/sign-up/email', signUpBody(address))).status).toBe(200)
    expect(
      (await east.post('/email-otp/send-verification-otp', { email: address, type: 'sign-in' }))
        .status,
    ).toBe(200)
    const otp = east.sent.at(-1)
    if (otp?.type !== 'otp') throw new Error('missing otp email')
    const [row] = await raw()<
      { site: string | null }[]
    >`select site from verification where identifier = ${`sign-in-otp-${address}`}`
    expect(row?.site).toBe('east')

    const cross = await west.post('/sign-in/email-otp', { email: address, otp: otp.otp })
    expect(cross.status).toBeGreaterThanOrEqual(400)
    // 西方站没有因此创建账户，东方站的验证码也未被消耗
    expect((await usersByEmail(address)).map((r) => r.site)).toEqual(['east'])
    const ok = await east.post('/sign-in/email-otp', { email: address, otp: otp.otp })
    expect(ok.status).toBe(200)
  })

  it('重置链接只在本站有效：西方站提交东方站的 token 不修改任何密码', async () => {
    silenceExpectedErrors(/invalid token/i, /INVALID_TOKEN/)
    const address = email('reset')
    const east = siteClient('east')
    const west = siteClient('west')
    expect((await east.post('/sign-up/email', signUpBody(address))).status).toBe(200)
    expect(
      (await west.post('/sign-up/email', signUpBody(address, 'west-password-123'))).status,
    ).toBe(200)
    expect((await east.post('/request-password-reset', { email: address })).status).toBe(200)
    const mail = east.sent.at(-1)
    if (mail?.type !== 'reset-password') throw new Error('missing reset email')
    const token = new URL(mail.url).pathname.split('/').at(-1) ?? ''

    const cross = await west.post('/reset-password', { token, newPassword: 'hijacked-password-1' })
    expect(cross.status).toBe(400)
    for (const [client, password] of [
      [east, PASSWORD],
      [west, 'west-password-123'],
    ] as const) {
      expect((await client.post('/sign-in/email', { email: address, password })).status).toBe(200)
    }
    // 本站使用同一 token 仍然有效
    const ok = await east.post('/reset-password', { token, newPassword: 'new-east-password-1' })
    expect(ok.status).toBe(200)
  })

  it('Google 登录按站点关联：同一个 Google 账号在两站得到两个账户', async () => {
    const address = email('google')
    const sub = `google-sub-${crypto.randomUUID()}`
    mockGoogle({ sub, email: address })
    const east = siteClient('east')
    const west = siteClient('west')
    // 东方站先登录两次（第二次按 account 找回同一用户），再在西方站登录
    for (const client of [east, east, west]) {
      const res = await googleSignIn(client)
      expect(res.status).toBe(302)
      expect(res.headers.get('location'), client.site).not.toMatch(/error/)
    }
    const rows = await usersByEmail(address)
    expect(rows.map((r) => r.site)).toEqual(['east', 'west'])
    const google = await raw()<
      { site: string | null; user_id: string }[]
    >`select site, user_id from account where provider_id = 'google' and account_id = ${sub} order by site`
    expect(google).toEqual([
      { site: 'east', user_id: rows[0]?.id },
      { site: 'west', user_id: rows[1]?.id },
    ])
  })

  it('Google 隐式关联只看本站：东方站已有密码账户不影响西方站建号', async () => {
    silenceExpectedErrors(/account_not_linked/)
    const address = email('google-link')
    mockGoogle({ sub: `google-sub-${crypto.randomUUID()}`, email: address })
    const east = siteClient('east')
    const west = siteClient('west')
    expect((await east.post('/sign-up/email', signUpBody(address))).status).toBe(200)
    // 东方站：未信任的提供方不隐式关联已有账户（1.7.7 默认行为，与站点无关）
    expect((await googleSignIn(east)).headers.get('location')).toMatch(/account_not_linked/)
    // 西方站：按站点查不到同邮箱用户，直接创建西方站账户
    expect((await googleSignIn(west)).headers.get('location')).not.toMatch(/error/)
    expect((await usersByEmail(address)).map((r) => r.site)).toEqual(['east', 'west'])
  })

  it('OAuth state 只在本站有效：东方站发起的授权在西方站回调失败', async () => {
    silenceExpectedErrors(/state/i)
    mockGoogle({ sub: `google-sub-${crypto.randomUUID()}`, email: email('state') })
    const east = siteClient('east')
    const west = siteClient('west')
    const start = await east.post('/sign-in/social', { provider: 'google', disableRedirect: true })
    const state = new URL(((await start.json()) as { url: string }).url).searchParams.get('state')
    const res = await west.get(`/callback/google?code=fake-code&state=${state}`, {
      cookie: cookieHeader(start),
    })
    expect(res.headers.get('location')).toMatch(/error/)
  })

  it('数据库路径读会话时，另一站用户的会话视为未登录（Cookie 缓存层仍需决策 3 兜底）', async () => {
    const address = email('session')
    // 不用 KV：会话只在 Cookie 缓存与数据库中，便于分别观察两层
    const east = siteClient('east', { kv: false })
    const west = siteClient('west', { kv: false })
    const signUp = await east.post('/sign-up/email', signUpBody(address))
    const cookie = cookieHeader(signUp)
    const dbOnly = withoutCookieCache(cookie)

    const own = await east.get('/get-session', { cookie: dbOnly })
    expect(((await own.json()) as { user: { site: string } }).user.site).toBe('east')
    const cross = await west.get('/get-session', { cookie: dbOnly })
    expect(await cross.json()).toBeNull()
    // Cookie 缓存不经过 adapter：同一密钥签名的缓存会话在另一站仍被接受，所以 web 侧必须再校验 user.site
    const cached = await west.get('/get-session', { cookie })
    expect(((await cached.json()) as { user: { site: string } } | null)?.user.site).toBe('east')
  })

  it('verification 不写入共享 KV，另一站读不到（KV 不经过 adapter）', async () => {
    const east = await siteClient('east').makeAuth().$context
    const west = await siteClient('west').makeAuth().$context
    const identifier = `spike-${crypto.randomUUID()}@${email('kv').split('@')[1]}`
    await east.internalAdapter.createVerificationValue({
      identifier,
      value: 'v',
      expiresAt: new Date(Date.now() + 60_000),
    })
    expect(await env.CACHE.get(`auth:verification:${identifier}`)).toBeNull()
    expect(await east.internalAdapter.findVerificationValue(identifier)).toMatchObject({
      value: 'v',
    })
    expect(await west.internalAdapter.findVerificationValue(identifier)).toBeNull()
    expect(await west.internalAdapter.consumeVerificationValue(identifier)).toBeNull()
  })

  it('事务路径：drizzle 真事务（transaction: true）中 trx adapter 同样按站点写入与过滤', async () => {
    const ctx = await siteClient('east').makeAuth().$context
    const factory = (site: SiteId) =>
      siteScopedAdapter(
        drizzleAdapter(db, { provider: 'pg', schema, transaction: true }),
        site,
      )(ctx.options)
    const address = email('trx')
    const id = await factory('east').transaction(async (trx) => {
      const created = await trx.create<Record<string, unknown>, { id: string; site: string }>({
        model: 'user',
        data: {
          name: 'Trx',
          email: address,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      expect(created.site).toBe('east')
      return created.id
    })
    expect(await usersByEmail(address)).toEqual([{ id, site: 'east' }])
    const seen = await factory('west').transaction((trx) =>
      trx.findOne({ model: 'user', where: [{ field: 'email', value: address }] }),
    )
    expect(seen).toBeNull()
  })

  it('经 Better Auth 的 adapter 修改 site 直接报错', async () => {
    const ctx = await siteClient('east').makeAuth().$context
    expect(() =>
      ctx.adapter.update({
        model: 'user',
        where: [{ field: 'email', value: email('immutable') }],
        update: { site: 'west' },
      }),
    ).toThrow(/site is immutable/)
  })
})

/** Google 的 token 接口：返回未签名的 id_token（授权码回调只解码不验签，google.mjs getUserInfo） */
function mockGoogle(profile: { sub: string; email: string }) {
  const original = globalThis.fetch
  const b64 = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const idToken = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: 'https://accounts.google.com',
    aud: testEnv.GOOGLE_CLIENT_ID,
    sub: profile.sub,
    email: profile.email,
    email_verified: true,
    name: 'Google User',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.`
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return Response.json({
        access_token: 'fake-access-token',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      })
    }
    return original(input, init)
  })
}

async function googleSignIn(client: ReturnType<typeof siteClient>) {
  const start = await client.post('/sign-in/social', { provider: 'google', disableRedirect: true })
  expect(start.status).toBe(200)
  const state = new URL(((await start.json()) as { url: string }).url).searchParams.get('state')
  return client.get(`/callback/google?code=fake-code&state=${state}`, {
    cookie: cookieHeader(start),
  })
}
