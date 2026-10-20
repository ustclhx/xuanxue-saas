# xuanxue production 资源准备

2026-10-20 UTC。对应 `launch-v1-production` 2.1；只准备资源，不部署业务 Worker，不启用 GitHub 生产开关，任务保持未勾选。

## 用户决定与边界

- Cloudflare account：`170a06d37ad50396b19943eb6b77a21d`。
- 东方站 `ganjiday.com`，西方站 `arcanumber.com`，一个 web Worker 绑定两个 custom domain。
- 暂不开支付：不配置 Stripe live / PayPal，不写支付密钥，不运行 `billing:sync`。
- 邮件使用 Resend，两站分别验证 `send.ganjiday.com`、`send.arcanumber.com`；按站点区分发件地址的代码由协调者处理。
- 不使用 Sentry。仅操作本轮新建资源；`production-neon.md` 属于模板项目，只参考流程。
- Google OAuth 同意屏幕按协调者最新决定使用 `https://arcanumber.com/privacy`、`https://arcanumber.com/terms`，不使用旧 `/legal/...` 路径。
- 密钥只进入 Wrangler secrets 或主 checkout 的 gitignored、600 文件；本文不含密钥。

## 资源

| 类型 | 名称 | ID / 配置 |
| --- | --- | --- |
| Neon 组织 | 既有组织 | `org-ancient-mountain-81615147`，既有 Launch 计划，未升级 |
| Neon 项目 | `xuanxue_production` | `orange-darkness-65572404`，PG18，`aws-us-east-2` |
| Neon 分支 | `main` | `br-late-wind-b54667xl`，CLI 新项目默认分支 |
| Neon 数据库 | `xuanxue_production` | database/public owner=`migrator` |
| PITR | 新项目默认历史保留 | `86400` 秒（24 小时），未延长、未增购备份服务 |
| R2 FILES | `xuanxue-files-production` | Standard，私有；CORS 为两个 HTTPS 裸域 |
| KV CACHE | `production-xuanxue-production-cache` | `b78752af8dc14c749396378288c3e52f` |
| Email Queue | `xuanxue-email-production` | `b02549a1c32343d1969fccab7015a00c` |
| Events Queue | `xuanxue-events-production` | `1a4837a223ce40ccaef0ed405bb3614c` |
| Hyperdrive | `xuanxue-production-neon` | `be92ef3d14a94d27bd87ed3a459d32ce`，缓存关闭 |
| Hyperdrive cached | `xuanxue-production-neon-cached` | `91c3e6d0fd5d44ba8f5c0864bb9450d9`，创建参数 max_age=60 |
| Web 限流 | RL_AUTH / RL_AI / RL_API | `22002` / `22004` / `22006`，独立于 staging `21002/21004/21006` 与模板 `1001–1009` |
| Turnstile | `xuanxue-production` | site key `0x4AAAAAAFdAs5UkBviOud_w`，managed，hostnames 为两个裸域 |
| Web Worker | `xuanxue-web-production` | secret put 自动创建的空壳，尚未部署业务产物、routes 或绑定 |
| Google Cloud 项目 | `xuanxue-production` | project ID 同名，project number `872796655195`，无组织；OAuth 配置待支持邮箱决定 |

## 执行记录

1. 列出组织项目确认无同名项目，并只读核对 staging `noisy-fire-19510813` 的 PG18 / `aws-us-east-2`。通过 `neonctl projects create --no-secrets` 新建上述项目，未输出连接凭据。项目沿用当前计划默认配置（1 CU、suspend timeout 0、24 小时历史保留），未升级付费计划。
2. 默认 owner 通过 SQL 创建 `migrator` / `app` / `readonly`，三角色均无 SUPERUSER、CREATEDB、CREATEROLE、REPLICATION、BYPASSRLS 或 `neon_superuser` 成员身份。数据库交给 migrator 后撤销 owner 的临时 membership；migrator 完整执行 `infra/local/initdb/02-db-grants.sql`，public owner=migrator，app 有 USAGE、无 CREATE。
3. 三个非 pooled、TLS require URL 保存到主 checkout `/Users/hxlee/workspace/xuanxue-saas/.env.production-neon`（`NEON_MIGRATOR_URL`、`NEON_APP_URL`、`NEON_READONLY_URL`），已确认 git 忽略、权限 600。临时 owner URL 仅在进程内存；凭据未放入 argv、日志或仓库。
4. 核对 `xuanxue_production / migrator` 后以进程环境执行 `pnpm --filter @xuanxue/db db:migrate`，退出 0；明确注入生产 app URL 执行 `pnpm billing:seed`，退出 0；未运行 sync、未调用支付商。迁移记录 14/14 与 journal 一致；seed 后有 free/pro/team/reading_single/reading_five。app 建表、app 审计 UPDATE、readonly DELETE 三个事务探针均拒绝 42501，未留下改动。早于迁移完成的一次核验曾读到 0 条记录/表未创建；以上为迁移与 seed 完成后的重新核验结果。
5. Wrangler 4.146.0 OAuth 已登录目标 account。先 list R2、KV、Queues、Hyperdrive，确认无同名生产资源后逐项创建。R2 CORS 回读确认 origins=`https://ganjiday.com`、`https://arcanumber.com`，methods=PUT/GET/HEAD，headers=Content-Type/If-None-Match，expose=ETag，maxAge=300；队列回读确认均 0 producer/consumer（尚未发布）。
6. Hyperdrive 沿本项目 staging 做法，使用仓库 Wrangler 导出的 command registry 调用实际 create handler；app 非 pooled TLS URL 经 stdin 进入内存，未进入 OS argv；持久日志指向临时 `/dev/null` 符号链接。分别指定关闭缓存、max_age=60，新 ID 已回填 web/jobs `env.production`。KV CLI 按环境为名称添加 `production-` 前缀，资源实际名称见上表。
7. Wrangler 无 DNS / Single Redirect 管理命令，改用已登录的 Cloudflare 控制台。在两个原先无 DNS 记录的 zone 各新增 `www` 的 A 记录 `192.0.2.1`（仅作重定向入口，Proxied、TTL Auto）；各新增并启用 `xuanxue-www-to-apex` Single Redirect，条件 `http.host eq "www.<域名>"`，动态目标 `concat("https://<域名>", http.request.uri.path)`，301，Preserve query string=true。规则列表均确认 Enabled；未给裸域创建业务 Worker 绑定或部署代码。
   - 独立 Node fetch 对两个 www 域名分别执行 HTTP 与 HTTPS 请求 `/production-redirect-check/path?source=prep&v=1`（redirect=manual），四项均返回 301，Location 为对应 HTTPS 裸域，路径和查询串完全一致。
8. 创建一个 Turnstile widget（事前 list 为空），两个 hostnames、managed、no_clearance。公开 site key 已写 web production vars；secret 从捕获的 CLI JSON 在进程内存中经 stdin 传给 `wrangler secret put TURNSTILE_SECRET_KEY --env production`，退出 0。Wrangler 为此前不存在的 `xuanxue-web-production` 自动建立仅 `export default { fetch() {} }` 的空壳以保存 secret；没有执行非 dry-run deploy，没有上传业务产物或配置 custom domain。备份保存在主 checkout `.env.production-turnstile`（gitignored、600）；create 原始 JSON 与 secret 均未打印。
   - widget list 核对两个域名、managed / no_clearance；web production secret list 仅有 `TURNSTILE_SECRET_KEY`。
9. 协调者允许跳过 Resend 后继续步骤 6–8。Google Cloud 当前 Chrome 会话已登录；先搜索确认无同名项目，创建独立 `xuanxue-production`，没有绑定结算或修改模板项目。OAuth 初始配置填写 Arcanumber 后，支持邮箱下拉框仅提供当前登录 Gmail，并显示“无群组”，无法选择指定 `support@arcanumber.com`。因此未保存同意屏幕、未创建客户端；已向协调者询问保留指定邮箱还是 Testing 暂用当前登录邮箱。法律链接仍按最新决定为 `/privacy`、`/terms`。
10. 步骤 7：先 list 生产 web secrets，仅有 Turnstile；随机生成独立 `BETTER_AUTH_SECRET`，与指定 `BOOTSTRAP_ADMIN_EMAILS` 分别通过 stdin `wrangler secret put --env production` 写入，均退出 0；未打印值、未覆盖已存在 secret。Cloudflare secret list 不提供真值读取，不能读回 staging 的 `DEEPSEEK_API_KEY`；已请求用户把同一把 key 通过 600、gitignored 的主 checkout `.env.production-ai` 安全输入，尚未写入生产 DeepSeek key。未擅自搜索其他项目凭据。
11. 步骤 8 的本地构建/dry-run 已完成，源码 SHA=`3f00729eefa7731e0a601d83f674cdfd6edadf0b`（其后仅补运维记录）。jobs `wrangler deploy --env production --dry-run --outdir dist --var APP_VERSION:<完整SHA>` 退出 0。web 构建显式设置 `CLOUDFLARE_ENV=production`、同一 APP_VERSION、APP_URL/WEST_URL=`https://arcanumber.com`、EAST_URL=`https://ganjiday.com`，两个 local Hyperdrive URL 均为不可达的 `127.0.0.1:1/unused` 占位；未加载 Neon URL。web build 退出 0、预渲染 503 页、无 `env.invalid`；公告/定价查询按既有设计降级，Server Function API 弃用警告保留。随后对生成的 `dist/server/wrangler.json` 执行 `wrangler deploy --config ... --dry-run`，退出 0；核对扁平配置的 Worker 名、两条 custom_domain、APP_URL、新 KV/Hyperdrive ID 与公开 Turnstile key 全部对应 production。
    - 日志：`/tmp/xuanxue-production-jobs-dry-run.log`、`/tmp/xuanxue-production-web-build.log`、`/tmp/xuanxue-production-web-dry-run.log`。web gzip 约 2582 KiB，jobs gzip 约 741 KiB。两次均明确 `--dry-run: exiting now`，没有业务产物上传或真实部署；没有上传 Sentry release/source map。私有 SSR dist 可能包含本地预览 dotenv，不提交、不公开分享。
    - 构建用的本地 dotenv 不含 SENTRY_DSN / MIGRATION_DATABASE_URL；没有创建或启用 Sentry。`node scripts/production/check-wrangler-envs.mjs` 退出 0，未改 PAYMENT_MODE、支付 providers、邮件代码或 Cron 策略。

## 当前阻塞与验证

- 步骤 5 延后（协调者明确允许跳过）：浏览器访问 `https://resend.com/domains` 跳回公开首页，当前 Chrome 会话未登录。已停在 `https://resend.com/login` 并保留页面，请用户登录后续跑。没有新建 Resend 域名、没有写邮件 DNS 或 API key。没有访问/修改任何既有 Resend 项目。
- 步骤 6 暂停 OAuth 保存，等待支持邮箱决定；步骤 7 的 DeepSeek key 等待安全输入。Auth secret 与管理员名单已准备；完整生产预检不能宣称无缺项。
- 静态检查发现后续预检需协调：`template.config.ts` 仍为 billing.enabled=true、providers=['stripe']；`scripts/staging/check-secrets.mjs` 的 `getSecretRequirements()` 因此仍要求 web/jobs 的 `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`，且 CLI 固定检查 staging。当前 production 不设 PAYMENT_MODE，但 checker 不读取它。本轮没有修改支付配置、没有写占位支付 secret，也没有把 Stripe 缺项豁免后声称通过生产门槛。
- 以现有 `getSecretRequirements(templateConfig)` 对比 production 的 secret 名称：web 已有 BETTER_AUTH_SECRET、BOOTSTRAP_ADMIN_EMAILS、TURNSTILE_SECRET_KEY；缺 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET、任务要求的 DEEPSEEK_API_KEY，以及已授权延后的 RESEND_API_KEY。Stripe 两项按协调者要求仅记录配置冲突。jobs Worker 尚不存在，secret list 退出 1，不能声称远端 secret 检查通过；尚无邮件 secret 写入需求，因此未为了检查新建 jobs 空壳或部署。
- `pnpm check` 退出 0（日志 `/tmp/xuanxue-production-check.log`）。只改资源 ID、公开 site key 与运维记录，未新增无业务逻辑测试。上线不开支付配置确认仍由协调者处理，2.1 不勾选。

## 待完成

- 步骤 5：等待用户登录 Resend 后创建并验证两个发件域名、准备仅发送 key。
- 步骤 6：等待支持邮箱决定后完成 External / Testing 同意屏幕、两个授权域名、`/privacy` / `/terms` 链接和两个 Google 回调，创建 Web 客户端并经 stdin 写 web secrets；当前仅项目创建完成。
- 步骤 7：等待安全输入 staging 同一把 DeepSeek key；Auth secret 与管理员名单已完成。
- 步骤 8：两个 app 的 production dry-run 已通过；仍需补齐上述非支付 secrets 并复核真实运行时凭据，才能满足完整预检。dry-run 不证明远端认证、邮件或 AI 联通。
- 协调者确认上线不开支付的配置、发件地址代码与发布前 Cron 策略；本轮不修改这些业务行为。
