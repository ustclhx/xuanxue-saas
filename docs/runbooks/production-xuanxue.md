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

## 当前阻塞与验证

- 步骤 5 阻塞：浏览器访问 `https://resend.com/domains` 跳回公开首页，当前 Chrome 会话未登录。已停在 `https://resend.com/login` 并保留页面，请用户登录后续跑。没有新建 Resend 域名、没有写邮件 DNS 或 API key。没有访问/修改任何既有 Resend 项目。
- 按用户要求顺序暂停后续外部操作：步骤 6 Google OAuth、步骤 7 其余 secret、步骤 8 完整生产预检/dry-run 尚未执行。未尝试读出 staging secret；`DEEPSEEK_API_KEY` 来源仍待步骤 7。
- 静态检查发现后续预检需协调：`template.config.ts` 仍为 billing.enabled=true、providers=['stripe']；`scripts/staging/check-secrets.mjs` 的 `getSecretRequirements()` 因此仍要求 web/jobs 的 `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`，且 CLI 固定检查 staging。当前 production 不设 PAYMENT_MODE，但 checker 不读取它。本轮没有修改支付配置、没有写占位支付 secret，也没有把 Stripe 缺项豁免后声称通过生产门槛。
- `pnpm check` 退出 0（日志 `/tmp/xuanxue-production-check.log`）。只改资源 ID、公开 site key 与运维记录，未新增无业务逻辑测试。生产资源检查、dry-run 和上线不开支付配置确认仍未完成，2.1 不勾选。

## 待完成

- 步骤 5–7：Resend、Google OAuth 与其余生产 secrets。
- 步骤 8：支付关闭前提下的 secrets 预检与两个 app 的 production dry-run。
- 协调者确认上线不开支付的配置、发件地址代码与发布前 Cron 策略；本轮不修改这些业务行为。
