import type { SiteId } from '@xuanxue/config'
import type { Database } from '@xuanxue/db'
import { newId } from '@xuanxue/shared'
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'

/**
 * Better Auth 1.7.7 reserves with a base64 SHA-256 primary key, bypassing generateId.
 * Our verification PK is UUIDv7. Serialize the non-unique, plain identifier instead.
 * Verification is database-authoritative (session.ts skips `verification:` KV keys); no KV I/O belongs here.
 *
 * 原生 SQL 不经过 site-adapter（openspec split-site-accounts 决策 2）：锁、查询、清理与插入都带上站点，
 * 同一 identifier 在两站各自预约，互不阻塞也互不消费。
 */
export function verificationReserver(db: Database, site: SiteId) {
  return async (data: { identifier: string; value: string; expiresAt: Date }) =>
    db.$client.begin(async (sql) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${`auth:reservation:${site}:${data.identifier}`}, 0))`
      const active =
        await sql`select id from verification where site=${site} and identifier=${data.identifier} and expires_at>clock_timestamp() limit 1`
      if (active.length) return false
      await sql`delete from verification where site=${site} and identifier=${data.identifier} and expires_at<=clock_timestamp()`
      await sql`insert into verification (id,identifier,value,expires_at,site,created_at,updated_at)
        values (${newId()},${data.identifier},${data.value},${data.expiresAt.toISOString()},${site},now(),now())`
      return true
    })
}

export function verificationReservation(db: Database, site: SiteId) {
  const reserve = verificationReserver(db, site)
  return {
    id: 'verification-reservation',
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            // runPluginInit rebuilds internalAdapter after init. Endpoint hooks run after
            // that rebuild for both auth.handler and auth.api, before proof cleanup.
            ctx.context.internalAdapter.reserveVerificationValue = reserve
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin
}
