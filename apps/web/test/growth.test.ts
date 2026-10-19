import { env } from 'cloudflare:workers'
import { createAuth } from '@xuanxue/auth'
import { defineTemplateConfig } from '@xuanxue/config'
import { auditLog, createDb, newsletterSubscriber, setting, user, waitlist } from '@xuanxue/db'
import type { EmailQueueMessage } from '@xuanxue/email/queue'
import { AppError, newId } from '@xuanxue/shared'
import { APIError } from 'better-auth/api'
import { eq, like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { runAdminAction } from '../src/features/admin/action.ts'
import { type GrowthRuntime, newsletterLink, submitGrowth } from '../src/features/growth/http.ts'
import {
  assertSignupAdmission,
  type GrowthContext,
  joinWaitlist,
  newsletterSendingList,
  newsletterUnsubscribeUrl,
  prepareWaitlistInvitations,
  sendWaitlistInvitations,
  subscribeNewsletter,
  updateNewsletterStatus,
} from '../src/features/growth/service.ts'
import type { ReadingOptin } from '../src/features/readings/optin-schema.ts'
import { templateConfig } from '../src/server/template-config.ts'

const domain = `${newId()}.growth.test`
const db = createDb(env.HYPERDRIVE)
const appUrl = 'http://localhost:3000'
const config = defineTemplateConfig({
  app: { name: 'Test', url: appUrl, supportEmail: 'help@example.test' },
  auth: { oauth: ['google'], turnstile: false },
  features: { waitlist: true, newsletter: true },
})
const messages: EmailQueueMessage[] = []
const ctx: GrowthContext = {
  db,
  config,
  secret: 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
  appUrl,
  queue: {
    available: true,
    value: {
      send: async (message) => {
        messages.push(message)
      },
    },
  },
}
const email = () => `${newId()}@${domain}`
const runtime: GrowthRuntime = {
  config: { APP_URL: appUrl, BETTER_AUTH_SECRET: ctx.secret, TURNSTILE_SECRET_KEY: undefined },
  db,
  emailQueue: { available: false },
  rateLimiter: { limit: async () => ({ success: true }) },
  requestMeta: { clientIp: '192.0.2.1', requestId: newId() },
}
function request(address: string) {
  return new Request(`${appUrl}/api/waitlist`, {
    method: 'POST',
    body: JSON.stringify({ email: address }),
  })
}

function auth() {
  return createAuth(
    {
      APP_URL: appUrl,
      BETTER_AUTH_SECRET: ctx.secret,
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    },
    db,
    {
      config,
      sendEmail: async () => {},
      beforeUserCreate: async (account, headers) => {
        try {
          await assertSignupAdmission(ctx, account.email, headers)
        } catch (error) {
          if (error instanceof AppError)
            throw APIError.from('FORBIDDEN', { code: error.code, message: error.message })
          throw error
        }
      },
    },
  )
}
const post = (
  instance: ReturnType<typeof auth>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  instance.handler(
    new Request(`${appUrl}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: appUrl, ...headers },
      body: JSON.stringify(body),
    }),
  )
const closed = () =>
  db
    .insert(setting)
    .values({ key: 'auth.signupEnabled', value: false })
    .onConflictDoUpdate({ target: setting.key, set: { value: false } })

async function invite(address: string) {
  await joinWaitlist(ctx, address)
  const [row] = await db.select().from(waitlist).where(eq(waitlist.email, address))
  if (!row) throw new Error('Missing waitlist row')
  const nonce = newId()
  const expires = new Date(Date.now() + 86400_000)
  await db
    .update(waitlist)
    .set({ invitationNonce: nonce, invitationExpiresAt: expires, invitedAt: new Date() })
    .where(eq(waitlist.id, row.id))
  await sendWaitlistInvitations(ctx, [
    { ...row, invitationNonce: nonce, invitationExpiresAt: expires, invitedAt: new Date() },
  ])
  const message = messages.at(-1)
  if (message?.template !== 'waitlist-invitation') throw new Error('Missing invite email')
  return new URL(message.props.url).searchParams.get('token') ?? ''
}

afterAll(async () => {
  await db.delete(setting).where(eq(setting.key, 'auth.signupEnabled'))
  await db.delete(waitlist).where(like(waitlist.email, `%@${domain}`))
  await db.delete(newsletterSubscriber).where(like(newsletterSubscriber.email, `%@${domain}`))
  const sql = db.$client
  const users = await sql<{ id: string }[]>`select id from "user" where email like ${`%@${domain}`}`
  const ids = users.map((row) => row.id)
  if (!ids.length) return
  await createDb(env.HYPERDRIVE_MIGRATOR)
    .$client`delete from audit_log where actor_user_id in ${sql(ids)}`
  await sql`delete from session where user_id in ${sql(ids)}`
  await sql`delete from account where user_id in ${sql(ids)}`
  await sql`delete from member where user_id in ${sql(ids)}`
  await sql`delete from organization where id in ${sql(ids)}`
  await sql`delete from "user" where id in ${sql(ids)}`
})

describe('Waitlist', () => {
  it('normalizes and deduplicates concurrent public submissions; rate limit and Turnstile reject before insertion', async () => {
    const address = email()
    const responses = await Promise.all([
      submitGrowth(request(address.toUpperCase()), 'waitlist', runtime, ctx),
      submitGrowth(request(` ${address} `), 'waitlist', runtime, ctx),
    ])
    expect(responses.map((res) => res.status)).toEqual([200, 200])
    expect(await db.select().from(waitlist).where(eq(waitlist.email, address))).toHaveLength(1)
    const limited = {
      ...runtime,
      rateLimiter: { limit: async () => ({ success: false }) },
    }
    expect((await submitGrowth(request(email()), 'waitlist', limited, ctx)).status).toBe(429)
    const protectedCtx = {
      ...ctx,
      config: { ...config, auth: { ...config.auth, turnstile: true } },
    }
    expect((await submitGrowth(request(email()), 'waitlist', runtime, protectedCtx)).status).toBe(
      403,
    )
  })

  it('uses trusted runtime IP for rate limiting with Turnstile disabled and ignores forwarded headers', async () => {
    const calls: [string, string][] = []
    const trustedRuntime: GrowthRuntime = {
      ...runtime,
      rateLimiter: {
        limit: async (policy, key) => {
          calls.push([policy, key])
          return { success: !key.includes(':email:') }
        },
      },
    }
    const address = email()
    const forged = request(address)
    forged.headers.set('cf-connecting-ip', '198.51.100.9')
    forged.headers.set('x-forwarded-for', '198.51.100.9')
    expect((await submitGrowth(forged, 'waitlist', trustedRuntime, ctx)).status).toBe(429)
    expect(calls).toEqual([
      ['auth', 'waitlist:ip:192.0.2.1'],
      ['auth', expect.stringMatching(/^waitlist:email:[a-f0-9]{64}$/)],
    ])
    expect(await db.select().from(waitlist).where(eq(waitlist.email, address))).toHaveLength(0)
  })

  it('prepares a selected batch with an audit and queues invitations after commit', async () => {
    const instance = auth()
    const result = await post(instance, '/sign-up/email', {
      email: email(),
      password: 'password-for-testing',
      name: 'admin',
    })
    expect(result.status).toBe(200)
    const account = (await result.json()) as { user: { id: string } }
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, account.user.id))
    const address = email()
    await joinWaitlist(ctx, address)
    const [row] = await db.select().from(waitlist).where(eq(waitlist.email, address))
    if (!row) throw new Error('Missing waitlist row')
    const rows = await runAdminAction({ db, admin: account.user }, 'waitlist.invite', (scope) =>
      prepareWaitlistInvitations(scope, [row.id]),
    )
    await sendWaitlistInvitations(ctx, rows)
    expect(messages.at(-1)).toMatchObject({ to: address, template: 'waitlist-invitation' })
    expect(
      await db.select().from(auditLog).where(eq(auditLog.actorUserId, account.user.id)),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'waitlist.invited' })]))
  })

  it('closed email registration rejects uninvited or mismatched email and accepts a bound invitation', async () => {
    await closed()
    const instance = auth()
    const address = email()
    const token = await invite(address)
    const body = { name: 'Guest', email: address, password: 'password-for-testing' }
    const denied = await post(instance, '/sign-up/email', body)
    expect(denied.status).toBe(403)
    expect(await denied.json()).toMatchObject({ code: 'SIGNUP_DISABLED' })
    expect(
      (
        await post(
          instance,
          '/sign-up/email',
          { ...body, email: email() },
          { 'x-waitlist-invitation': token },
        )
      ).status,
    ).toBe(403)
    expect(
      (await post(instance, '/sign-up/email', body, { cookie: `waitlist-invitation=${token}` }))
        .status,
    ).toBe(200)
  })

  it('closed OAuth first login rejects without invitation and accepts the matching invited email', async () => {
    await closed()
    async function oauth(address: string, invitation?: string) {
      const instance = auth()
      const context = await instance.$context
      const provider = context.socialProviders.find((entry) => entry.id === 'google')
      if (!provider) throw new Error('Missing mock provider')
      Object.assign(provider, {
        validateAuthorizationCode: async () => ({
          accessToken: 'mock-access',
          refreshToken: 'mock-refresh',
          idToken: 'mock-id',
        }),
        getUserInfo: async () => ({
          user: { id: newId(), name: 'OAuth Guest', email: address, emailVerified: true },
          data: { sub: newId() },
        }),
      })
      const start = await post(instance, '/sign-in/social', {
        provider: 'google',
        callbackURL: '/app',
        errorCallbackURL: '/login',
      })
      const data = (await start.json()) as { url: string }
      const state = new URL(data.url).searchParams.get('state')
      const cookies = start.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ')
      return instance.handler(
        new Request(`${appUrl}/api/auth/callback/google?code=mock-code&state=${state}`, {
          headers: {
            cookie: `${cookies}${invitation ? `; waitlist-invitation=${invitation}` : ''}`,
          },
        }),
      )
    }
    const deniedEmail = email()
    const denied = await oauth(deniedEmail)
    expect(denied.status).toBe(302)
    expect(denied.headers.get('location')).toContain('error=')
    expect(await db.select().from(user).where(eq(user.email, deniedEmail))).toHaveLength(0)
    const address = email()
    const accepted = await oauth(address, await invite(address))
    expect(accepted.status).toBe(302)
    expect(accepted.headers.get('location')).toContain('/app')
    expect(await db.select().from(user).where(eq(user.email, address))).toHaveLength(1)
  })
})

describe('增长邮件收件人语言', () => {
  it('已注册中文收件人的 waitlist 邀请和 newsletter 确认均以账号语言入队', async () => {
    const address = email()
    await db
      .insert(user)
      .values({ id: newId(), name: '中文订阅者', email: address, locale: 'zh-Hant' })
    await invite(address)
    expect(messages.at(-1)).toMatchObject({
      template: 'waitlist-invitation',
      locale: 'zh-Hant',
      to: address,
    })
    await subscribeNewsletter(ctx, address)
    expect(messages.at(-1)).toMatchObject({
      template: 'newsletter-confirmation',
      locale: 'zh-Hant',
      to: address,
    })
  })
})

describe('Newsletter', () => {
  it('excludes pending and unsubscribed addresses, requires fresh confirmation after resubscription, and accepts one-click POST', async () => {
    const address = email()
    await subscribeNewsletter(ctx, address)
    const confirmation = messages.at(-1)
    if (confirmation?.template !== 'newsletter-confirmation')
      throw new Error('Missing confirmation')
    const token = new URL(confirmation.props.url).searchParams.get('token') ?? ''
    expect(await newsletterSendingList(ctx)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ email: address })]),
    )
    await updateNewsletterStatus(ctx, token, 'confirm')
    const [row] = await db
      .select()
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.email, address))
    if (!row) throw new Error('Missing subscriber')
    expect(await newsletterSendingList(ctx)).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: address })]),
    )
    const url = await newsletterUnsubscribeUrl(ctx, row.id)
    const response = await newsletterLink(
      new Request(url, { method: 'POST', body: 'List-Unsubscribe=One-Click' }),
      'unsubscribe',
      ctx,
    )
    expect(response.status).toBe(200)
    expect(await newsletterSendingList(ctx)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ email: address })]),
    )
    await expect(updateNewsletterStatus(ctx, token, 'confirm')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    })
    await subscribeNewsletter(ctx, address)
    await expect(updateNewsletterStatus(ctx, token, 'confirm')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    })
    const renewed = messages.at(-1)
    if (renewed?.template !== 'newsletter-confirmation')
      throw new Error('Missing renewed confirmation')
    await updateNewsletterStatus(
      ctx,
      new URL(renewed.props.url).searchParams.get('token') ?? '',
      'confirm',
    )
    expect(await newsletterSendingList(ctx)).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: address })]),
    )
    const tampered = `${url.slice(0, -1)}!`
    expect((await newsletterLink(new Request(tampered), 'unsubscribe', ctx)).status).toBe(400)
  })

  it('rejects unavailable email capability before newsletter writes while allowing waitlist joins', async () => {
    const unavailable: GrowthContext = { ...ctx, queue: { available: false } }
    const address = email()
    const response = await submitGrowth(request(address), 'newsletter', runtime, unavailable)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: { code: 'CAPABILITY_UNAVAILABLE' } })
    expect(
      await db.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.email, address)),
    ).toHaveLength(0)
    expect((await submitGrowth(request(address), 'waitlist', runtime, unavailable)).status).toBe(
      200,
    )
    expect(await db.select().from(waitlist).where(eq(waitlist.email, address))).toHaveLength(1)

    await subscribeNewsletter(ctx, address)
    const [before] = await db
      .select()
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.email, address))
    if (!before) throw new Error('Missing subscriber')
    await db
      .update(newsletterSubscriber)
      .set({ status: 'unsubscribed' })
      .where(eq(newsletterSubscriber.id, before.id))
    await expect(subscribeNewsletter(unavailable, address)).rejects.toMatchObject({
      code: 'CAPABILITY_UNAVAILABLE',
    })
    const [after] = await db
      .select()
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.id, before.id))
    expect(after).toMatchObject({ status: 'unsubscribed', confirmToken: before.confirmToken })
  })

  it('returns 404 for disabled public submission and email links before parsing input', async () => {
    const disabled = { ...ctx, config: defineTemplateConfig({ app: config.app }) }
    for (const feature of ['waitlist', 'newsletter'] as const)
      expect(
        (
          await submitGrowth(
            new Request(`${appUrl}/api/${feature}`, { method: 'POST', body: 'bad json' }),
            feature,
            runtime,
            disabled,
          )
        ).status,
      ).toBe(404)
    expect(
      (
        await newsletterLink(
          new Request(`${appUrl}/api/newsletter/confirm?token=bad`),
          'confirm',
          disabled,
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await newsletterLink(
          new Request(`${appUrl}/api/newsletter/unsubscribe?token=bad`),
          'unsubscribe',
          disabled,
        )
      ).status,
    ).toBe(404)
  })
})

const readingCtx: GrowthContext = {
  ...ctx,
  config: { ...config, sites: templateConfig.sites, i18n: templateConfig.i18n },
}
const baziOptin: ReadingOptin = {
  name: '小林',
  sourceTool: 'bazi',
  topic: 'career',
  site: 'east',
  locale: 'zh-Hant',
  result: { kind: 'bazi', dayMaster: 'geng' },
  share: { year: '1990', month: '5', day: '15' },
}
async function subscriber(address: string) {
  const [row] = await db
    .select()
    .from(newsletterSubscriber)
    .where(eq(newsletterSubscriber.email, address))
  if (!row) throw new Error('Missing subscriber')
  return row
}
function confirmationToken(address: string) {
  const message = messages
    .filter((message) => message.to === address && message.template === 'newsletter-confirmation')
    .at(-1)
  if (message?.template !== 'newsletter-confirmation') throw new Error('Missing confirmation')
  return new URL(message.props.url).searchParams.get('token') ?? ''
}

describe('结果订阅与解读投递', () => {
  it('保存来源与临时结果；确认前仅发确认邮件，并发确认后只入队一封本语言解读并清空结果', async () => {
    const address = email()
    const response = await submitGrowth(
      new Request(`${appUrl}/api/newsletter`, {
        method: 'POST',
        body: JSON.stringify({ email: address.toUpperCase(), reading: baziOptin }),
      }),
      'newsletter',
      runtime,
      readingCtx,
    )
    expect(response.status).toBe(200)
    expect(await subscriber(address)).toMatchObject({
      status: 'pending',
      sourceTool: 'bazi',
      topic: 'career',
      locale: 'zh-Hant',
      site: 'east',
      lastResult: { name: '小林', result: { kind: 'bazi', dayMaster: 'geng' } },
    })
    expect(messages.filter((message) => message.to === address)).toMatchObject([
      { template: 'newsletter-confirmation', locale: 'zh-Hant' },
    ])
    const token = confirmationToken(address)
    await Promise.all([
      updateNewsletterStatus(readingCtx, token, 'confirm'),
      updateNewsletterStatus(readingCtx, token, 'confirm'),
    ])
    await updateNewsletterStatus(readingCtx, token, 'confirm')
    const summaries = messages.filter(
      (message) => message.to === address && message.template === 'reading-summary',
    )
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      locale: 'zh-Hant',
      props: {
        name: '小林',
        paragraphs: [expect.stringContaining('庚金'), expect.stringContaining('工作')],
      },
    })
    expect((await subscriber(address)).lastResult).toBeNull()
  })

  it('已确认邮箱从塔罗再次订阅只更新同一记录并直接发送，不重新确认', async () => {
    const address = email()
    await subscribeNewsletter(readingCtx, address, baziOptin)
    await updateNewsletterStatus(readingCtx, confirmationToken(address), 'confirm')
    const before = await subscriber(address)
    const start = messages.length
    await subscribeNewsletter(readingCtx, address.toUpperCase(), {
      ...baziOptin,
      sourceTool: 'tarot-daily',
      site: 'west',
      locale: 'en',
      topic: 'love',
      result: { kind: 'tarot', cards: [{ cardId: 'major-00', reversed: false }] },
      share: { reading: 'fixture' },
    })
    expect(await subscriber(address)).toMatchObject({
      id: before.id,
      confirmToken: before.confirmToken,
      status: 'confirmed',
      sourceTool: 'tarot-daily',
      site: 'west',
      locale: 'en',
      topic: 'love',
      lastResult: null,
    })
    expect(messages.slice(start)).toMatchObject([
      { to: address, template: 'reading-summary', locale: 'en' },
    ])
    expect(
      await db.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.email, address)),
    ).toHaveLength(1)
  })

  it('解读入队失败保留结果，重试使用同一幂等键', async () => {
    const address = email()
    await subscribeNewsletter(readingCtx, address, baziOptin)
    const token = confirmationToken(address)
    const keys: string[] = []
    const failed: GrowthContext = {
      ...readingCtx,
      queue: {
        available: true,
        value: {
          send: async (message) => {
            keys.push(message.idempotencyKey)
            throw new Error('Queue unavailable')
          },
        },
      },
    }
    await expect(updateNewsletterStatus(failed, token, 'confirm')).rejects.toThrow(
      'Queue unavailable',
    )
    const pending = await subscriber(address)
    expect(pending.lastResult).toMatchObject({ result: baziOptin.result })
    const recovery: GrowthContext = {
      ...readingCtx,
      queue: {
        available: true,
        value: {
          send: async (message) => {
            keys.push(message.idempotencyKey)
            messages.push(message)
          },
        },
      },
    }
    await updateNewsletterStatus(recovery, token, 'confirm')
    expect(keys[0]).toBe(keys[1])
    expect((await subscriber(address)).lastResult).toBeNull()
  })

  it('未确认者再次提交保存最新偏好，退订会清除结果且重新订阅必须重新确认', async () => {
    const address = email()
    await subscribeNewsletter(readingCtx, address, baziOptin)
    const token = confirmationToken(address)
    await subscribeNewsletter(readingCtx, address, {
      ...baziOptin,
      topic: 'growth',
      locale: 'ko',
      sourceTool: 'manseryeok',
    })
    await updateNewsletterStatus(readingCtx, token, 'confirm')
    expect(
      messages.filter(
        (message) => message.to === address && message.template === 'reading-summary',
      ),
    ).toMatchObject([{ locale: 'ko' }])
    const row = await subscriber(address)
    const url = await newsletterUnsubscribeUrl(readingCtx, row.id)
    await updateNewsletterStatus(
      readingCtx,
      new URL(url).searchParams.get('token') ?? '',
      'unsubscribe',
    )
    await subscribeNewsletter(readingCtx, address, baziOptin)
    await expect(updateNewsletterStatus(readingCtx, token, 'confirm')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    })
    expect((await subscriber(address)).status).toBe('pending')
    expect((await subscriber(address)).lastResult).not.toBeNull()
  })

  it('拒绝无效工具与模板结果，复用公开入口限流与人机校验', async () => {
    const address = email()
    const req = (reading: unknown) =>
      new Request(`${appUrl}/api/newsletter`, {
        method: 'POST',
        body: JSON.stringify({ email: address, reading }),
      })
    expect(
      (
        await submitGrowth(
          req({ ...baziOptin, result: { kind: 'bazi', dayMaster: 'invalid' } }),
          'newsletter',
          runtime,
          readingCtx,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await submitGrowth(
          req({ ...baziOptin, sourceTool: 'https://evil.test' }),
          'newsletter',
          runtime,
          readingCtx,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await submitGrowth(
          req(baziOptin),
          'newsletter',
          { ...runtime, rateLimiter: { limit: async () => ({ success: false }) } },
          readingCtx,
        )
      ).status,
    ).toBe(429)
    expect(
      (
        await submitGrowth(req(baziOptin), 'newsletter', runtime, {
          ...readingCtx,
          config: { ...readingCtx.config, auth: { ...readingCtx.config.auth, turnstile: true } },
        })
      ).status,
    ).toBe(403)
    expect(
      await db.select().from(newsletterSubscriber).where(eq(newsletterSubscriber.email, address)),
    ).toHaveLength(0)
  })
})
