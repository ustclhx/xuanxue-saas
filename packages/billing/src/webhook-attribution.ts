import { organization, payment, purchase, subscription, webhookEvent } from '@xuanxue/db'
import { eq, type SQL, sql } from 'drizzle-orm'
import type { WebhookTransaction } from './pipeline.ts'

/**
 * 回调事件的空间与站点归属（openspec webhook-event-site）。两站共用回调入口，归属只能由已验签载荷与本地账务推出：
 * 载荷中的结账元数据 `workspaceId`、PayPal `custom_id` 中的空间 ID，以及与本地订阅 / 付款 / 订单平台 ID
 * （同一支付平台）相同的字符串。结果升序去重写入 `workspace_ids` / `sites`，之后列表与重放校验只读这两列。
 * 迁移 0019 的回填 SQL 与这里同一规则，改规则时同步改并另写迁移重算（webhook-attribution.postgres.test.ts 对比两者）。
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const payloadStrings = sql`select v #>> '{}' from jsonb_path_query(${webhookEvent.payload}, '$.** ? (@.type() == "string")') v`

/** 引用外层 `webhook_event` 行，只能用在作用于 webhook_event 的语句中 */
const linkedWorkspaceIds = sql`
  select case when m.v ~* ${`^${UUID}$`} then m.v::uuid end from (
    select w #>> '{}' as v from jsonb_path_query(${webhookEvent.payload}, '$.**.workspaceId') w
    union all
    select (regexp_matches(c #>> '{}', ${UUID}, 'gi'))[1] from jsonb_path_query(${webhookEvent.payload}, '$.**.custom_id') c
  ) m
  union all
  select ${subscription.workspaceId} from ${subscription} where ${subscription.provider} = ${webhookEvent.provider} and ${subscription.providerSubscriptionId} in (${payloadStrings})
  union all
  select ${payment.workspaceId} from ${payment} where ${payment.provider} = ${webhookEvent.provider} and ${payment.providerPaymentId} in (${payloadStrings})
  union all
  select ${purchase.workspaceId} from ${purchase} where ${purchase.provider} = ${webhookEvent.provider} and ${purchase.providerOrderId} in (${payloadStrings})`

const linked = (column: SQL) =>
  sql`array(select distinct ${column} from ${organization} where ${organization.id} in (${linkedWorkspaceIds}) order by 1)`

/** 按当前载荷与本地账务全量重算并覆盖该事件的归属；在调用方事务内执行 */
export async function attributeWebhookEvent(tx: WebhookTransaction, webhookEventId: string) {
  await tx
    .update(webhookEvent)
    .set({
      workspaceIds: linked(sql`${organization.id}`),
      sites: linked(sql`${organization.site}`),
    })
    .where(eq(webhookEvent.id, webhookEventId))
}
