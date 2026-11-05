import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../../packages/db/package.json', import.meta.url))
const eastKinds = ['bazi-full', 'ziwei-full', 'saju-full', 'saju-compat']
const kinds = [...eastKinds, 'numerology-full', 'tarot-spread']

function localeSite(locale, payment = false) {
  if (['zh-Hant', 'zh-Hans', 'ko'].includes(locale)) return 'east'
  if (locale === 'en') return 'west'
  // 支付商会把站点语言规范化为 zh-TW / zh-CN / ko-KR / en-US。
  if (payment && /^(zh|ko)(-|$)/i.test(locale ?? '')) return 'east'
  if (payment && /^en(-|$)/i.test(locale ?? '')) return 'west'
  return null
}

function paymentSites(evidence) {
  const sites = new Set()
  for (const { locale, description } of evidence) {
    const site = localeSite(locale, true)
    if (site) sites.add(site)
    if (
      /ganjiday|干支日|간지데이|bazi|ziwei|saju|八字|紫微|四柱|宫合|宮合/i.test(description ?? '')
    )
      sites.add('east')
    if (/arcanumber|numerology|灵数|靈數/i.test(description ?? '')) sites.add('west')
  }
  return sites
}

/** Owner 2026-11-03 决定；reports 为各类型行数，塔罗不参与判定。 */
export function classifyPrimarySite({ reports = {}, payments = [], locale = null } = {}) {
  const east = eastKinds.reduce((sum, kind) => sum + (reports[kind] ?? 0), 0)
  const west = reports['numerology-full'] ?? 0
  if (east + west > 0)
    return { site: east > west ? 'east' : 'west', rule: 1, bothSitesActive: east > 0 && west > 0 }
  const sites = paymentSites(payments)
  // Owner 未定义两站付款冲突的取舍；保留未决，不能自行套用报告的平手规则。
  if (sites.size > 1) return { site: null, rule: 2, bothSitesActive: false }
  if (sites.size === 1) return { site: [...sites][0], rule: 2, bothSitesActive: false }
  const site = localeSite(locale)
  return { site: site ?? 'west', rule: site ? 3 : 4, bothSitesActive: false }
}

// 只提取支付快照与 webhook envelope 内的语言和描述，不读取或输出身份与支付凭据。
const paymentEvidence = (column) => `jsonb_path_query_array(${column},
  '$.** ? (@.type() == "object").keyvalue() ? (@.key == "locale" || @.key == "description")')`

function decodeEvidence(values) {
  return (values ?? []).map(({ key, value }) => ({ [key]: value }))
}

export async function collectPreflight(connection) {
  const skipped = []
  // SAVEPOINT 仅用于恢复 42501 后的事务；所有业务查询均为 SELECT。
  async function select(item, statement, optional = false) {
    await connection.unsafe('SAVEPOINT preflight_item')
    try {
      const rows = await connection.unsafe(statement)
      await connection.unsafe('RELEASE SAVEPOINT preflight_item')
      return rows
    } catch (error) {
      await connection.unsafe('ROLLBACK TO SAVEPOINT preflight_item')
      await connection.unsafe('RELEASE SAVEPOINT preflight_item')
      if (error.code !== '42501' && !(optional && error.code === '42P01')) throw error
      skipped.push({ item, code: error.code })
      return null
    }
  }
  const users = await select('users', 'SELECT id, locale FROM public."user" ORDER BY id')
  const readings = await select(
    'readings',
    'SELECT user_id, kind, status, count(*)::int AS count FROM public.reading GROUP BY user_id, kind, status ORDER BY user_id, kind, status',
  )
  const purchases = await select(
    'purchases',
    `SELECT id, user_id, workspace_id, ${paymentEvidence('raw')} AS evidence FROM public.purchase`,
  )
  const payments = await select('payments', 'SELECT count(*)::int AS count FROM public.payment')
  const webhookEvidence = await select(
    'webhookPurchaseEvidence',
    `SELECT DISTINCT p.user_id, p.id AS purchase_id, ${paymentEvidence('w.payload')} AS evidence
    FROM public.purchase p
    LEFT JOIN public.payment pay ON pay.purchase_id = p.id
    JOIN public.webhook_event w ON w.provider = p.provider AND (
      w.payload #>> '{resource,supplementary_data,related_ids,order_id}' = p.provider_order_id
      OR w.payload #>> '{resource,id}' IN (p.provider_order_id, pay.provider_payment_id)
      OR w.payload #>> '{data,object,id}' IN (p.provider_order_id, pay.provider_payment_id)
    )`,
  )
  const subscriptions = await select(
    'subscriptionEvidence',
    `SELECT workspace_id, ${paymentEvidence('raw')} AS evidence FROM public.subscription`,
  )
  const accounts = await select(
    'accounts',
    'SELECT provider_id AS "providerId", count(*)::int AS count FROM public.account GROUP BY provider_id ORDER BY provider_id',
  )
  const twoFactor = await select(
    'twoFactor',
    'SELECT count(*)::int AS count FROM public.two_factor',
    true,
  )
  const organizations = await select(
    'workspaces',
    'SELECT id, is_personal FROM public.organization ORDER BY id',
  )
  const members = await select(
    'members',
    'SELECT organization_id, user_id, role FROM public.member ORDER BY organization_id, user_id',
  )
  const grants = await select(
    'creditGrants',
    `SELECT count(*)::int AS count, coalesce(sum(amount), 0)::text AS "amountTotal",
      coalesce(sum(remaining), 0)::text AS "remainingTotal",
      coalesce(sum(remaining) FILTER (WHERE status = 'active'), 0)::text AS "activeRemainingTotal"
    FROM public.credit_grant`,
  )
  const ledger = await select(
    'creditBalance',
    'SELECT coalesce(sum(delta), 0)::text AS total FROM public.credit_ledger',
  )
  const verification = await select(
    'verification',
    'SELECT count(*)::int AS count FROM public.verification',
  )
  const sessions = await select('sessions', 'SELECT count(*)::int AS count FROM public.session')
  const reportCounts = new Map()
  const reportsByKind = Object.fromEntries(kinds.map((kind) => [kind, 0]))
  const reportsByStatus = {}
  for (const row of readings ?? []) {
    if (row.status === 'ready') {
      const counts = reportCounts.get(row.user_id) ?? {}
      counts[row.kind] = (counts[row.kind] ?? 0) + row.count
      reportCounts.set(row.user_id, counts)
    }
    reportsByKind[row.kind] = (reportsByKind[row.kind] ?? 0) + row.count
    reportsByStatus[row.status] = (reportsByStatus[row.status] ?? 0) + row.count
  }
  const evidenceByUser = new Map()
  for (const row of purchases ?? []) {
    const evidence = evidenceByUser.get(row.user_id) ?? []
    evidence.push(...decodeEvidence(row.evidence))
    evidenceByUser.set(row.user_id, evidence)
  }
  for (const row of webhookEvidence ?? []) {
    const evidence = evidenceByUser.get(row.user_id) ?? []
    evidence.push(...decodeEvidence(row.evidence))
    evidenceByUser.set(row.user_id, evidence)
  }
  const purchasesWithoutSiteEvidence = (purchases ?? []).filter(
    (row) =>
      !paymentSites(decodeEvidence(row.evidence)).size &&
      !(webhookEvidence ?? []).some(
        (event) =>
          event.purchase_id === row.id && paymentSites(decodeEvidence(event.evidence)).size,
      ),
  ).length
  // 订阅没有购买者 user_id，仅能可靠归给 id = user.id 的个人空间。
  const userIds = new Set((users ?? []).map(({ id }) => id))
  let unattributedSubscriptionEvidence = 0
  for (const row of subscriptions ?? []) {
    if (!userIds.has(row.workspace_id)) {
      if (paymentSites(decodeEvidence(row.evidence)).size) unattributedSubscriptionEvidence++
      continue
    }
    const evidence = evidenceByUser.get(row.workspace_id) ?? []
    evidence.push(...decodeEvidence(row.evidence))
    evidenceByUser.set(row.workspace_id, evidence)
  }
  const primarySites = { east: 0, west: 0 }
  const ruleHits = Object.fromEntries(
    [1, 2, 3, 4].map((rule) => [rule, { east: 0, west: 0, total: 0 }]),
  )
  const assignments = new Map()
  const bothSitesActive = []
  const noEvidence = []
  const unresolvedUsers = []
  // 缺少上游证据时不伪造精确分站数，基线与可读项目仍保留。
  const classificationAvailable = Boolean(
    users && readings && purchases && subscriptions && webhookEvidence,
  )
  if (classificationAvailable) {
    for (const user of users) {
      const reports = reportCounts.get(user.id) ?? {}
      const result = classifyPrimarySite({
        reports,
        payments: evidenceByUser.get(user.id),
        locale: user.locale,
      })
      if (!result.site) {
        unresolvedUsers.push({ userId: user.id, reason: 'conflicting_payment_evidence' })
        continue
      }
      assignments.set(user.id, result.site)
      primarySites[result.site]++
      ruleHits[result.rule][result.site]++
      ruleHits[result.rule].total++
      if (result.bothSitesActive)
        bothSitesActive.push({
          userId: user.id,
          reports: Object.fromEntries(kinds.map((kind) => [kind, reports[kind] ?? 0])),
          result: result.site,
        })
      if (result.rule === 4) noEvidence.push({ userId: user.id, result: result.site })
    }
  }
  const workspaceCounts = {
    east: { existingPersonal: 0, newPersonal: primarySites.west, personal: 0, team: 0 },
    west: { existingPersonal: 0, newPersonal: primarySites.east, personal: 0, team: 0 },
  }
  const mixedTeamWorkspaces = []
  const unresolvedWorkspaces = []
  const workspaceAvailable = Boolean(classificationAvailable && organizations && members)
  if (workspaceAvailable) {
    for (const workspace of organizations) {
      const workspaceMembers = members.filter((member) => member.organization_id === workspace.id)
      const sites = { east: 0, west: 0, unresolved: 0 }
      for (const member of workspaceMembers)
        sites[assignments.get(member.user_id) ?? 'unresolved']++
      if (!workspace.is_personal && sites.east && sites.west)
        mixedTeamWorkspaces.push({
          workspaceId: workspace.id,
          memberCount: workspaceMembers.length,
          membersByPrimarySite: sites,
        })
      const owners = workspaceMembers.filter(({ role }) => role.split(',').includes('owner'))
      const ownerSites = new Set(owners.map(({ user_id }) => assignments.get(user_id)))
      const site = workspace.is_personal
        ? assignments.get(workspace.id)
        : ownerSites.size === 1
          ? [...ownerSites][0]
          : null
      if (!site) {
        unresolvedWorkspaces.push({
          workspaceId: workspace.id,
          memberCount: workspaceMembers.length,
          reason: 'missing_or_conflicting_owner_site',
        })
        continue
      }
      workspaceCounts[site][workspace.is_personal ? 'existingPersonal' : 'team']++
    }
    for (const site of ['east', 'west'])
      workspaceCounts[site].personal =
        workspaceCounts[site].existingPersonal + workspaceCounts[site].newPersonal
  }
  return {
    generatedAt: new Date().toISOString(),
    policy: 'owner-2026-11-03',
    complete:
      skipped.every(({ code }) => code === '42P01') &&
      !unresolvedUsers.length &&
      !unresolvedWorkspaces.length &&
      !unattributedSubscriptionEvidence,
    totalUsers: users?.length ?? null,
    primarySites: classificationAvailable ? primarySites : null,
    ruleHits: classificationAvailable ? ruleHits : null,
    replicaUsersToCreate: users?.length ?? null,
    accountsToCopyByProvider: accounts,
    twoFactorRows: twoFactor?.[0].count ?? null,
    workspacesBySite: workspaceAvailable ? workspaceCounts : null,
    mixedTeamWorkspaces: workspaceAvailable ? mixedTeamWorkspaces : null,
    bothSitesActive: classificationAvailable ? bothSitesActive : null,
    noEvidence: classificationAvailable ? noEvidence : null,
    unresolvedUsers,
    unresolvedWorkspaces,
    unattributedSubscriptionEvidence,
    purchasesWithoutSiteEvidence: purchases ? purchasesWithoutSiteEvidence : null,
    baseline: {
      payments: payments?.[0].count ?? null,
      ordersOrPurchases: purchases?.length ?? null,
      reportsByKind: readings ? reportsByKind : null,
      reportsByStatus: readings ? reportsByStatus : null,
      creditGrants: grants?.[0] ?? null,
      creditBalanceTotal: ledger?.[0].total ?? null,
      verification: verification?.[0].count ?? null,
      sessions: sessions?.[0].count ?? null,
    },
    skipped,
    notes: [
      '只执行 SELECT 与事务控制；同一 REPEATABLE READ / READ ONLY 快照，最终 ROLLBACK。',
      '主站点仅按 ready 成品报告判定；基线按全部状态计数，塔罗不作站点依据。空间含软删除记录。',
      '付款证据取 purchase.raw / subscription.raw，并按 provider 和订单/付款 ID 精确关联 webhook_event；未保存的 locale/description 无法恢复时继续规则 3/4。',
      '团队以 member.role=owner 为依据；缺失或跨站 owner 不猜测创建者，列为未决。',
      '积分金额与余额合计为十进制字符串，避免整数精度损失；余额为 sum(credit_ledger.delta)。',
    ],
  }
}

export async function runPreflight(url) {
  const postgres = require('postgres')
  const client = postgres(url, {
    max: 1,
    // 禁止驱动在 BEGIN 前自动查询 pg_type，确保所有 SELECT 都在只读事务内。
    fetch_types: false,
    connect_timeout: 15,
    onnotice: () => {},
    connection: { statement_timeout: 30000, application_name: 'split-accounts-preflight' },
  })
  try {
    // 先以唯一连接启动事务；当前驱动 fetch_types=false 时不能从冷连接直接 reserve。
    await client.unsafe('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ')
    const connection = await client.reserve()
    try {
      return await collectPreflight(connection)
    } finally {
      await connection.unsafe('ROLLBACK')
      await connection.release()
    }
  } finally {
    await client.end({ timeout: 5 })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: 独立人工只读脚本，不经 Turbo 缓存。
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL_REQUIRED')
    const report = await runPreflight(url)
    console.log(JSON.stringify(report, null, 2))
    if (
      report.unresolvedUsers.length ||
      report.unresolvedWorkspaces.length ||
      report.unattributedSubscriptionEvidence
    )
      process.exitCode = 2
  } catch (error) {
    // 不输出错误原文或连接对象，避免驱动把连接串、SQL 参数带入日志。
    console.error(
      JSON.stringify({
        error: 'preflight_failed',
        code: error.code ?? 'CONNECTION_OR_CONFIGURATION_ERROR',
      }),
    )
    process.exitCode = 1
  }
}
