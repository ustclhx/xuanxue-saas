import type { SiteId, TemplateConfig } from '@xuanxue/config'
import {
  type CreditPageInput,
  getCreditBalance,
  getCreditBatches,
  getCreditLedger,
} from '@xuanxue/credits'
import {
  creditGrant,
  type Database,
  member,
  organization,
  plan,
  scoped,
  subscription,
  user,
} from '@xuanxue/db'
import { getEntitlements } from '@xuanxue/entitlements'
import { AppError } from '@xuanxue/shared'
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { templateConfig } from '../../server/template-config.ts'
import { ADMIN_PAGE_SIZE, adminListSearch } from './list.ts'
import { adminSiteFilter } from './site.ts'

/** 空间列表默认只列当前站点；`site: 'all'` 为只读的全部站点视图（split-site-accounts 决策 7） */
export async function listAdminWorkspaces(
  db: Database,
  input: {
    offset?: number
    limit?: number
    q?: string | undefined
    status?: string | undefined
    site?: string | undefined
  },
  // null：管理员 MCP 的只读查询，不限站点
  currentSite: SiteId | null,
) {
  const { offset, q, status, site } = adminListSearch(['q', 'status', 'site'])(input)
  const limit = input.limit ?? ADMIN_PAGE_SIZE
  const scope = adminSiteFilter(site, currentSite)
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      isPersonal: organization.isPersonal,
      deletedAt: organization.deletedAt,
      site: organization.site,
    })
    .from(organization)
    .where(
      and(
        scope ? eq(organization.site, scope) : undefined,
        q
          ? or(
              ilike(organization.name, `%${q}%`),
              ilike(organization.slug, `%${q}%`),
              ilike(sql`${organization.id}::text`, `%${q}%`),
            )
          : undefined,
        status === 'deleted'
          ? isNotNull(organization.deletedAt)
          : status === 'active'
            ? isNull(organization.deletedAt)
            : undefined,
      ),
    )
    .orderBy(desc(organization.createdAt), desc(organization.id))
    .offset(offset)
    .limit(limit + 1)
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}

export async function getAdminWorkspaceCreditLedger(
  db: Database,
  workspaceId: string,
  input?: CreditPageInput & { offset?: number },
) {
  const { items, nextCursor } = await getCreditLedger(db, workspaceId, input)
  return {
    items: items.map(({ id, createdAt, type, delta, grantId }) => ({
      id,
      createdAt,
      type,
      delta,
      grantId,
    })),
    nextCursor,
  }
}

// MCP credits.grants：列出空间的积分批次，供 credits.adjust 收回时取 grantId
export async function listAdminWorkspaceCreditGrants(
  db: Database,
  workspaceId: string,
  input: { offset: number; limit: number; status?: 'active' | 'expired' | 'revoked' | undefined },
) {
  const rows = await scoped(db, workspaceId)
    .select(creditGrant, {
      fields: {
        id: creditGrant.id,
        source: creditGrant.source,
        amount: creditGrant.amount,
        remaining: creditGrant.remaining,
        status: creditGrant.status,
        expiresAt: creditGrant.expiresAt,
        createdAt: creditGrant.createdAt,
      },
      ...(input.status ? { where: eq(creditGrant.status, input.status) } : {}),
    })
    .orderBy(desc(creditGrant.createdAt), desc(creditGrant.id))
    .offset(input.offset)
    .limit(input.limit + 1)
  return { rows: rows.slice(0, input.limit), hasMore: rows.length > input.limit }
}

export async function adminWorkspaceDetail(
  db: Database,
  id: string,
  pastDueGraceDays: number,
  config: TemplateConfig = templateConfig,
) {
  const [workspace] = await db.select().from(organization).where(eq(organization.id, id))
  if (!workspace) throw new AppError('NOT_FOUND', 'Workspace not found', { status: 404 })
  const members = await scoped(db, id)
    .select(member, {
      fields: {
        id: member.id,
        role: member.role,
        userId: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .innerJoin(user, eq(member.userId, user.id))
  const subscriptions = config.billing.enabled
    ? await scoped(db, id)
        .select(subscription, { fields: { subscription, planName: plan.name } })
        .innerJoin(plan, eq(subscription.planId, plan.id))
        .orderBy(desc(subscription.currentPeriodEnd), desc(subscription.id))
    : []
  const [balance, batches, ledger, entitlements] = await Promise.all([
    config.credits.enabled ? getCreditBalance(db, id) : null,
    config.credits.enabled ? getCreditBatches(db, id) : { items: [], nextCursor: null },
    config.credits.enabled
      ? getAdminWorkspaceCreditLedger(db, id)
      : { items: [], nextCursor: null },
    config.billing.enabled ? getEntitlements(db, id, { pastDueGraceDays }) : null,
  ])
  return { workspace, members, subscriptions, balance, batches, ledger, entitlements }
}
