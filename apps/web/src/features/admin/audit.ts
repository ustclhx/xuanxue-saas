import type { SiteId } from '@xuanxue/config'
import { auditLog, type Database, type JsonValue, organization, user } from '@xuanxue/db'
import { and, desc, eq, gte, lt, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ADMIN_PAGE_SIZE, adminWorkspaceIdFilter } from './list.ts'
import { ADMIN_ALL_SITES, adminSiteFilter } from './site.ts'

export const auditSearchSchema = z
  .object({
    offset: z.number().int().min(0).max(100_000),
    actor: z.string().max(200).optional(),
    workspaceId: adminWorkspaceIdFilter,
    action: z.string().max(200).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    site: z.literal(ADMIN_ALL_SITES).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'Start date must precede end date',
  })
export type AuditSearch = z.infer<typeof auditSearchSchema>

/**
 * 审计记录的站点：有空间时取空间所属站点，否则取操作人账户的站点（split-site-accounts 决策 7）。
 * 两者都没有的系统记录不属于任何站点，只在「全部站点」视图中出现。
 */
const auditSite = sql<SiteId | null>`coalesce(${organization.site}, ${user.site})`

/**
 * 操作人可用 ID / 邮箱查询；模拟期间也匹配实际管理员 ID。
 * 默认只列当前站点的记录，按邮箱筛选操作人也只匹配当前站点的账户；`site: 'all'` 为只读的全部站点视图。
 */
export async function listAuditLogs(db: Database, input: AuditSearch, currentSite: SiteId) {
  const data = auditSearchSchema.parse(input)
  const scope = adminSiteFilter(data.site, currentSite)
  const actorEmail: SQL | undefined = data.actor
    ? and(eq(user.email, data.actor), scope ? eq(user.site, scope) : undefined)
    : undefined
  const where = and(
    scope ? eq(auditSite, scope) : undefined,
    data.actor
      ? or(
          eq(sql`${auditLog.actorUserId}::text`, data.actor),
          actorEmail,
          eq(sql`${auditLog.meta}->>'impersonatedBy'`, data.actor),
        )
      : undefined,
    data.workspaceId ? eq(auditLog.workspaceId, data.workspaceId) : undefined,
    data.action ? eq(auditLog.action, data.action) : undefined,
    data.from ? gte(auditLog.createdAt, new Date(`${data.from}T00:00:00Z`)) : undefined,
    data.to
      ? lt(auditLog.createdAt, new Date(Date.parse(`${data.to}T00:00:00Z`) + 86_400_000))
      : undefined,
  )
  const rows = await db
    .select({ log: auditLog, actorEmail: user.email, site: auditSite })
    // biome-ignore lint/plugin: 已通过实时管理员守卫，审计查询允许跨空间筛选。
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .leftJoin(organization, eq(organization.id, auditLog.workspaceId))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .offset(data.offset)
    .limit(ADMIN_PAGE_SIZE + 1)
  return {
    rows: rows
      .slice(0, ADMIN_PAGE_SIZE)
      .map((row) => ({ ...row, log: { ...row.log, meta: row.log.meta as JsonValue } })),
    hasMore: rows.length > ADMIN_PAGE_SIZE,
  }
}
