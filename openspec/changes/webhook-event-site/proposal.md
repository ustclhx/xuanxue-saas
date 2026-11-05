# Proposal

## Why

`webhook_event` 没有空间与站点列。后台回调列表要显示站点、按站点或空间筛选，只能在每次查询时对每一行载荷做 JSON 路径扫描，再关联本地订阅 / 付款 / 购买推出站点（`apps/web/src/features/billing/admin-data.ts` 的 `webhookSiteArray`）。成本随事件总数线性增长，不能用索引，重放时的站点校验也依赖同一段扫描。生产 `webhook_event` 目前为 0 行，Owner 决定趁现在变更表结构，避免日后带数据迁移。

## What Changes

- `webhook_event` 新增两列：`workspace_ids uuid[]` 与 `sites text[]`（非空，默认空数组），各建 GIN 索引。两列保存该事件关联到的空间与站点（升序去重），关联规则与现在后台的查询规则一致：载荷中的结账元数据 `workspaceId`、PayPal `custom_id` 中的空间 ID，以及与本地订阅 / 付款 / 订单平台 ID 相同的字符串。
- 关联在回调管线里计算并写入，与状态变化同一事务：登记（首次落库）时、处理提交时、标记失败时各重算一次；重放沿用同一路径。关联计算从 web 后台移到 `packages/billing`，供管线与后台共用。
- 迁移回填已有行（生产为 0 行；staging / 本地有测试数据），规则与运行时相同。
- 后台回调列表、空间筛选与重放的站点校验改为读这两列，不再扫描载荷；对外行为（当前站点视图 / 全部站点视图、无法关联的事件两站可见可重放、关联到另一站的事件只读）保持不变。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `admin-console`：「空间与计费查看」补充回调事件按站点与空间筛选的要求，以及事件归属在处理时确定并持久保存。

## Impact

- 数据库：新迁移 `0019_webhook_event_site.sql`（加列、索引、回填），Drizzle schema `packages/db/src/schema/billing.ts`。
- 回调管线：`packages/billing/src/pipeline.ts`（登记、提交、失败三处写入关联），新增关联模块（由 `admin-data.ts` 迁出）。
- 后台：`apps/web/src/features/billing/admin-data.ts`（列表与筛选）、`admin-writes.ts`（重放校验）。
- 不涉及：支付平台接口、回调入口 URL、验签、幂等与入账逻辑；不新增环境变量或密钥。
