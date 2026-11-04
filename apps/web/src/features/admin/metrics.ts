import { SITE_IDS, type SiteId } from '@xuanxue/config'
import { type Database, metricsDaily } from '@xuanxue/db'
import { and, asc, gte, lte } from 'drizzle-orm'
import { z } from 'zod'

export interface SiteMetrics {
  readonly site: SiteId
  readonly registrations: number
  readonly totalUsers: number
  readonly totalWorkspaces: number
  readonly paidWorkspaces: number
  readonly paidConversion: number | null
}

/**
 * 按站点的用户数与付费数（split-site-accounts 决策 7）。metrics_daily 以日期为主键、不分站点，
 * 本 change 不新增迁移，因此在打开看板时按区间末日的日末状态现算，口径与 jobs 的
 * metrics-daily Cron 一致（注册数为区间内增量，其余为区间末日日末存量）。只在管理员打开看板时查询，
 * 不增加定时查库（Neon 缩容到零的成本基线不受影响）。
 */
export async function readSiteMetrics(
  db: Database,
  range: { from: string; to: string },
): Promise<SiteMetrics[]> {
  const start = new Date(`${range.from}T00:00:00.000Z`).toISOString()
  const end = new Date(Date.parse(`${range.to}T00:00:00.000Z`) + 86_400_000).toISOString()
  return db.$client.begin('isolation level repeatable read read only', async (sql) => {
    const users = await sql<{ site: SiteId; registrations: number; total: number }[]>`
      select site, count(*) filter (where created_at >= ${start})::int as registrations,
        count(*)::int as total from "user" where created_at < ${end} group by site`
    const spaces = await sql<{ site: SiteId; total: number }[]>`
      select site, count(*)::int as total from organization where created_at < ${end}
        and (deleted_at is null or deleted_at >= ${end}) group by site`
    const paid = await sql<{ site: SiteId; total: number }[]>`
      select o.site, count(distinct s.workspace_id)::int as total
      from subscription s join plan_price p on p.id=s.plan_price_id
      join organization o on o.id=s.workspace_id
      where s.created_at < ${end} and p.amount>0 and p.interval in ('month','year')
        and s.status in ('active','canceled','expired')
        and s.current_period_start < ${end} and s.current_period_end >= ${end}
        and (o.deleted_at is null or o.deleted_at >= ${end})
      group by o.site`
    return SITE_IDS.map((site) => {
      const user = users.find((row) => row.site === site)
      const totalWorkspaces = spaces.find((row) => row.site === site)?.total ?? 0
      const paidWorkspaces = paid.find((row) => row.site === site)?.total ?? 0
      return {
        site,
        registrations: user?.registrations ?? 0,
        totalUsers: user?.total ?? 0,
        totalWorkspaces,
        paidWorkspaces,
        paidConversion: totalWorkspaces ? paidWorkspaces / totalWorkspaces : null,
      }
    })
  })
}

export const metricsSearchSchema = z
  .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'Invalid date range',
  })

export async function readAdminMetrics(
  db: Database,
  input: z.infer<typeof metricsSearchSchema>,
  now = new Date(),
) {
  const data = metricsSearchSchema.parse(input)
  const to = data.to ?? new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
  const from =
    data.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10)
  // 看板只读已汇总数据；存量采用区间最后一日，增量求和，成功率按样本加权。
  const rows = await db
    .select()
    .from(metricsDaily)
    .where(and(gte(metricsDaily.day, from), lte(metricsDaily.day, to)))
    .orderBy(asc(metricsDaily.day))
  const overageByModel: Record<string, number> = {}
  let registrations = 0,
    creditsConsumed = 0,
    overageAbsorbed = 0,
    completed = 0,
    attempts = 0
  for (const row of rows) {
    registrations += row.registrations
    creditsConsumed += row.creditsConsumed
    overageAbsorbed += row.overageAbsorbed
    completed += row.textCompleted
    attempts += row.textCompleted + row.textFailed + row.textAborted
    for (const [model, value] of Object.entries(row.overageByModel))
      overageByModel[model] = (overageByModel[model] ?? 0) + value
  }
  const latest = rows.at(-1) ?? null
  return {
    rows,
    bySite: await readSiteMetrics(db, { from, to }),
    from,
    to,
    latest,
    registrations,
    creditsConsumed,
    overageAbsorbed,
    overageByModel,
    successRate: attempts ? completed / attempts : null,
    attempts,
    paidConversion: latest?.totalWorkspaces ? latest.paidWorkspaces / latest.totalWorkspaces : null,
  }
}
