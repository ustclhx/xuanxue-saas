import { newId } from '@xuanxue/shared'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { listAuditLogs } from '../src/features/admin/audit.ts'
import { readAdminMetrics } from '../src/features/admin/metrics.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

const db = createAdminTestDb()
const uid = newId(),
  workspaceId = newId(),
  action = `test.audit.${newId()}`
const email = `${uid}@audit-query.test`
const days = ['2002-03-01', '2002-03-02', '2002-03-03']
// 按站点指标：区间放在 1998 年，统计结果只包含本测试的数据
const siteUsers = { west: [newId(), newId()], east: [newId(), newId(), newId()] }
const siteSpaces = { west: [newId()], east: [newId(), newId()] }
const sitePlan = newId(),
  sitePrice = newId()
beforeAll(async () => {
  const sql = db.$client
  await sql`insert into "user" (id,name,email,site) values (${uid},'Audit',${email},'west')`
  await sql`insert into organization (id,name,slug,site) values (${workspaceId},'Audit',${workspaceId},'west')`
  for (let i = 0; i < 52; i++)
    await sql`insert into audit_log (id,actor_user_id,workspace_id,action,created_at) values (${newId()},${uid},${workspaceId},${action},${new Date(Date.parse('2002-03-02T00:00:00Z') + i * 1000).toISOString()})`
  for (const day of ['2002-03-01T23:59:59Z', '2002-03-03T00:00:00Z'])
    await sql`insert into audit_log (id,actor_user_id,workspace_id,action,created_at) values (${newId()},${uid},${workspaceId},${action},${day})`
  for (const [i, day] of days.entries())
    await sql`insert into metrics_daily (day,registrations,total_users,total_workspaces,paid_workspaces,mrr_by_currency,credits_consumed,daily_grant_count,daily_grant_credits,overage_absorbed,overage_by_model,text_completed,text_failed,text_aborted,data_through)
    values (${day},${i + 1},20,10,${i + 1},${JSON.stringify({ USD: 1200 * (i + 1) })}::jsonb,${100 * (i + 1)},${i + 1},${10 * (i + 1)},${10 * (i + 1)},${JSON.stringify({ model: 10 * (i + 1) })}::jsonb,${i === 1 ? 1 : 9},1,0,${new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString()})`
})
beforeAll(async () => {
  const sql = db.$client
  for (const [site, ids] of Object.entries(siteUsers))
    for (const [i, id] of ids.entries())
      await sql`insert into "user" (id,name,email,site,created_at) values (${id},'Site metrics',${`${id}@site-metrics.test`},${site},${i === 0 ? '1998-01-01T00:00:00Z' : '1998-02-10T12:00:00Z'})`
  for (const [site, ids] of Object.entries(siteSpaces))
    for (const id of ids)
      await sql`insert into organization (id,name,slug,site,created_at) values (${id},'Site metrics',${id},${site},'1998-01-01T00:00:00Z')`
  await sql`insert into plan (id,key,name,type,credits,features) values (${sitePlan},${sitePlan},'Site metrics','subscription',100,'{}')`
  await sql`insert into plan_price (id,plan_id,provider,provider_price_id,interval,amount,currency) values (${sitePrice},${sitePlan},'stripe',${sitePrice},'month',1200,'USD')`
  await sql`insert into subscription (id,workspace_id,plan_id,plan_price_id,provider,provider_subscription_id,status,cancel_at_period_end,current_period_start,current_period_end,last_event_at,created_at)
    values (${newId()},${siteSpaces.east[0] ?? ''},${sitePlan},${sitePrice},'stripe',${newId()},'active',false,'1998-02-01T00:00:00Z','1998-03-01T00:00:00Z','1998-02-01T00:00:00Z','1998-02-01T00:00:00Z')`
})
afterAll(async () => {
  const sql = createAdminTestDb('migrator').$client
  const spaces = [...siteSpaces.west, ...siteSpaces.east]
  await sql`delete from subscription where workspace_id in ${sql(spaces)}`
  await sql`delete from plan_price where id=${sitePrice}`
  await sql`delete from plan where id=${sitePlan}`
  await sql`delete from organization where id in ${sql(spaces)}`
  await sql`delete from "user" where id in ${sql([...siteUsers.west, ...siteUsers.east])}`
  await sql`delete from audit_log where workspace_id=${workspaceId}`
  await sql`delete from metrics_daily where day in ${sql(days)}`
  await sql`delete from organization where id=${workspaceId}`
  await sql`delete from "user" where id=${uid}`
})
it('审计操作人、空间、动作、UTC 时间组合筛选与服务端分页', async () => {
  const filter = {
    offset: 0,
    actor: email,
    workspaceId,
    action,
    from: '2002-03-02',
    to: '2002-03-02',
  }
  const first = await listAuditLogs(db, filter, 'west')
  expect(first.rows).toHaveLength(50)
  expect(first.hasMore).toBe(true)
  expect(first.rows[0]?.log.createdAt.toISOString()).toBe('2002-03-02T00:00:51.000Z')
  const second = await listAuditLogs(db, { ...filter, actor: uid, offset: 50 }, 'west')
  expect(second.rows.map((row) => row.log.createdAt.toISOString())).toEqual([
    '2002-03-02T00:00:01.000Z',
    '2002-03-02T00:00:00.000Z',
  ])
  expect(second.hasMore).toBe(false)
  expect((await listAuditLogs(db, { ...filter, action: 'unmatched' }, 'west')).rows).toEqual([])
})
it('看板按区间累计增量、按样本加权成功率、取最后一日存量并显示数据截止时间', async () => {
  const data = await readAdminMetrics(db, { from: days[0], to: days[1] })
  expect(data).toMatchObject({
    registrations: 3,
    creditsConsumed: 300,
    dailyGrantCount: 3,
    dailyGrantCredits: 30,
    overageAbsorbed: 30,
    overageByModel: { model: 30 },
    successRate: 10 / 12,
    attempts: 12,
    paidConversion: 0.2,
    latest: { paidWorkspaces: 2, mrrByCurrency: { USD: 2400 } },
  })
  expect(data.latest?.dataThrough.toISOString()).toBe('2002-03-03T00:00:00.000Z')
  expect(
    (await readAdminMetrics(db, { from: '2002-04-01', to: '2002-04-02' })).successRate,
  ).toBeNull()
})
it('看板按站点统计注册数、用户数、空间数与付费数', async () => {
  const data = await readAdminMetrics(db, { from: '1998-02-01', to: '1998-02-14' })
  expect(data.bySite).toEqual([
    {
      site: 'east',
      registrations: 2,
      totalUsers: 3,
      totalWorkspaces: 2,
      paidWorkspaces: 1,
      paidConversion: 0.5,
    },
    {
      site: 'west',
      registrations: 1,
      totalUsers: 2,
      totalWorkspaces: 1,
      paidWorkspaces: 0,
      paidConversion: 0,
    },
  ])
})
