# Design

## Context

- 动机见 proposal.md。
- **两站共用回调入口。** 两站共用同一个支付回调入口，`packages/billing/src/pipeline.ts` 是与支付平台无关的通用管线，按以下顺序处理：
  1. 验签；
  2. 登记：`insert … on conflict do nothing` 后 `select`；
  3. 事务内逐事件调用 handler，再把状态标记为 processed / ignored；
  4. 失败时另开事务 `markFailed`；
  5. 重放：同一个 `processRegistered`。
- **现在的归属规则。** 现在的空间与站点归属只在后台查询时临时推出，见 `apps/web/src/features/billing/admin-data.ts` 的 `webhookSiteArray` 与 `listAdminWebhooks` 的空间筛选。重放校验 `admin-writes.ts` 读的是同一个表达式。
- **多空间的情况。** 一个事件理论上可能关联多个空间。现有语义下，事件只有在「关联站点 ⊆ 当前站点」时才出现在当前站点视图里。

## Goals / Non-Goals

**Goals:**
- 归属在写入时确定。
- 后台读取走索引。
- 对外行为与现在一致，见 specs/admin-console。

**Non-Goals:**
- 不改回调入口。不按 Host 区分站点：回调由支付平台发来，Host 不代表用户站点。
- 不改验签、幂等、入账与通知。
- 不给其他账务表加站点列。它们已经可以经 `workspace_id` 关联到 `organization.site`。

## Decisions

### 1. 用数组列 `workspace_ids uuid[]` 与 `sites text[]`，不用单值列

保存关联到的全部空间与站点（升序去重），非空，默认 `{}`。

- **筛选方式。**
  - 当前站点视图：`sites <@ array[当前站点]`。空数组也满足这个条件，所以无法关联的事件两站都能看到，与现状一致。
  - 空间筛选：`workspace_ids @> array[空间]`。
  - 两列各建一个 GIN 索引。
- **备选方案：单值 `workspace_id` + `site`。** 遇到多空间或多站点时需要额外的冲突标记，否则会把跨站事件错放到某一站，或者放进两站都可重放的「未知」里，改变安全语义。数组列可以原样保留现有语义。

### 2. 关联规则迁到 `packages/billing`，由管线在写入时调用

- **新模块 `packages/billing/src/webhook-attribution.ts`。**
  - 导出 `attributeWebhookEvent(tx, webhookEventId)`：在同一条 `update … set workspace_ids = …, sites = … where id = …` 里按现有规则重算并写入。
  - 规则原样沿用：
    - 载荷中的 `$.**.workspaceId`；
    - `$.**.custom_id` 中的 UUID；
    - 载荷字符串与本地 `subscription.provider_subscription_id`、`payment.provider_payment_id`、`purchase.provider_order_id`（同一 provider）相同。
  - 只保留现存空间，站点取 `organization.site`。
- **调用位置。**
  - 登记事务：仅在首次插入时写入，这时只能依据载荷与已有本地记录；重复投递不改动已保存的归属。
  - 提交事务：handler 运行之后、标记 processed / ignored 之前。handler 刚写入的订阅、付款、购买在同一事务里可见。
  - `markFailed` 事务：handler 的事务已经回滚，按载荷与已有本地记录重算。
  - 重放复用提交与失败路径，不需要另加调用。
- **每次都是全量重算覆盖，不做并集。** 结果只取决于载荷和当时的本地记录，与回填规则一致，方便测试。
- **后台改为读列。**
  - 后台直接用 Drizzle 的数组运算 `arrayContains` / `arrayContained` 读这两列（可走 GIN 索引）。
  - 删除 `webhookSiteArray`、`webhookEventSites` 与列表中的 jsonb 空间筛选。
  - 依赖方向：web 依赖 billing，符合 `check-deps`。
- **备选方案：在各事件 handler 里写归属。** 失败的事件根本到不了 handler 提交，`payment.refunded` 等事件也不经过 association。而且通用管线已经掌握所有写入时机，不需要每个 handler 各自处理。

### 3. 迁移内回填

- `0019_webhook_event_site.sql` 依次执行：
  1. 加列，设默认值 `'{}'` 和 `not null`；
  2. 用与运行时相同的 SQL 回填全部现有行；
  3. 建 GIN 索引。
- 生产为 0 行。staging 和本地有测试数据，回填量很小，迁移里直接 `update` 即可。
- 回填 SQL 与运行时 SQL 是两份文本，由一个 Postgres 测试断言两者结果一致（见 tasks 2.3）。

### 4. 已处理事件的归属以保存值为准；失败事件在重放校验前重算

- **已处理（processed / ignored）的事件不再改动归属。** 即使空间被清理，或本地记录被删除，列表与重放仍按保存的归属判断。现在的实时推导会在这些情况下把事件变成「未知站点」，这里是有意收紧。
- **失败事件的归属可能过期。** 例：订阅续费回调早于建立本地订阅的结账回调到达而失败，失败时无法关联（`{}`）；之后本地订阅由另一事件建立。
  - 若支付平台不再重投，列表中它仍显示为未知站点。
  - 重放请求的站点校验前会先按最新本地记录重算，所以另一站不能凭过期的「未知」放行重放。
  - 重放本身也会经提交 / 失败路径再次重算。
- **记录失败时的归属计算放在保存点内。** 出错时保留原归属，并记一条告警日志，保证失败状态仍能落库、事件仍可重放。

## Risks / Trade-offs

- **归属 SQL 出错会让回调处理失败。** → 规则只做带正则保护的 UUID 转换与等值比较。失败时走现有的失败与重试路径，不会丢事件。Postgres 测试覆盖各种载荷形态，包括无效 UUID、空载荷和非字符串值。
- **回调路径多了一条 update。** → 只扫描单行载荷，成本可以忽略。不新增 Cron 和轮询，符合 Neon 缩容基线。
- **回填 SQL 与运行时规则漂移。** → 用等价性测试兜住；以后改规则时，需要另写迁移重算。
- **多一次写入与并发重放的交错。** → 三处写入都在已有事务内，提交与失败路径都已持有该行的 `for update` 锁。登记路径的插入冲突时行已存在，`update` 也会等锁。

## Migration Plan

1. 发版顺序沿用 `deploy-production.yml`：migrate → jobs → web。
   - 迁移只做加列（带默认值）和建索引，旧代码不读新列，所以先迁移是安全的。
   - 新代码依赖新列，迁移在先，所以发版顺序满足要求。
2. staging 先部署，在后台确认回调列表的站点显示与筛选正常，再随下一个 tag 进生产。
3. 回滚：只回滚代码即可，新列保留也不影响旧代码。不需要反向迁移。
   - 回滚期间旧代码登记的事件归属为默认的 `{}`。重新发布新代码后，需要再执行一次迁移中 `BACKFILL BEGIN` 到 `BACKFILL END` 之间的回填语句（只改归属两列），否则这些事件会一直显示为未知站点。
