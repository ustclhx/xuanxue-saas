import { env } from 'cloudflare:workers'
import { defineTemplateConfig, type SiteId } from '@xuanxue/config'
import { createDb } from '@xuanxue/db'
import * as schema from '@xuanxue/db/schema'
import type { KeyValueStore } from '@xuanxue/platform'
import { createCloudflareKv } from '@xuanxue/platform/cloudflare'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { type AuthEmail, createAuth, requireFreshSession } from '../src/index.ts'
import { siteScopedAdapter } from '../src/site-adapter.ts'
import { verificationReserver } from '../src/verification-reservation.ts'
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

// 两站账户隔离（openspec split-site-accounts 决策 2、3，tasks 2.2 / 2.3）：同一个数据库，两站各自按请求创建 auth，
// 站点只来自入口。spike 1.1 的验证在 2.1 迁移落地后改为常规隔离测试；升级 Better Auth 后必须重跑本文件。

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'
const ORIGIN: Record<SiteId, string> = { east: EAST, west: WEST }

const users = testUsers('site-isolation')
const { email } = users
// 整个文件共用一个连接池：每次 createDb 都会新建最多 5 个连接，本地 PG 的连接数有限
const db = createDb(env.HYPERDRIVE)
const raw = () => db.$client

afterEach(() => {
  vi.restoreAllMocks()
})
afterAll(() => users.cleanup())

/** 一个站点的入口：与生产一样按请求创建 auth，站点只来自入口（决策 1） */
function siteClient(
  site: SiteId,
  options: { kv?: boolean; magicLink?: boolean; multiTenant?: boolean } = {},
) {
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
      config: defineTemplateConfig({
        app,
        auth: { oauth: ['google'], turnstile: false, magicLink: options.magicLink ?? false },
        tenancy: { multiTenant: options.multiTenant ?? false },
      }),
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

/** 收集 `auth.cross_site_session` 日志的层次（cookie / kv / database） */
function crossSiteWarnings() {
  const layers: string[] = []
  const original = console.warn
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const line = String(args[0])
    if (line.includes('auth.cross_site_session')) layers.push(JSON.parse(line).layer)
    else original(...args)
  })
  return { layers: () => [...layers] }
}

const usersByEmail = (address: string) =>
  raw()<
    { id: string; site: string | null }[]
  >`select id, site from "user" where email = ${address} order by site`

describe('两站账户隔离（Better Auth 1.7.7 adapter 按站点包装）', () => {
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

  it('会话不能跨站使用：Cookie 缓存、KV 与数据库三条路径都按未登录处理并记录日志（决策 3）', async () => {
    const warnings = crossSiteWarnings()
    const address = email('session')
    const east = siteClient('east')
    const west = siteClient('west')
    const signUp = await east.post('/sign-up/email', signUpBody(address))
    const cookie = cookieHeader(signUp)
    const token = (
      await raw()<{ token: string }[]>`
      select s.token from session s join "user" u on u.id=s.user_id where u.email=${address}`
    )[0]?.token
    if (!token) throw new Error('missing session')
    const own = await east.get('/get-session', { cookie })
    expect(((await own.json()) as { user: { site: string } }).user.site).toBe('east')

    // Cookie 缓存：同一密钥签名的东方站缓存 Cookie 在西方站版本不符，被丢弃后 KV 与数据库也读不到
    expect(await (await west.get('/get-session', { cookie })).json()).toBeNull()
    expect(warnings.layers()).toContain('cookie')
    // KV：键按站点命名，东方站的会话副本只在 auth:east: 下；把它搬到西方站命名空间也会被拒绝
    expect(await env.CACHE.get(`auth:east:${token}`)).toContain(token)
    expect(await env.CACHE.get(`auth:west:${token}`)).toBeNull()
    await env.CACHE.put(`auth:west:${token}`, (await env.CACHE.get(`auth:east:${token}`)) ?? '')
    try {
      const kvOnly = withoutCookieCache(cookie)
      expect(await (await west.get('/get-session', { cookie: kvOnly })).json()).toBeNull()
      expect(warnings.layers()).toContain('kv')
    } finally {
      await env.CACHE.delete(`auth:west:${token}`)
    }
    // 数据库：没有 KV 时 Better Auth 经 site-adapter 读取，关联的东方站用户被剔除
    const westDbOnly = siteClient('west', { kv: false })
    expect(
      await (await westDbOnly.get('/get-session', { cookie: withoutCookieCache(cookie) })).json(),
    ).toBeNull()
    // 应用侧直接查库的 requireFreshSession 同样拒绝，错误与「没有会话」相同
    await expect(
      requireFreshSession({ auth: west.makeAuth(), db, headers: new Headers({ cookie }) }),
    ).rejects.toMatchObject({ code: 'SESSION_REQUIRED', status: 401 })
    expect(warnings.layers()).toContain('database')
    await expect(
      requireFreshSession({ auth: east.makeAuth(), db, headers: new Headers({ cookie }) }),
    ).resolves.toMatchObject({ user: { email: address, site: 'east' } })
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
    for (const site of ['east', 'west'])
      expect(await env.CACHE.get(`auth:${site}:verification:${identifier}`)).toBeNull()
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

  it('magic link 只在本站有效：西方站打开东方站的链接不登录也不建号', async () => {
    silenceExpectedErrors(/invalid token/i, /INVALID_TOKEN/)
    const address = email('magic')
    const east = siteClient('east', { magicLink: true })
    const west = siteClient('west', { magicLink: true })
    expect((await east.post('/sign-in/magic-link', { email: address })).status).toBe(200)
    const mail = east.sent.at(-1)
    if (mail?.type !== 'magic-link') throw new Error('missing magic link')
    const link = new URL(mail.url)
    const cross = await west.get(`${link.pathname.replace('/api/auth', '')}${link.search}`)
    expect(cross.headers.get('location')).toMatch(/error/)
    expect(await usersByEmail(address)).toEqual([])
    const ok = await east.get(`${link.pathname.replace('/api/auth', '')}${link.search}`)
    expect(ok.headers.get('location')).not.toMatch(/error/)
    expect((await usersByEmail(address)).map((r) => r.site)).toEqual(['east'])
  })

  it('改邮箱的唯一校验只看本站：可改成另一站已有的邮箱，不能改成本站已有的邮箱', async () => {
    // 本应用未开启改邮箱接口；Better Auth 改邮箱时以 findUserByEmail 判重，数据库以 (site, email) 收口
    const taken = email('taken')
    const east = siteClient('east')
    const west = siteClient('west')
    expect((await west.post('/sign-up/email', signUpBody(taken))).status).toBe(200)
    const mover = email('mover')
    expect((await east.post('/sign-up/email', signUpBody(mover))).status).toBe(200)
    const eastCtx = await east.makeAuth().$context
    expect(await eastCtx.internalAdapter.findUserByEmail(taken)).toBeNull()
    const moverUser = await eastCtx.internalAdapter.findUserByEmail(mover)
    if (!moverUser) throw new Error('missing east user')
    await eastCtx.internalAdapter.updateUser(moverUser.user.id, { email: taken })
    expect((await usersByEmail(taken)).map((r) => r.site)).toEqual(['east', 'west'])
    // 同站重复：西方站再把另一个账户改成同一邮箱时被 (site, email) 唯一约束拒绝
    const other = email('other')
    expect((await west.post('/sign-up/email', signUpBody(other))).status).toBe(200)
    const westCtx = await west.makeAuth().$context
    expect((await westCtx.internalAdapter.findUserByEmail(taken))?.user).toMatchObject({
      site: 'west',
    })
    const otherUser = await westCtx.internalAdapter.findUserByEmail(other)
    if (!otherUser) throw new Error('missing west user')
    await expect(
      westCtx.internalAdapter.updateUser(otherUser.user.id, { email: taken }),
    ).rejects.toThrow()
  })

  it('站点只来自入口：请求体与查询参数中的 site 不会改变账户站点', async () => {
    const address = email('forged')
    const east = siteClient('east')
    const res = await east.post('/sign-up/email?site=west', {
      ...signUpBody(address),
      site: 'west',
    })
    expect(res.status).toBeLessThan(500)
    // input: false 的字段要么被拒绝，要么被忽略；无论哪种都不会写成西方站
    expect((await usersByEmail(address)).every((r) => r.site === 'east')).toBe(true)
  })

  it('验证值预约按站点：同一 identifier 两站各自预约，同站重复预约被拒绝', async () => {
    const identifier = `reserve-${crypto.randomUUID()}@${email('reserve').split('@')[1]}`
    const data = { identifier, value: 'proof', expiresAt: new Date(Date.now() + 60_000) }
    expect(await verificationReserver(db, 'east')(data)).toBe(true)
    expect(await verificationReserver(db, 'east')(data)).toBe(false)
    expect(await verificationReserver(db, 'west')(data)).toBe(true)
    expect(
      await raw()<
        { site: string }[]
      >`select site from verification where identifier=${identifier} order by site`,
    ).toEqual([{ site: 'east' }, { site: 'west' }])
  })

  it('个人空间属于注册所在站点', async () => {
    const address = email('personal')
    expect((await siteClient('east').post('/sign-up/email', signUpBody(address))).status).toBe(200)
    const [row] = await raw()<{ site: string; is_personal: boolean }[]>`
      select o.site, o.is_personal from organization o join "user" u on u.id=o.id where u.email=${address}`
    expect(row).toEqual({ site: 'east', is_personal: true })
  })

  it('删号只影响本站：西方站删号后东方站账户、验证码与登录不受影响', async () => {
    const address = email('delete')
    const east = siteClient('east')
    const west = siteClient('west')
    expect((await east.post('/sign-up/email', signUpBody(address))).status).toBe(200)
    const westSignUp = await west.post('/sign-up/email', signUpBody(address))
    expect(westSignUp.status).toBe(200)
    expect(
      (await east.post('/email-otp/send-verification-otp', { email: address, type: 'sign-in' }))
        .status,
    ).toBe(200)
    expect(
      (await west.post('/deletion/account', {}, { cookie: cookieHeader(westSignUp) })).status,
    ).toBe(200)
    // 西方站账户已匿名化，东方站账户原样保留
    expect((await usersByEmail(address)).map((r) => r.site)).toEqual(['east'])
    expect(
      await raw()<
        { site: string }[]
      >`select site from verification where identifier=${`sign-in-otp-${address}`}`,
    ).toEqual([{ site: 'east' }])
    expect((await east.post('/sign-in/email', { email: address, password: PASSWORD })).status).toBe(
      200,
    )
    // 本站可用同一邮箱重新注册
    expect((await west.post('/sign-up/email', signUpBody(address))).status).toBe(200)
    expect((await usersByEmail(address)).map((r) => r.site)).toEqual(['east', 'west'])
  })

  it('团队空间按站点：另一站访问返回 404，邀请只能由本站账户接受，也不能加入另一站账户', async () => {
    silenceExpectedErrors(/WORKSPACE_NOT_FOUND/, /INVALID_MEMBER/, /not found/i)
    const east = siteClient('east', { multiTenant: true })
    const west = siteClient('west', { multiTenant: true })
    const owner = await east.post('/sign-up/email', signUpBody(email('team-owner')))
    const ownerCookie = cookieHeader(owner)
    const created = await east.post(
      '/organization/create',
      { name: 'East team', slug: `east-team-${Date.now()}` },
      { cookie: ownerCookie },
    )
    expect(created.status).toBe(200)
    const team = (await created.json()) as { id: string }
    users.createdOrgs.push(team.id)
    expect(
      (await raw()<{ site: string }[]>`select site from organization where id=${team.id}`)[0],
    ).toEqual({ site: 'east' })

    // 只在西方站注册过的邮箱：邀请照常发出，但西方站账户读不到、也接受不了
    const invitee = email('team-invitee')
    const westInvitee = await west.post('/sign-up/email', signUpBody(invitee))
    const westCookie = cookieHeader(westInvitee)
    const { user: westUser } = (await westInvitee.json()) as { user: { id: string } }
    await raw()`update "user" set email_verified=true where id=${westUser.id}`
    const invited = await east.post(
      '/organization/invite-member',
      { organizationId: team.id, email: invitee, role: 'member' },
      { cookie: ownerCookie },
    )
    expect(invited.status).toBe(200)
    const invitation = (await invited.json()) as { id: string }
    expect(
      (await west.get(`/organization/get-invitation?id=${invitation.id}`, { cookie: westCookie }))
        .status,
    ).toBe(404)
    expect(
      (await west.get('/organization/list-user-invitations', { cookie: westCookie })).status,
    ).toBe(403)
    expect(
      (
        await west.post(
          '/organization/accept-invitation',
          { invitationId: invitation.id },
          { cookie: westCookie },
        )
      ).status,
    ).toBe(404)
    // 直接按 id 加入另一站账户被拒绝
    expect(
      (
        await east.post(
          '/organization/add-member',
          { organizationId: team.id, userId: westUser.id, role: 'member' },
          { cookie: ownerCookie },
        )
      ).status,
    ).toBe(403)
    // 西方站账户对东方站空间的写操作一律 404
    expect(
      (
        await west.post(
          '/organization/set-active',
          { organizationId: team.id },
          { cookie: westCookie },
        )
      ).status,
    ).toBe(404)
    const members = await raw()<
      { user_id: string }[]
    >`select user_id from member where organization_id=${team.id}`
    expect(members.map((m) => m.user_id)).not.toContain(westUser.id)
    expect(members).toHaveLength(1)
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
