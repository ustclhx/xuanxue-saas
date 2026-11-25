import type { SiteId } from '@xuanxue/config'
import { account, type Database, member, organization, user } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { ADMIN_PAGE_SIZE, adminListSearch } from './list.ts'
import { adminSiteFilter } from './site.ts'

const userListFields = {
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  banned: user.banned,
  site: user.site,
}

/**
 * 用户列表默认只列当前站点；`site: 'all'` 为只读的全部站点视图，
 * 同一邮箱在两站的账户作为两个用户分别列出（split-site-accounts 决策 7）。
 * `currentSite` 为 null（管理员 MCP 的只读查询）时不限站点；`limit` 供 MCP 分页。
 */
export async function listAdminUsers(
  db: Database,
  input: { offset?: number; limit?: number; q?: string | undefined; site?: string | undefined },
  currentSite: SiteId | null,
) {
  const { offset, q, site } = adminListSearch(['q', 'site'])(input)
  const limit = input.limit ?? ADMIN_PAGE_SIZE
  const scope = adminSiteFilter(site, currentSite)
  const where = and(
    scope ? eq(user.site, scope) : undefined,
    q
      ? or(
          ilike(user.email, `%${q}%`),
          ilike(user.name, `%${q}%`),
          ilike(sql`${user.id}::text`, `%${q}%`),
        )
      : undefined,
  )
  const rows = await db
    .select(userListFields)
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt), desc(user.id))
    .offset(offset)
    .limit(limit + 1)
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}

export async function adminUserDetail(db: Database, id: string) {
  const [target] = await db
    .select({
      ...userListFields,
      createdAt: user.createdAt,
      banReason: user.banReason,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, id))
  if (!target) throw new AppError('NOT_FOUND', 'User not found', { status: 404 })
  const workspaces = await db
    .select({
      id: organization.id,
      name: organization.name,
      role: member.role,
      site: organization.site,
      deletedAt: organization.deletedAt,
    })
    // biome-ignore lint/plugin: 平台管理员按用户查询其所属的全部空间。
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, id))
  const methods = await db
    .select({ provider: account.providerId })
    .from(account)
    .where(eq(account.userId, id))
  return { user: target, workspaces, methods: [...new Set(methods.map((m) => m.provider))] }
}
