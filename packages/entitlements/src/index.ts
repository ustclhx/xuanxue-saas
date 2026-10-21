import { type Database, member, organization, plan, scoped, subscription, user } from '@xuanxue/db'
import { and, eq } from 'drizzle-orm'
import { type EntitlementOptions, selectEntitlements } from './selection.ts'

export * from './selection.ts'

type EntitlementDatabase = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

/** Local, workspace-scoped reads only. The caller may retain the result within a request. */
export async function getEntitlements(
  db: EntitlementDatabase,
  workspaceId: string,
  options: EntitlementOptions = {},
) {
  const now = options.now ?? new Date()
  const subscriptions = await scoped(db, workspaceId)
    .select(subscription, {
      fields: {
        status: subscription.status,
        pastDueSince: subscription.pastDueSince,
        currentPeriodEnd: subscription.currentPeriodEnd,
        plan: { key: plan.key, sort: plan.sort, features: plan.features },
      },
    })
    .innerJoin(plan, eq(subscription.planId, plan.id))
  const free = await db.query.plan.findFirst({ where: (p, { eq }) => eq(p.key, 'free') })
  // 平台管理员的个人空间没有付费订阅时，使用内部 staff 套餐作为基线，便于在正常页面自测；
  // 付费订阅仍按既有规则优先。staff 套餐未种子化时回退到 free。
  const baseline = (await isPersonalSpaceOfPlatformAdmin(db, workspaceId))
    ? await db.query.plan.findFirst({ where: (p, { eq }) => eq(p.key, 'staff') })
    : undefined
  return selectEntitlements(subscriptions, baseline ?? free, { ...options, now })
}

/** 与 apps/web 的 admin 守卫一致：角色字段可能是逗号分隔的多个角色。 */
export function hasPlatformAdminRole(role: string | null | undefined): boolean {
  return (role ?? '').split(',').some((r) => r.trim() === 'admin')
}

async function isPersonalSpaceOfPlatformAdmin(
  db: EntitlementDatabase,
  workspaceId: string,
): Promise<boolean> {
  const [owner] = await db
    .select({ role: user.role, isPersonal: organization.isPersonal })
    .from(organization)
    .innerJoin(member, and(eq(member.organizationId, organization.id), eq(member.role, 'owner')))
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(organization.id, workspaceId))
  return owner?.isPersonal === true && hasPlatformAdminRole(owner.role)
}
