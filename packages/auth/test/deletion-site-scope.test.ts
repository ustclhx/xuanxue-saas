import { env } from 'cloudflare:workers'
import type { SiteId } from '@xuanxue/config'
import { createDb } from '@xuanxue/db'
import { newId } from '@xuanxue/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { cookieHeader, PASSWORD, setup, signUpBody, testUsers } from './helpers.ts'

const users = testUsers('deletion-site-scope')
const deleted: string[] = []
const emails: string[] = []
const db = createDb(env.HYPERDRIVE)
const sql = db.$client

afterAll(async () => {
  for (const email of emails) {
    await sql`delete from newsletter_subscriber where email=${email}`
    await sql`delete from waitlist where email=${email}`
  }
  for (const id of deleted)
    await sql`update "user" set email=${users.email('cleanup')} where id=${id}`
  await users.cleanup()
})

describe('删号的邮箱清理按站点隔离', () => {
  it.each<SiteId>(['east', 'west'])(
    '西方站删号只移除本站邀请与 %s 订阅中的本站记录',
    async (subscriberSite) => {
      const east = setup({
        site: 'east',
        cache: undefined,
        rateLimiter: undefined,
        config: { auth: { turnstile: false } },
      })
      const west = setup({
        site: 'west',
        cache: undefined,
        rateLimiter: undefined,
        config: { auth: { turnstile: false } },
      })
      const email = users.email('shared')
      const inviterEmail = users.email('inviter')
      emails.push(email)
      const accounts: { site: SiteId; id: string; invitationId: string }[] = []
      let westCookie = ''
      for (const [site, client] of [
        ['east', east],
        ['west', west],
      ] as const) {
        const target = await client.post('/sign-up/email', signUpBody(email))
        expect(target.status).toBe(200)
        const { user } = (await target.json()) as { user: { id: string } }
        if (site === 'west') {
          deleted.push(user.id)
          westCookie = cookieHeader(target)
        }
        const inviter = await client.post('/sign-up/email', signUpBody(inviterEmail))
        expect(inviter.status).toBe(200)
        const inviterId = ((await inviter.json()) as { user: { id: string } }).user.id
        const invitationId = newId()
        await sql`insert into invitation (id,organization_id,email,role,expires_at,inviter_id)
        values (${invitationId},${inviterId},${email.toUpperCase()},'member',now()+interval '1 day',${inviterId})`
        accounts.push({ site, id: user.id, invitationId })
      }
      await sql`insert into newsletter_subscriber (id,email,site,confirm_token) values (${newId()},${email},${subscriberSite},${newId()})`
      const waitlistId = newId()
      await sql`insert into waitlist (id,email) values (${waitlistId},${email})`

      expect((await west.post('/deletion/account', {}, { cookie: westCookie })).status).toBe(200)

      for (const account of accounts) {
        const [invitation] = await sql<
          { status: string }[]
        >`select status from invitation where id=${account.invitationId}`
        expect(invitation?.status).toBe(account.site === 'west' ? 'canceled' : 'pending')
      }
      const subscribers = await sql<
        { site: string }[]
      >`select site from newsletter_subscriber where email=${email}`
      expect(subscribers).toEqual(subscriberSite === 'west' ? [] : [{ site: 'east' }])
      expect(await sql`select id from waitlist where id=${waitlistId}`).toHaveLength(1)
      expect((await east.post('/sign-in/email', { email, password: PASSWORD })).status).toBe(200)
    },
  )
})
