# xuanxue staging 操作记录

2026-10-19 UTC。本项目使用 Neon + Cloudflare workers.dev；本文只记录本次实际操作，不引用模板历史验收作为本项目证据。

**当前状态：资源、受限角色、迁移、报价与 secrets 已准备；继续首次业务部署。** 报告邮件链接仍指向占位域名，协调者已明确接受该 staging 限制（未配 Resend，不发送实际邮件），会在单独分支修复 siteOrigin。本分支不改站点代码。health、浏览器冒烟及真实详批将在下方记录实际结果。

## 资源

Cloudflare account：`170a06d37ad50396b19943eb6b77a21d`。目标地址：`https://xuanxue-web-staging.saas-jobs.workers.dev`。

| 类型 | 名称 | ID / 配置 |
| --- | --- | --- |
| Neon 组织 | 既有组织 | `org-ancient-mountain-81615147` |
| Neon 项目 | 用户已建 `xuanxue_staging` | `noisy-fire-19510813`；PG18；`aws-us-east-2` |
| Neon 分支 | 既有 `production` | `br-lively-truth-b5nnv5nh`；仅是 staging 项目默认分支名 |
| Neon 数据库 | 新建 `xuanxue_staging` | database id `1868407`；owner `migrator` |
| R2 | `xuanxue-files-staging` | 私有；Standard |
| KV CACHE | `staging-xuanxue-staging-cache` | `99fee60cbaca4d71ab280da1056b291e` |
| Email Queue | `xuanxue-email-staging` | `9566459de4c54a808ac0cba8e691ddd3` |
| Events Queue | `xuanxue-events-staging` | `733d2af3bcd54aae923858e253997028` |
| Hyperdrive | `xuanxue-staging-neon` | `997c773bdb46458bab6af316630aad8c`；缓存关闭 |
| Hyperdrive cached | `xuanxue-staging-neon-cached` | `99d5848802b54b24925d8d5f1dfd5ad3`；创建参数 max_age=60 |
| Worker | `xuanxue-web-staging` | secrets 占位版本已创建，业务部署待完成 |
| Worker | `xuanxue-jobs-staging` | secrets 占位版本已创建，业务部署待完成 |
| Web 限流 | RL_AUTH / RL_AI / RL_API | `21002` / `21004` / `21006`，与模板既有 namespace 隔离 |
| Stripe Sandbox endpoint | 本项目 staging billing webhook | `we_1USIw1L3UTpBAoXoC4Ef0AHA` |

未修改或删除 `web-staging`、`jobs-staging`、`files-staging`、`saas-staging-*` 等其他项目资源。未更改套餐、账单、Stripe live 或既有 webhook endpoint。

## 已执行步骤与核验

1. `neonctl` 显式使用上述项目/分支，核对 PG18、区域、组织后新建数据库。仅以 SQL 新建 `migrator`、`app`、`readonly`，未通过 Neon Console/CLI 创建角色。密码安全随机生成，通过 stdin 交给容器内 psql，未放入 OS 命令参数。三角色的 superuser、CREATEDB、CREATEROLE、REPLICATION、BYPASSRLS 与 `neon_superuser` 成员身份均为 false。
2. 默认 owner 将数据库交给 migrator，并撤销临时 membership。由 migrator 完整执行 `infra/local/initdb/02-db-grants.sql`，public owner=migrator，app 有 USAGE、无 CREATE。初始化时一次本地凭据文件写入错误发生在角色事务提交后，随后仅重设本次新建三角色的随机密码并重新核验，没有删角色或改动其他项目。
3. 三个非 pooled、TLS require 直连 URL 保存到主 checkout 的 `.env.staging-neon`，已确认 git 忽略和权限 600。临时 owner URL 仅留进程内存，未写入文件。
4. 以 migrator 执行 `pnpm --filter @xuanxue/db db:migrate`，退出 0。数据库迁移记录 14 条，与 journal 14 项一致。app 建表、app 修改 audit_log、readonly 删除 plan 三个事务探针均 permission denied，事务未留下改动。
5. 核对 staging/app 后，通过进程环境明确注入目标，执行 `pnpm billing:seed`、`BILLING_SYNC_MODE=test pnpm billing:sync`，均退出 0。仅使用指定 `sk_test`；Stripe Sandbox account id 为 `acct_1UMwpCL3UTpBAoXo`。同步 6 条 Stripe 报价，`reading_single` 为 100 积分/99 美分，`reading_five` 为 500 积分/399 美分，两项 Stripe mapping 均 active 且已替换 unsynced ID。通用 seed 留下的 PayPal mapping 保持 inactive，未构建或调用 PayPal provider。
6. 先列资源避免重名后，新建上述 R2、KV、Queues、两个 Hyperdrive。Hyperdrive 使用 app 非 pooled URL；通过仓库已安装 Wrangler 导出的命令 registry 调用实际 create handler，凭据从 stdin 进入内存，不放入 OS argv，也不经 Cloudflare API MCP 写入；Wrangler 持久日志关闭。关缓存与 60 秒缓存配置已分别创建，ID 回填两 app 的 `env.staging`。本项目不启用模板 AI 故障注入；staging 沿用半小时 reduced Cron。
7. 通过 Stripe Sandbox API 新建 endpoint，URL 为 `https://xuanxue-web-staging.saas-jobs.workers.dev/api/billing/webhooks/stripe`，API version 为 `2026-09-30.endive`。9 项事件逐一取自代码 switch：`checkout.session.completed`、`checkout.session.async_payment_succeeded`、`invoice.paid`、`invoice.payment_failed`、`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`、`charge.refunded`、`charge.dispute.created`。返回 `livemode=false`。未修改已有 endpoint。
8. 以 600 临时 JSON 文件为输入执行 `wrangler secret bulk --env staging`，完成后删除临时文件。web 名称：BETTER_AUTH_SECRET、TURNSTILE_SECRET_KEY、GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET、DEEPSEEK_API_KEY、BOOTSTRAP_ADMIN_EMAILS；jobs 名称：STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET。随机管理员凭据保存主 checkout 的 `.env.staging`（git 忽略、600），账号尚未注册/验证。
9. Google OAuth 缺少两项时，实际 `parseAuthEnv` 报缺项、`checkEnv` 返回 500；补入测试字段后同一 gate 通过。因此按协调者决定，Google 两项仍为必需，staging 写入明确占位值满足启动校验，**Google 按钮不可用**，待 D2 正式域名与真实 OAuth 应用。未修改认证运行时逻辑。Turnstile 使用 Cloudflare 官方始终通过的测试 key 对。
10. `gh secret set STAGING_MIGRATION_DATABASE_URL --env staging` 从 stdin 写入迁移 URL，名称已复核。已有 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 保留；未设置 `STAGING_ENABLED`，合并后由协调者启用。
11. 按本地 `xuanxue_dev` 的实际 `ai_model` 行复制 `deepseek-flash`，包括 provider、pricing、params_schema 等字段，使用新 UUIDv7。`x-text` 核对为 thinking=false、maxOutputTokens=6000。以 migrator 写入六项 `readings.<kind>.modelKey`，均为 `deepseek-flash`，id 均 UUIDv7。
12. `pnpm staging:check-secrets` 退出 0。只缺可选 RESEND_API_KEY / AI_GATEWAY_TOKEN / SENTRY_DSN 与 web R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY。邮件默认 log、文本 DeepSeek 直连，不启用 Sentry。

## 仓库补正

- staging workflow 使用实际 workers.dev URL。Sentry token 通过 env 供两个 release 步骤判断；未设置时跳过。客户端 map 删除为独立步骤，不依赖 Sentry。
- secret checker 按模板的 billing providers、OAuth、Turnstile 开关派生，当前 Stripe + Google，无 PayPal/GitHub 必需项，并有配置切换测试。
- billing sync CLI 原无条件要求 PayPal，现按已启用 provider 校验凭据与构建实例；保留 test-only、Stripe sk_test 与 PayPal sandbox 限制。新增 3 个离线测试，纳入根 `pnpm check`，不依赖真实凭据。

## 已知限制：报告邮件链接仍指向占位域名

`apps/web/src/features/readings/generate.ts:189–197` 调用 `siteOrigin(body.site, requestURL, templateConfig)`，随后以该 origin 拼接报告邮件的 `/app/<workspace>/readings/<reading>`。`apps/web/src/features/site/site.ts:43–50` 对非 `.localhost` 请求返回 `config.sites.west.hosts[0]` 的 HTTPS origin。

直接调用实际函数，输入本项目 staging 的 `/api/readings` URL 与 site=west，结果为 `https://xuanxue-west.example`。同一输入的 `requestSiteOrigin` 会回退到正确 workers.dev APP_URL，因此这个问题具体位于报告邮件 origin 的选择，不能靠修改 APP_URL 解决。

这是源码函数复现证据，不冒充真实购买或邮件投递验收。首次预检曾按原任务暂停，随后协调者明确接受此 staging 限制并要求继续；修复由协调者单独分支处理。本分支未修改站点解析/认证运行时。

## 待完成

- 本地验证已全部通过：`pnpm check` 退出 0（Biome 1142 文件；Node 测试共 24/24）、`pnpm typecheck` 退出 0（17/17 任务）、`pnpm test` 退出 0（32/32 任务；1677 用例通过、34 跳过）、独立 `node --test scripts/staging/staging.test.mjs` 退出 0（7/7）。日志为 `/tmp/xuanxue-staging-{check,typecheck,test,staging-test}.log`；测试只使用本地隔离库，未注入 Neon URL。
- 解决或明确接受上述邮件链接限制后，以部署时 HEAD 完整 SHA 按 workflow 构建、移除客户端 maps、部署 jobs → web。
- `wait-healthy` 的 HTTP 200、db.up、完整 SHA 匹配；原 staging Playwright 冒烟。
- 注册/验证管理员与普通测试用户，将测试用户凭据追加到受限 `.env.staging`；用官方 4242 测试卡购买 Single，生成 numerology-full，核对报告、账本与积分 100→0、邮件链接。
- 提交、推送、PR；合并后协调者设置 `STAGING_ENABLED=true` 并核验首次自动发布。
- D2 正式域名/真实 Google OAuth；Resend 实际邮件投递与 Sentry 尚未启用，R2 签名凭据未配置。
