# xuanxue staging 操作记录

2026-10-19 UTC。本项目使用 Neon + Cloudflare workers.dev；本文只记录本次实际操作，不引用模板历史验收作为本项目证据。

**staging 已启用：首次手动部署、完整 SHA/db 探活、原有冒烟与真实购买详批均通过。** 报告邮件占位域名是协调者已接受的 staging 限制（未配 Resend，不发送实际邮件），由协调者在单独分支修复 siteOrigin。本分支不改站点代码。自动发布配置已完成，`STAGING_ENABLED` 仍由协调者在合并后设置；首次 main 自动发布尚待验收。

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
| Worker | `xuanxue-web-staging` | 业务产物已部署（版本见下方） |
| Worker | `xuanxue-jobs-staging` | 业务产物已部署（版本见下方） |
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

## 首次部署与验收（2026-10-19 UTC）

- 部署源码 SHA：`853a55a6ab408789f3995345f60dd8b530fd5a47`。后续提交仅补充本文及 decisions 的验收记录，不改变已部署代码。
- 按 workflow 顺序完成 jobs dry-run bundle、web staging Vite build，再独立删除全部 `dist/client/**/*.map`，最后部署已构建 jobs → web（均 no-bundle）。构建使用两个不可达的本地 Hyperdrive 占位连接，未注入 Neon 凭据；未上传 Sentry release/maps。客户端 map 数量终检为 0。
- jobs Worker version：`c688da0b-d2bc-421e-853e-41db12dfeea2`；web Worker version：`95fe58b6-5dbf-4828-87f2-5dca22938fa5`。两端 APP_VERSION 均为上述完整 SHA。
- `pnpm staging:check-secrets` 退出 0；`node scripts/staging/wait-healthy.mjs <workers.dev>/api/health <完整SHA>` 退出 0，独立 Node fetch 返回 HTTP 200、db.status=up、完整 SHA 一致。本机 Python urllib 独立观测返回 403，Node health 及浏览器正常；未因此更改服务配置。
- 原命令 `STAGING_URL=<workers.dev> APP_VERSION=<完整SHA> pnpm --filter @xuanxue/web exec playwright test --project staging` 退出 0，3 passed（33.3s），覆盖首页、定价、真实随机注册进入个人空间并注销。未修改原测试/断言/超时，也未加入 mock。日志 `/tmp/xuanxue-staging-smoke.log`。
- 管理员和普通测试用户均经真实英文注册表单创建，注册与密码登录始终留在 workers.dev。因 log 邮件通道无法投递给 `.test` 邮箱，仅对本次 staging 管理员测试数据由 migrator 设置 email_verified=true；随后真实注销、密码登录，bootstrap 产生 `admin.user.bootstrap` / `session.create` 审计，`/admin` 可见。此步骤不声称验证了邮件投递/收信流程，也没有修改认证运行时。
- 普通用户的邮箱/随机密码追加到主 checkout `.env.staging` 的 `STAGING_TEST_EMAIL` / `STAGING_TEST_PASSWORD`，原管理员凭据保留；文件仍 git 忽略且权限 600。值未输出、提交或写入本文。
- 普通用户在首页计算后点击解锁，UI 显示 100 credits/$0.99 与 500 credits/$3.99，选择 Single Reading。真实 Stripe Checkout 明确显示 Sandbox，使用官方 4242 测试卡支付 99 美分 USD（关闭额外 Link 信息保存）；成功回到本项目 workers.dev，支付后自动继续原 numerology-full 生成。浏览器会话未切断，没有伪造付款、Webhook、Turnstile 或 AI 响应。
- Stripe `checkout.session.completed` 事件 `evt_1USJ6nL3UTpBAoXoRyzlFJn5` 为 processed / attempts=1 / API 2026-09-30.endive，processed_at=`2026-10-19T16:08:32.685Z`；付款 `01a154eb-efae-7512-b17a-1c7b1d467ed2` 为 succeeded / 99 USD（整数最小单位）。
- 唯一 purchase 批次 `01a154eb-f40c-7035-87d8-632d523ebca2` 发放 100，剩余 0；账本正好 grant +100、consume −100，hold 为 captured / amount=100 / captured_amount=100。未直接写入或补造付款、积分、报告。
- 真实报告 `01a154ec-0da7-7759-a82d-a6bc3fdcb5c9` 为 numerology-full / en / ready / 100 credits / model=deepseek-flash，Markdown 正文 9664 字符；对应 AI 消息 completed，input_tokens=522、output_tokens=2530、credits=100。浏览器通过 Open the saved report 打开 `/app/u-obzo9kcb/readings/01a154ec-0da7-7759-a82d-a6bc3fdcb5c9`，可见报告标题与全部八个英文章节（Overview、Life Path、Core Numbers、Personal Year、Love and Relationships、Career and Money、Wellbeing Habits、Guidance）。辅助脚本最初用宽泛 h1 选择器触发 strict-mode 失败；改为报告的确切标题及八章节定位后通过，未改应用或原有冒烟测试。
- 本地完整验证全部通过：`pnpm check` 退出 0（Biome 1142 文件；Node 测试共 24/24）、`pnpm typecheck` 退出 0（17/17 任务）、`pnpm test` 退出 0（32/32 任务；1677 用例通过、34 跳过）、独立 `node --test scripts/staging/staging.test.mjs` 退出 0（7/7）。日志为 `/tmp/xuanxue-staging-{check,typecheck,test,staging-test}.log`；测试只使用本地隔离库，未注入 Neon URL。

## 仍待协调者 / 正式域名

- 合并后设置 `STAGING_ENABLED=true`，核验首次 main CI 成功触发的自动发布；本分支没有启用此变量，也未合并 PR。
- 协调者单独分支修复报告邮件 siteOrigin；当前默认 log 通道未发送实际邮件。
- D2 正式域名与真实 Google OAuth（当前只有启动占位）；东方站域名访问不在本轮 workers.dev 验收范围。
- Resend 实际投递、Sentry、R2 签名凭据未配置；这些可选能力不计作已验收。
