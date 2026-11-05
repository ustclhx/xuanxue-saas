-- 两站账户按站点独立（openspec split-site-accounts 决策 4、8、9）。
-- 不标注 rollback-safe：迁移后每个邮箱在两站各有一个账户，旧代码按邮箱查找会命中两行，
-- 且旧代码写入 user / account / verification / organization 时不带 site，违反非空约束；只能向前修复。
-- 发版顺序为 迁移 → jobs → web，迁移与 web 发布之间旧 web 的注册会失败，应放在发版窗口内执行。
SET lock_timeout = '5s';--> statement-breakpoint
SET statement_timeout = '15min';--> statement-breakpoint
-- 1. 先加可空列，回填后再设为非空。
ALTER TABLE "user" ADD COLUMN "site" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "site" text;--> statement-breakpoint
ALTER TABLE "verification" ADD COLUMN "site" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "site" text;--> statement-breakpoint
-- 2. 作废全部验证值（验证码、重置链接、OAuth state、删号缓存清理清单）：它们不记录站点，
--    无法判断应在哪个站点生效；用户重新申请即可。旧清单对应的是旧前缀的 KV 键，新代码不再读取。
DELETE FROM "verification";--> statement-breakpoint
-- 3. 主站点（决策 9，与 scripts/production/split-accounts-preflight.mjs 的 classifyPrimarySite 一致）：
--    ① 成品详批报告：八字 / 紫微 / 四柱 / 宫合 → east，灵数 → west，塔罗不计；两类都有时多者胜，相等为 west；
--    ② 付款证据：购买、关联 webhook 与个人空间订阅快照中的 locale / description；
--    ③ user.locale：zh-Hant / zh-Hans / ko → east；④ 其余 → west。
--    付款证据同时指向两站时 Owner 未定取舍，置为 NULL，由第 4 步中止迁移。
WITH reports AS (
  SELECT "user_id",
    count(*) FILTER (WHERE "kind" IN ('bazi-full', 'ziwei-full', 'saju-full', 'saju-compat')) AS east,
    count(*) FILTER (WHERE "kind" = 'numerology-full') AS west
  FROM "reading" WHERE "status" = 'ready' GROUP BY "user_id"
), evidence AS (
  SELECT p."user_id", e.item
  FROM "purchase" p
  CROSS JOIN LATERAL jsonb_path_query(p."raw",
    '$.** ? (@.type() == "object").keyvalue() ? (@.key == "locale" || @.key == "description")') AS e(item)
  UNION ALL
  SELECT DISTINCT p."user_id", e.item
  FROM "purchase" p
  LEFT JOIN "payment" pay ON pay."purchase_id" = p."id"
  JOIN "webhook_event" w ON w."provider" = p."provider" AND (
    w."payload" #>> '{resource,supplementary_data,related_ids,order_id}' = p."provider_order_id"
    OR w."payload" #>> '{resource,id}' IN (p."provider_order_id", pay."provider_payment_id")
    OR w."payload" #>> '{data,object,id}' IN (p."provider_order_id", pay."provider_payment_id")
  )
  CROSS JOIN LATERAL jsonb_path_query(w."payload",
    '$.** ? (@.type() == "object").keyvalue() ? (@.key == "locale" || @.key == "description")') AS e(item)
  UNION ALL
  -- 订阅没有购买者，只能归给 id 等于用户 id 的个人空间
  SELECT s."workspace_id", e.item
  FROM "subscription" s
  JOIN "user" u ON u."id" = s."workspace_id"
  CROSS JOIN LATERAL jsonb_path_query(s."raw",
    '$.** ? (@.type() == "object").keyvalue() ? (@.key == "locale" || @.key == "description")') AS e(item)
), evidence_site AS (
  SELECT x."user_id", hit.site
  FROM (
    SELECT "user_id", item ->> 'key' AS k, item ->> 'value' AS v
    FROM evidence WHERE jsonb_typeof(item -> 'value') = 'string'
  ) x
  CROSS JOIN LATERAL (VALUES
    -- 支付商会把站点语言规范化为 zh-TW / zh-CN / ko-KR / en-US
    (CASE WHEN x.k = 'locale' AND (x.v IN ('zh-Hant', 'zh-Hans', 'ko') OR x.v ~* '^(zh|ko)(-|$)') THEN 'east'
      WHEN x.k = 'locale' AND x.v ~* '^en(-|$)' THEN 'west' END),
    (CASE WHEN x.k = 'description'
      AND x.v ~* 'ganjiday|干支日|간지데이|bazi|ziwei|saju|八字|紫微|四柱|宫合|宮合' THEN 'east' END),
    (CASE WHEN x.k = 'description' AND x.v ~* 'arcanumber|numerology|灵数|靈數' THEN 'west' END)
  ) AS hit(site)
  WHERE hit.site IS NOT NULL
), payments AS (
  SELECT "user_id", count(DISTINCT site) AS sites, min(site) AS site FROM evidence_site GROUP BY "user_id"
)
UPDATE "user" u SET "site" = CASE
    WHEN coalesce(r.east, 0) + coalesce(r.west, 0) > 0 THEN CASE WHEN r.east > r.west THEN 'east' ELSE 'west' END
    WHEN p.sites > 1 THEN NULL
    WHEN p.sites = 1 THEN p.site
    WHEN u."locale" IN ('zh-Hant', 'zh-Hans', 'ko') THEN 'east'
    ELSE 'west'
  END
FROM "user" src
LEFT JOIN reports r ON r."user_id" = src."id"
LEFT JOIN payments p ON p."user_id" = src."id"
WHERE src."id" = u."id";--> statement-breakpoint
-- 4. 付款证据冲突的用户需要 Owner 先决定（预检报告的 unresolvedUsers），不自行猜测。
DO $$
DECLARE unresolved integer;
BEGIN
  SELECT count(*) INTO unresolved FROM "user" WHERE "site" IS NULL;
  IF unresolved > 0 THEN
    RAISE EXCEPTION 'split-site-accounts: % users have conflicting payment evidence; resolve them before migrating', unresolved;
  END IF;
END
$$;--> statement-breakpoint
-- 5. 原用户的登录方式留在主站点。
UPDATE "account" a SET "site" = u."site" FROM "user" u WHERE u."id" = a."user_id";--> statement-breakpoint
-- 6. 空间站点：个人空间取用户站点；团队空间取创建者（最早的 owner 成员）站点；
--    已软删的团队没有成员，取删除审计中的原 owner；都没有时按西方站（与规则 ④ 一致）。
UPDATE "organization" o SET "site" = coalesce(
  (SELECT u."site" FROM "user" u WHERE o."is_personal" AND u."id" = o."id"),
  (SELECT u."site" FROM "member" m JOIN "user" u ON u."id" = m."user_id"
    WHERE m."organization_id" = o."id" AND m."role" ~ '(^|,)\s*owner\s*(,|$)'
    ORDER BY m."created_at", m."id" LIMIT 1),
  (SELECT u."site" FROM "audit_log" l JOIN "user" u ON u."id"::text = l."meta" -> 'originalOwnerUserIds' ->> 0
    WHERE l."workspace_id" = o."id" AND l."action" = 'workspace.deleted'
    ORDER BY l."created_at" DESC, l."id" DESC LIMIT 1),
  'west'
);--> statement-breakpoint
-- 7. 副本账户（决策 8，Owner 2026-11-03）：每个原用户在另一站新建一个账户，复制邮箱、资料、角色与登录方式
--    （密码哈希、Google 关联、两步验证），并新建空的个人空间；不复制积分、订单、付款、退款申请、报告与会话。
--    全局邮箱唯一先去掉，副本写入后由第 8 步的 (site, email) 唯一约束收口。
ALTER TABLE "user" DROP CONSTRAINT "user_email_unique";--> statement-breakpoint
-- 主键沿用 UUIDv7（docs/02 §4）：PG 17 没有 uuidv7()，按 RFC 9562 就地生成——
-- 前 48 位为 clock_timestamp() 的毫秒时间戳，其余取 gen_random_uuid() 的随机位，再把版本号从 4 改为 7
-- （set_bit 52、53）；不建函数，避免迁移留下额外对象。所有映射在同一条语句的 CTE 中完成：
-- src 含易变函数，PG 只求值一次，各 INSERT 看到同一组副本 id；外键在语句末尾检查。
WITH src AS MATERIALIZED (
  SELECT u.*,
    encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) PLACING
      substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
      FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid AS clone_id,
    CASE u."site" WHEN 'east' THEN 'west' ELSE 'east' END AS clone_site,
    -- 已删号（匿名化）的账户也生成副本以保持「用户数翻倍」，但副本同样是匿名、封禁、无空间的占位行
    u."email" = 'deleted+' || u."id" || '@invalid' AS anonymized
  FROM "user" u
), users AS (
  INSERT INTO "user" ("id", "name", "email", "email_verified", "image", "role", "banned", "ban_reason",
    "ban_expires", "two_factor_enabled", "locale", "timezone", "site", "created_at", "updated_at")
  SELECT clone_id, "name", CASE WHEN anonymized THEN 'deleted+' || clone_id || '@invalid' ELSE "email" END,
    "email_verified", "image", "role", "banned", "ban_reason", "ban_expires", "two_factor_enabled",
    "locale", "timezone", clone_site, "created_at", now()
  FROM src
), accounts AS (
  INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "access_token", "refresh_token",
    "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "site",
    "created_at", "updated_at")
  SELECT
    encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) PLACING
      substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
      FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid,
    -- Better Auth 的密码账户以用户 id 作为 account_id；第三方账户保留提供方的用户标识
    CASE WHEN a."provider_id" = 'credential' THEN s.clone_id::text ELSE a."account_id" END,
    a."provider_id", s.clone_id, a."access_token", a."refresh_token", a."id_token",
    a."access_token_expires_at", a."refresh_token_expires_at", a."scope", a."password", s.clone_site,
    a."created_at", now()
  FROM "account" a JOIN src s ON s."id" = a."user_id"
), factors AS (
  INSERT INTO "two_factor" ("id", "secret", "backup_codes", "user_id", "verified", "created_at", "updated_at")
  SELECT
    encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) PLACING
      substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
      FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid,
    f."secret", f."backup_codes", s.clone_id, f."verified", f."created_at", now()
  FROM "two_factor" f JOIN src s ON s."id" = f."user_id"
), workspaces AS (
  -- 与 personal-workspace.ts 一致：id 等于用户 id、is_personal、slug 为 u- 加 8 位随机字符
  INSERT INTO "organization" ("id", "name", "slug", "is_personal", "site")
  SELECT clone_id, 'Personal', 'u-' || substr(md5(gen_random_uuid()::text), 1, 8), true, clone_site
  FROM src WHERE NOT anonymized
), owners AS (
  INSERT INTO "member" ("id", "organization_id", "user_id", "role")
  SELECT
    encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) PLACING
      substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
      FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid,
    clone_id, clone_id, 'owner'
  FROM src WHERE NOT anonymized
), moved AS (
  -- 团队成员限同站（workspace-tenancy）：原用户在另一站团队中的成员关系转给该站的副本账户
  UPDATE "member" m SET "user_id" = s.clone_id, "updated_at" = now()
  FROM src s, "organization" o
  WHERE m."user_id" = s."id" AND o."id" = m."organization_id" AND NOT o."is_personal"
    AND o."site" = s.clone_site
)
SELECT count(*) FROM src;--> statement-breakpoint
-- 8. 收口：非空、取值约束与按站点的邮箱唯一（决策 4）。
-- squawk-ignore adding-not-nullable-field -- reason: 上面已回填全部行；表在单个迁移事务内，现有行数很少，扫描一次即可
ALTER TABLE "user" ALTER COLUMN "site" SET NOT NULL;--> statement-breakpoint
-- squawk-ignore adding-not-nullable-field -- reason: 上面已回填全部行；表在单个迁移事务内，现有行数很少，扫描一次即可
ALTER TABLE "account" ALTER COLUMN "site" SET NOT NULL;--> statement-breakpoint
-- squawk-ignore adding-not-nullable-field -- reason: verification 已在本迁移中清空
ALTER TABLE "verification" ALTER COLUMN "site" SET NOT NULL;--> statement-breakpoint
-- squawk-ignore adding-not-nullable-field -- reason: 上面已回填全部行；表在单个迁移事务内，现有行数很少，扫描一次即可
ALTER TABLE "organization" ALTER COLUMN "site" SET NOT NULL;--> statement-breakpoint
-- squawk-ignore constraint-missing-not-valid -- reason: 列为本迁移新增并已回填，校验只需扫描一次少量行
ALTER TABLE "user" ADD CONSTRAINT "user_site_valid" CHECK ("user"."site" in ('east', 'west'));--> statement-breakpoint
-- squawk-ignore constraint-missing-not-valid -- reason: 列为本迁移新增并已回填，校验只需扫描一次少量行
ALTER TABLE "account" ADD CONSTRAINT "account_site_valid" CHECK ("account"."site" in ('east', 'west'));--> statement-breakpoint
-- squawk-ignore constraint-missing-not-valid -- reason: verification 已在本迁移中清空
ALTER TABLE "verification" ADD CONSTRAINT "verification_site_valid" CHECK ("verification"."site" in ('east', 'west'));--> statement-breakpoint
-- squawk-ignore constraint-missing-not-valid -- reason: 列为本迁移新增并已回填，校验只需扫描一次少量行
ALTER TABLE "organization" ADD CONSTRAINT "organization_site_valid" CHECK ("organization"."site" in ('east', 'west'));--> statement-breakpoint
-- squawk-ignore disallowed-unique-constraint, constraint-missing-not-valid -- reason: drizzle 迁移在事务内执行无法 CONCURRENTLY 建索引；user 行数很少，唯一索引构建只扫描一次
ALTER TABLE "user" ADD CONSTRAINT "user_site_email_unique" UNIQUE("site","email");
