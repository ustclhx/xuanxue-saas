# Tasks

## 1. 表结构与迁移

- [x] 1.1 在 `packages/db/src/schema/billing.ts` 的 `webhookEvent` 增加 `workspace_ids uuid[]`、`sites text[]`（非空、默认 `{}`）与两个 GIN 索引；生成 `0019_webhook_event_site.sql` 并在其中加入回填 SQL；在隔离库执行 `pnpm --filter @xuanxue/db db:migrate` 成功，且再次生成迁移无差异
- [x] 1.2 `pnpm typecheck` 与 `pnpm --filter @xuanxue/db test` 通过（schema 相关快照或测试同步更新）

## 2. 写入时归属

- [x] 2.1 新建 `packages/billing/src/webhook-attribution.ts`，导出 `attributeWebhookEvent(tx, id)`，规则从 `admin-data.ts` 迁出；Postgres 测试覆盖载荷 `workspaceId`、PayPal `custom_id`、本地订阅 / 付款 / 订单平台 ID、跨两站、无效 UUID 与无法关联，全部通过
- [x] 2.2 `pipeline.ts` 在登记（仅首次插入）、提交（handler 之后）与 `markFailed` 三处调用归属写入；Postgres 测试断言：处理成功的购买事件带上 handler 新建记录的空间与站点；失败事件保留载荷中的空间与站点；重放后归属按最新本地记录更新；重复投递不改变结果
- [x] 2.3 Postgres 测试：插入归属为空的事件后执行迁移中的回填 SQL，结果与 `attributeWebhookEvent` 一致

## 3. 后台改读保存的归属

- [x] 3.1 `admin-data.ts` 的回调列表、站点显示与空间筛选改用新列，删除 `webhookSiteArray` / `webhookEventSites` 与 jsonb 扫描；现有后台回调列表测试（当前站点 / 全部站点 / 空间筛选 / 未知站点）全部通过，并补一条「保存的归属不随本地记录删除而漂移」的用例
- [x] 3.2 `admin-writes.ts` 的重放站点校验改读 `sites` 列；测试覆盖另一站事件被拒（ADMIN_OTHER_SITE）与未知站点两站可重放

## 4. 集成验证

- [x] 4.1 `pnpm check`、`pnpm check:deps`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过，`apps/web` 下 `pnpm test:e2e:smoke` 通过
- [x] 4.2 合并后 staging 部署成功（迁移执行），在 staging 后台打开回调列表，站点列显示与筛选正常；结果记入仓库外证据目录
