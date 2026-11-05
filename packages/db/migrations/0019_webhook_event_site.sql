-- rollback-safe: 只新增带默认值的非空数组列、取值约束与 GIN 索引，旧代码不读写这两列
SET lock_timeout = '5s';--> statement-breakpoint
SET statement_timeout = '15min';--> statement-breakpoint
-- 回调事件保存空间与站点归属（openspec webhook-event-site），后台列表与重放校验不再逐行扫描载荷。
ALTER TABLE "webhook_event" ADD COLUMN "workspace_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_event" ADD COLUMN "sites" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- 回填：规则与 packages/billing/src/webhook-attribution.ts 一致（webhook-attribution.postgres.test.ts 对比两者）。
-- BACKFILL BEGIN
WITH linked AS (
  SELECT w."id", o."id" AS "workspace_id", o."site"
  FROM "webhook_event" w
  JOIN "organization" o ON o."id" IN (
    SELECT CASE WHEN m.v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN m.v::uuid END FROM (
      SELECT x #>> '{}' AS v FROM jsonb_path_query(w."payload", '$.**.workspaceId') x
      UNION ALL
      SELECT (regexp_matches(c #>> '{}', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'gi'))[1]
      FROM jsonb_path_query(w."payload", '$.**.custom_id') c
    ) m
    UNION ALL
    SELECT s."workspace_id" FROM "subscription" s WHERE s."provider" = w."provider" AND s."provider_subscription_id" IN (
      SELECT v #>> '{}' FROM jsonb_path_query(w."payload", '$.** ? (@.type() == "string")') v)
    UNION ALL
    SELECT p."workspace_id" FROM "payment" p WHERE p."provider" = w."provider" AND p."provider_payment_id" IN (
      SELECT v #>> '{}' FROM jsonb_path_query(w."payload", '$.** ? (@.type() == "string")') v)
    UNION ALL
    SELECT u."workspace_id" FROM "purchase" u WHERE u."provider" = w."provider" AND u."provider_order_id" IN (
      SELECT v #>> '{}' FROM jsonb_path_query(w."payload", '$.** ? (@.type() == "string")') v)
  )
), grouped AS (
  SELECT "id",
    array_agg(DISTINCT "workspace_id" ORDER BY "workspace_id") AS "workspace_ids",
    array_agg(DISTINCT "site" ORDER BY "site") AS "sites"
  FROM linked GROUP BY "id"
)
UPDATE "webhook_event" w SET "workspace_ids" = g."workspace_ids", "sites" = g."sites"
FROM grouped g WHERE g."id" = w."id";--> statement-breakpoint
-- BACKFILL END
-- squawk-ignore constraint-missing-not-valid -- reason: 表在单个迁移事务内，生产为 0 行、测试环境行数很少，校验扫描一次即可
ALTER TABLE "webhook_event" ADD CONSTRAINT "webhook_event_sites_known" CHECK ("webhook_event"."sites" <@ array['east', 'west']::text[]);--> statement-breakpoint
-- squawk-ignore require-concurrent-index-creation -- reason: drizzle 迁移在事务内执行无法 CONCURRENTLY；生产为 0 行，测试环境行数很少
CREATE INDEX "webhook_event_workspace_ids_idx" ON "webhook_event" USING gin ("workspace_ids");--> statement-breakpoint
-- squawk-ignore require-concurrent-index-creation -- reason: drizzle 迁移在事务内执行无法 CONCURRENTLY；生产为 0 行，测试环境行数很少
CREATE INDEX "webhook_event_sites_idx" ON "webhook_event" USING gin ("sites");
