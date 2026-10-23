# v1 上线与收录记录

2026-10-20 UTC（台北 2026-10-21）。Arcanumber（en）与 Ganjiday（zh-Hant / ko）当前部署 v0.1.1，付款保持即将开放。

## 当前状态

| 项目 | 状态与证据 |
| --- | --- |
| 2.1 Worker 资源 / secrets / dry-run | 已完成；原预检见 [production runbook](production-xuanxue.md) |
| GitHub production environment | 三项必需 secret 名称齐全；新建独立生产 token，剪贴板写入后清空；已按本轮明确授权在浏览器批准 production |
| 2.2 迁移 → seed 确认 → jobs → web | 部署与无支付验收完成：v0.1.1 发布、双域健康完整 SHA、9 项只读冒烟、Google 管理员、新账号删号与原密码登录拒绝通过；**未勾选**：后台配置（模型、详批开关与价格）待 PayPal 上线与 D1 选模型后完成，`e2e-live` 三语冒烟未运行（本轮只跑只读 `e2e/production`） |
| 2.3 Lighthouse | 六页移动端 HTML/JSON 已保存；西方首页 LCP 2.85s 未达 2.5s 门槛；未修改性能代码 |
| 3.1 GSC / Bing | 两个 Domain 资源 DNS TXT 验证通过，两个 sitemap 均显示成功；Bing 等待用户登录，尚未导入 |
| Cloudflare Web Analytics | 手动模式保持；PR #44 已随 v0.1.1 发布，首页/定价含本站 token，已认证 app/admin 无 beacon；匿名 admin 的 404 HTML 仍含 beacon，协调者已接受为非阻断已知小问题 |
| support 收件 | 两条 Routing Active、目标 Verified；实际收信仍需用户确认 |
| Resend | 两个 `mail` 发件域名的 8 条 DNS 已写入并通过公共解析核对；两个域名均 Verified；两把仅限单域的发送 key 已写入生产 jobs secrets；生产邮件仍为 log，未发信验收 |
| 支付 / 详批 / Sentry | 未配置新密钥；未运行 billing:sync、未改套餐价格、未启用详批模型 |

## Resend 发件域名与 DNS（2026-10-21）

准备历史（[PR #45](https://github.com/ustclhx/xuanxue-saas/pull/45)）：2026-10-21T11:26:27Z 完成准备。此前 11:19:06Z 因未登录停止；用户自行登录后续跑，登录阻塞已解除。已核对当前账号 / 团队标识 `lhx960924` 及其 Gmail（完整邮箱不入文档）。API keys 列表共 3 项，仅记录名称：`saas-production`、`saas-template-staging`、`Onboarding`；未查看 key 详情、复制或记录真值，未新建、修改或轮换 key。

| 站点 | 发件域名 / Resend 控制台 | 区域 | 当前状态 |
| --- | --- | --- | --- |
| Arcanumber（`arcanumber.com`） | [mail.arcanumber.com](https://resend.com/domains/6a395056-90c2-4319-bcc3-3af13187659c) | 默认 North Virginia（`us-east-1`） | 2026-10-21 11:41 UTC 回读 Verified |
| Ganjiday（`ganjiday.com`） | [mail.ganjiday.com](https://resend.com/domains/dbe85701-aa62-45b0-a343-8e4d0163d9af) | 默认 North Virginia（`us-east-1`） | 2026-10-21 11:41 UTC 回读 Verified |

按本次用户要求使用 `mail.*`，取代 [资源准备历史](production-xuanxue.md#用户决定与边界) 中的 `send.*` 发件域名建议。两个域名均选择 Manual setup，保留默认区域与 Return-Path `send`；Enable Sending 为 on、Enable Receiving 为 off。页面 SPF 段实际给出两条 CNAME，未给出独立 SPF TXT 或反馈 MX；下面按控制台原值记录，不补造旧式 SPF/MX。所有记录 TTL 均为 Auto；CNAME 明确要求 DNS Only。名称为控制台显示的相对于各站裸域 zone 的名称。

### Arcanumber DNS 清单（已写入）

| 用途 / 必选性 | 类型 | 名称（zone：`arcanumber.com`） | 完整值 | TTL / 代理 |
| --- | --- | --- | --- | --- |
| DKIM（Domain Verification） | TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCv6Ay3snFAU3B09VyMmLLq470m4CsYK1qUiJn2d8rF7kGXvLfq/0YPE25xm6st35GLnHQAuDiu0fAPEn66j8c56/I5nJAk5mif0OpW+J92+MpmNRX0f6ts3xwVXknzLhYtP/KtFIB1B4/7aeGfb8xnKGdh/PTZbu7PZQldI2imYQIDAQAB` | Auto |
| SPF 段 / Enable Sending | CNAME | `rsend.mail` | `rsend.forge.rmta.net` | Auto / DNS Only |
| SPF 段 / Enable Sending | CNAME | `send.mail` | `send.forge.rmta.net` | Auto / DNS Only |
| DMARC（Optional，控制台建议） | TXT | `_dmarc` | `v=DMARC1; p=none;` | Auto |

### Ganjiday DNS 清单（已写入）

| 用途 / 必选性 | 类型 | 名称（zone：`ganjiday.com`） | 完整值 | TTL / 代理 |
| --- | --- | --- | --- | --- |
| DKIM（Domain Verification） | TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDyqMnCPtYw6rK2SQA5q6m4nXIjaEt2F9U26cT2tpvx6jTFaqPOKd/sg3peg6EV1SSbanCB0g4GYyIUczR75epX1bvAV9r+pwMhGOXixfTI7Sc5aHVI/EvwU9AMkQZJX7tWv58JxYNWBMoNmuzTrT73ormS21NmPwkLDiezS8DW5QIDAQAB` | Auto |
| SPF 段 / Enable Sending | CNAME | `rsend.mail` | `rsend.forge.rmta.net` | Auto / DNS Only |
| SPF 段 / Enable Sending | CNAME | `send.mail` | `send.forge.rmta.net` | Auto / DNS Only |
| DMARC（Optional，控制台建议） | TXT | `_dmarc` | `v=DMARC1; p=none;` | Auto |

### DNS 写入与验证执行

本轮经用户明确授权，依据 [PR #45](https://github.com/ustclhx/xuanxue-saas/pull/45) 的完整公开记录执行。写入前分别查看两个 zone 的完整现有记录，无 `resend._domainkey.mail`、`rsend.mail`、`send.mail`、`_dmarc` 同名记录；两份 DKIM 均与 PR #45 和对应 Resend 页面逐字符一致。逐条新增后回读值、DNS only 与 TTL Auto；保留原有 Email Routing、裸域 MX/SPF、`cf2024-1._domainkey` 和其他业务 DNS。

| Zone | DKIM / 两条 CNAME / DMARC 写入完成并回读（UTC） | 公共 DNS 验证 | Resend Verify |
| --- | --- | --- | --- |
| `arcanumber.com` | 2026-10-21 11:35 前 | 11:35:15，`dig +short` 指向 `@1.1.1.1`，四项均解析到上表完整值 | 11:36 点击 Verify DNS Records；最初 Pending；约 5 分钟后（11:41 UTC）回读 Verified，无需重试 |
| `ganjiday.com` | 2026-10-21 11:36 前后 | 11:36:23，相同公共查询四项均解析到上表完整值 | 11:36 点击 Verify DNS Records；最初 Pending；约 5 分钟后（11:41 UTC）回读 Verified，无需重试 |

生产 `xuanxue-jobs-production` 的 secret list 预检为空，尚未创建新 API key、尚未写入 `RESEND_API_KEY`。原要求为一个 `xuanxue-production-jobs`、Sending access、仅两个 `mail` 子域；域名通过验证后，控制台 Domain 下拉仍为单选，选 `mail.ganjiday.com` 会替换 `mail.arcanumber.com`，无法同时限定两域。`All domains` 还包含既有 `ezarouter.cc`，超出本轮授权，因此取消未提交的创建表单，等待用户决定，不擅自放宽范围或创建两把 key。三个既有 API key 保留。`EMAIL_TRANSPORT` 仍为默认 `log`，未改 `EMAIL_FROM` 或 Wrangler 配置，未部署应用代码、未发送测试邮件。上段中关于 API key 的「未创建、等待决定」结论已被下节取代。未完成项：`EMAIL_TRANSPORT` 切换与发信验收；当前不宣称发信联通通过。验证：`pnpm check` 退出 0（4 条既有警告），`git diff --check` 通过。

## Resend 发件 key（2026-10-21 UTC）

两个 `mail.*` 发件域名已 Verified。本轮分别新建仅发送（Sending access）、只限定对应单个域名的 API key：

| Key 名称 | 限定域名 | 创建时间（UTC） | 生产 secret 名称 | 写入成功时间（UTC） |
| --- | --- | --- | --- | --- |
| `xuanxue-production-east` | `mail.ganjiday.com` | `2026-10-21T12:05:19Z` | `RESEND_API_KEY_EAST` | `2026-10-21T12:05:38Z` |
| `xuanxue-production-west` | `mail.arcanumber.com` | `2026-10-21T12:06:02Z` | `RESEND_API_KEY_WEST` | `2026-10-21T12:06:18Z` |

创建时间按控制台提交操作记录。每个 key 创建后，通过复制按钮进入剪贴板，立即以 `pbpaste` 管道传入 `apps/jobs` 的 `pnpm exec wrangler secret put <上述 secret 名称> --env production`，成功后清空剪贴板；未显示完整值或将值写入文件。目标 Worker 为 `xuanxue-jobs-production`，随后执行 `pnpm exec wrangler secret list --env production`，仅确认上述两个名称均存在。

`EMAIL_TRANSPORT` 保持 `log`，未发送测试邮件、未修改代码、未运行代码部署命令、未修改域名或 Cloudflare DNS，也未操作既有 key。`secret put` 本身即时更新生产 Worker 的 secret；本记录只证明密钥写入完成，邮件发送验收仍未执行。

## v0.1.1 发布与复验（最新）

- 完整 SHA：`c0dc8cf9cdd075811ead3179b078f19c9fb15661`，包含 PR #43 删号修复与 PR #44 按站 Analytics token。
- 同 SHA [CI 39466361482](https://github.com/ustclhx/xuanxue-saas/actions/runs/39466361482) 与 [Deploy staging 39467310532](https://github.com/ustclhx/xuanxue-saas/actions/runs/39467310532) 全部成功后，创建 annotated tag `v0.1.1` 并推送。浏览器批准 production，`gh run watch --exit-status` 退出 0；[production 39467824210](https://github.com/ustclhx/xuanxue-saas/actions/runs/39467824210) 全部成功，迁移、jobs、web、两站版本健康、东方 6 / 西方 3 冒烟通过。未重跑、未修改代码/工作流、未新增支付/模型密钥或改价格。
- jobs version：`a626cb32-4bc4-4cea-87b5-6383b8937117`；web version：`4c696e11-9927-4081-9f05-f0630eef40ef`。独立 curl 两站 `/api/health` HTTP 200、db.up、完整 SHA 等于上述版本。
- 两站 `/`、`/pricing` 各恰好一个 `data-cf-beacon`，分别为 Arcanumber `aa32b146781b4880aa9686d85c3a8f66`、Ganjiday `21bda25feef743088c8ca9fb63b76a36`，均 `spa=false`，没有跨站 token。此前“无 beacon”证据属于 PR #44 发布前的 v0.1.0，不能代表当前公开页。
- 已登录西方站浏览器 `/admin` 正常显示 Admin/Overview、个人 `/app` 显示 Personal，两处 DOM 均无 beacon。匿名 `/app` 原始响应两站均为 307、空正文、无 beacon；curl 跟随跳转后的 `/login` HTML 含本站 beacon。两站匿名 `/admin` 原始 404 HTML 仍含本站 beacon；协调者明确接受为无用户数据的非阻断已知小问题，后续处理。本轮保留原始失败证据、不改代码，也不将此检查改写为通过。
- 删号复验通过：协调者允许使用新账号 `launch-test-20261020174555043@example.org`。真实注册进入 Personal（`u-n60blmh9`），退出后用密码重新登录成功，账号设置输入 DELETE 删除后跳转 `/login`；使用同一邮箱和同一原密码再次登录，页面显示 `Incorrect email or password.` 并停留登录页。后台随后观察到匿名化 `deleted+…@invalid` 测试用户、状态 Banned。密码只在本轮操作内存，完成后清空，未落盘。
- 旧账号 `launch-test-20261021@example.org` 保留：用管理员打开其用户详情（ID `01a15a3c-69eb-7092-8436-7568cbe8f06f`），可用操作只有 Impersonate user 与 Ban management，没有删除/匿名化入口。按协调者指示保留原 Active 状态，未封禁、未模拟登录、未写库。
- 2.2 部署与删号验收已完成，适用已批准的不开支付、不改价格、不启用详批模型范围；但 tasks.md 中 2.2 保持未勾选（后台配置与 `e2e-live` 未完成）。Lighthouse 不重跑，旧六页报告明确属于 v0.1.0，LCP 仍只记录；Bing 等待用户登录，2.3/3.1 保持未完成。

证据：[发布门禁](evidence/launch-v1/v0.1.1-release-gates.json)、[生产 Actions](evidence/launch-v1/v0.1.1-actions.json)、[健康与 Analytics curl](evidence/launch-v1/v0.1.1-http-analytics.json)、[浏览器与删号待办](evidence/launch-v1/v0.1.1-browser.json)。

## v0.1.0 生产部署与验收（历史）

- annotated tag：`v0.1.0`；完整 SHA：`661e627ea2300b63c7aca22efc771f8ddc1ef8bd`。
- 同 SHA [CI 39423060081](https://github.com/ustclhx/xuanxue-saas/actions/runs/39423060081) 与 [staging 39424024264](https://github.com/ustclhx/xuanxue-saas/actions/runs/39424024264) 成功后推送 tag；[production 39460843665](https://github.com/ustclhx/xuanxue-saas/actions/runs/39460843665) 全部成功，无重跑、无权限补正、无工作流或代码绕过。迁移成功；既有 seed 采用原只读确认，不改价格、不重新同步平台。
- jobs version：`29202879-925a-427e-84e1-3960711ccd09`；web version：`85ad35de-7283-4bdc-9fa4-6de8aa8d2914`。
- 两站 `/api/health` HTTP 200、db.up、完整 SHA 匹配；Actions 东方 6 passed、西方 3 passed，包含繁中/韩语首页与定价。该项目使用现有 `e2e/production` 只读套件；`e2e-live` 是支付联通套件，本轮没有运行支付测试。
- 独立 [HTTP 验收](evidence/launch-v1/production-http.json) 28/28 通过：两站 www `/x?y=1` 均 301 到裸域并保留路径/查询；首页、三语定价、英文四法律页、robots 与 sitemap 正常；规范公开页无 noindex，已核对繁中/韩语 privacy 按设计 noindex。
- 测试邮箱 `launch-test-20261021@example.org` 注册成功，进入个人空间 `u-2uc81072`；经账号设置退出并重新密码登录成功。输入 DELETE 提交删除后，页面返回 `Payment configuration is unavailable`，账号未删，不能宣称删除后登录被拒绝。未直接写库、未补支付密钥；测试密码只在操作内存中使用，不记录。协调者接手修代码，账号先保留，修复部署后再验。
- 删号原因据只读源码与配置推断：`apps/web/src/features/billing/deletion.server.ts` 的 before 初始化 `createPaymentRuntime`；当前 production 未设置 PAYMENT_MODE，`packages/billing/src/runtime.ts` 将模式校验失败映射为上述 503。此为需另行修复的已知上线风险，本轮不改代码。
- 管理员：指定 Google 账号注册后，账号设置显示邮箱已验证、社交账号无密码。此前 `/admin` 曾显示 `Not Found`；协调者报告重写生产 `BOOTSTRAP_ADMIN_EMAILS` 后，本轮从账号设置退出，使用同一 Google 账号重新登录，`https://arcanumber.com/admin` 正常显示 Admin 导航、Overview 与 Shortcuts，管理员权限验收通过。未设置密码、未直接写库提权、未读取或改写 bootstrap secret 真值。旧 OAuth 流程的 `state_mismatch` 为历史记录，新登录正常。

## Lighthouse 移动端实测

Lighthouse 13.5.0，独立 headless Chrome，默认移动设备与模拟网络/CPU。逐页测试 UTC、Chrome 版本、设备、网络和原始指标见 [汇总 JSON](evidence/launch-v1/lighthouse-summary.json) 与每页 ZIP 内原始 JSON。部署 SHA 同上。分数顺序为 Performance / Accessibility / Best Practices / SEO。

| 页面 / 原始报告包 | 分数 | LCP | CLS | TBT | LCP / CLS 门槛 |
| --- | --- | --- | --- | --- | --- |
| [https://arcanumber.com/](evidence/launch-v1/lighthouse/west-home.zip) | 88 / 100 / 96 / 100 | 2.85s | 0.00217 | 0ms | LCP 未达标 |
| [https://arcanumber.com/tarot](evidence/launch-v1/lighthouse/west-tarot.zip) | 93 / 100 / 96 / 100 | 2.42s | 0.00015 | 0ms | 通过 |
| [https://arcanumber.com/pricing](evidence/launch-v1/lighthouse/west-pricing.zip) | 96 / 100 / 96 / 100 | 2.00s | 0.00015 | 0ms | 通过 |
| [https://ganjiday.com/zh-hant](evidence/launch-v1/lighthouse/east-zh-hant.zip) | 99 / 96 / 96 / 100 | 1.56s | 0.00000 | 0ms | 通过 |
| [https://ganjiday.com/ko](evidence/launch-v1/lighthouse/east-ko.zip) | 97 / 96 / 96 / 100 | 1.97s | 0.00000 | 0ms | 通过 |
| [https://ganjiday.com/zh-hant/%E5%A1%94%E7%BE%85](evidence/launch-v1/lighthouse/east-zh-hant-tarot.zip) | 95 / 96 / 96 / 100 | 2.25s | 0.00000 | 0ms | 通过 |

本次为实验室导航审计，无现场 INP；TBT 不等同 INP，不能据 TBT=0 声称 INP < 200ms。西方首页 LCP 未达标，2.3 保持未完成；按用户要求只记录。

## GSC / Bing

| Domain 资源 | DNS TXT 验证 | sitemap | Bing 从 GSC 导入 |
| --- | --- | --- | --- |
| `sc-domain:arcanumber.com` | 已通过；TXT 保留在本域 Cloudflare zone | `https://arcanumber.com/sitemap.xml`，2026-10-20 UTC 提交；刷新后显示「成功」、类型站点地图索引、发现网页 0 | 未导入，等待登录 |
| `sc-domain:ganjiday.com` | 已通过；TXT 保留在本域 Cloudflare zone | `https://ganjiday.com/sitemap.xml`，2026-10-20 UTC 提交；刷新后显示「成功」、类型站点地图索引、发现网页 0 | 未导入，等待登录 |

两站刚提交时列表显示「无法抓取」，后续刷新均显示成功；记录最终成功状态，不把 sitemap 成功等同网页已收录。公共 TXT 仅新增 Google 验证记录，保留原 MX/SPF/DKIM/业务 DNS。Bing 首次访问服务不可用，稍后恢复为未登录首页；协调者指示先跳过，等待用户登录，未接受条款或授权。

## Web Analytics（配置与 v0.1.0 历史检查）

| 域名 | 手动 JS 站点 | 公开 site token |
| --- | --- | --- |
| `arcanumber.com` | JS Snippet installation，自动注入已关闭 | `aa32b146781b4880aa9686d85c3a8f66` |
| `ganjiday.com` | JS Snippet installation，自动注入已关闭 | `21bda25feef743088c8ca9fb63b76a36` |

按协调者本轮明确授权，两个 hostname 各点 Done 创建后，立即在 Manage Site 切换为 **Enable with JS Snippet installation** 并 Update；列表回读均为 JS Snippet installation，自动注入关闭。公开 site token 来自安装片段，与控制台 siteTag 不同；两者均记录在 [Analytics 证据](evidence/launch-v1/web-analytics.json)。未把片段加入代码。

`curl --location` 检查两站 `/` 与 `/app` 四项最终 HTML，均 HTTP 200，未发现 `beacon.min.js`、`static.cloudflareinsights.com`、`data-cf-beacon`、`/cdn-cgi/rum` 或 `cloudflareinsights.com`。`/app` 为匿名请求，均跳转 `/login`，此检查不冒充已认证空间 HTML 验收；另用已登录浏览器补查西方站个人空间（Personal）DOM 的 script 属性，Cloudflare beacon 列表为空，未导出 Cookie/认证凭据。

最新 [心跳复查](evidence/launch-v1/production-heartbeat.json)：2026-10-20T17:05:42Z 两站 health 200、db.up、完整部署 SHA 一致，`jobs.lastCronAt=2026-10-20T17:05:09.507Z`；先前初始 null 状态已解除。

Lighthouse 每页 ZIP 包含该次未改写的 `.report.html` 与 `.report.json`；归档后逐字节核验一致，解压 HTML 可查看完整报告。

管理员复验 UTC：`2026-10-20T17:10:49.112970+00:00`；证据见 [浏览器验收记录](evidence/launch-v1/production-browser.json)。测试账号继续保留，等待协调者在删号修复 PR #43 合并部署后下达下一步；本轮没有重试删除。

本轮 2.2 最终验收 UTC：`2026-10-20T17:48:44.452539+00:00`；新账号删除及原密码拒绝、旧账号后台无清理入口、匿名 404 beacon 已知问题接受决定，均见 [v0.1.1 浏览器证据](evidence/launch-v1/v0.1.1-browser.json)。

## 2026-10-21 支付与定价调整（代码层面，未上线）

- 支付：先接 PayPal。`template.config.ts` 的 `billing.providers` 改为 `['paypal']` 随 PayPal 上线一并提交（本次未改，仍为 `['stripe']`：e2e 冒烟依赖 Stripe 结账入口，改动会使其失败）；Stripe 代码保留。生产 PayPal 上线需设置 `PAYMENT_MODE` 与 `PAYPAL_*` 密钥，尚未执行。
- 订阅：`pro` / `team` 在 `packages/billing/src/catalog.ts` 中停用（`active: false`、无价格）。已有数据库行要在下一次 `billing:seed` 后才会变为停用；结账按 `plan.active` 拒绝。
- 定价页：只展示一次性积分包。Single 100 积分 $0.99，Five 500 积分 $3.99。
- 文案：三语 `marketing` 中的副标题与「订阅与积分」类表述已去掉升级、订阅说法。

### 免费积分盘点（按代码与配置）

| 来源 | 当前数量 | 依据 |
| --- | --- | --- |
| 注册赠送 | 0 | `template.config.ts` `billing.signupBonusCredits: 0`；`packages/billing/src/signup.ts` 在值 ≤ 0 时返回 disabled |
| 免费档（`free`） | 0 | `packages/billing/src/catalog.ts` 的 free 计划 `credits: 0`，无价格 |
| 订阅月度积分（已停用） | 原 pro 1000 / team 5000 每月 | 停用后不再发放 |
| 管理员后台调整 | 不定 | 后台 `adjust` 流水，需人工操作并留审计 |
| staging 验收测试积分 | 100（仅 staging） | `docs/runbooks/staging-acceptance.md`，不影响生产 |

注意：`packages/config/src/template.ts` 的 `templateConfigDefaults` 回退值仍为 100，但 `template.config.ts` 已覆盖为 0，实际生效值是 0。`docs/02-project-structure.md`、`docs/05-billing.md` 仍写注册赠送 100，属于过时文档。本轮未查询生产数据库，上表基于代码与配置。

## Lighthouse 移动端复测（2026-10-23，生产只读）

- 方式：`npx lighthouse <url> --form-factor=mobile --only-categories=performance`，Chrome 本机无头模式；原始 JSON 存于 `docs/runbooks/evidence/launch-v1/lighthouse/2026-10-23-mobile.zip`。
- 结果（LCP 目标 < 2.5s，CLS 目标 < 0.1）：

| 页面 | LCP | CLS | 性能分 |
|---|---|---|---|
| ganjiday.com/ | 2.8s | 0.009 | 91 |
| ganjiday.com/ko | 2.9s | 0 | 88 |
| ganjiday.com/塔羅 | 2.3s | 0.01 | 95 |
| arcanumber.com/ | 3.3s | 0.002 | 86 |
| arcanumber.com/pricing | 2.8s | 0 | 86 |
| arcanumber.com/tarot | 2.0s | 0 | 98 |

- 结论：CLS 全部达标；LCP 有 4 页未达标。任务 2.3 保持未勾选，LCP 优化另行跟进。INP 未在本次 Lighthouse 中测得。

## 首屏 LCP 优化复测（v0.1.5，2026-10-24，生产只读）

- 发布：tag `v0.1.5`（commit `4d08400`），两站 `/api/health` 均返回该版本。
- 方式：`npx lighthouse <url> --form-factor=mobile --only-categories=performance`；原始 JSON 存于 `docs/runbooks/evidence/launch-v1/lighthouse/2026-10-24-v0.1.5-mobile.zip`。

| 页面 | LCP（目标 < 2.5s） | CLS | 性能分 |
|---|---|---|---|
| ganjiday.com/ | 1.88s | 0.012 | 79 |
| ganjiday.com/ko | 2.13s | 0.000 | 87 |
| ganjiday.com/塔羅 | 1.77s | 0.012 | 98 |
| arcanumber.com/ | 2.32s | 0.002 | 97 |
| arcanumber.com/pricing | 1.98s | 0.000 | 98 |
| arcanumber.com/tarot | 2.19s | 0.000 | 97 |

- LCP 与 CLS 六页全部达标。
- INP（Playwright 模拟移动端节流，点击一次）：`arcanumber.com/` 点击出生日期输入框 248–304ms，超过 200ms；profile 显示耗时来自浏览器原生日期选择器的渲染（`_shouldUseShortMonth` 等），不是站点脚本。`/tarot` 点击输入框 32–96ms。东方站页面的首次交互未测得有效数据（点击目标为导航链接）。
- 任务 2.3 保持未勾选，待 INP 决定：是否改用文本日期输入，或以其他典型交互作为验收。
