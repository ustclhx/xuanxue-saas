# v1 上线与收录记录

2026-10-20 UTC（台北 2026-10-21）。Arcanumber（en）与 Ganjiday（zh-Hant / ko）当前部署 v0.1.1，付款保持即将开放。

## 当前状态

| 项目 | 状态与证据 |
| --- | --- |
| 2.1 Worker 资源 / secrets / dry-run | 已完成；原预检见 [production runbook](production-xuanxue.md) |
| GitHub production environment | 三项必需 secret 名称齐全；新建独立生产 token，剪贴板写入后清空；已按本轮明确授权在浏览器批准 production |
| 2.2 迁移 → seed 确认 → jobs → web | v0.1.1 发布成功，双域健康完整 SHA 与 9 项只读冒烟通过；管理员通过；原测试账号密码已清空，删号复验待可用登录方式，暂不勾选 |
| 2.3 Lighthouse | 六页移动端 HTML/JSON 已保存；西方首页 LCP 2.85s 未达 2.5s 门槛；未修改性能代码 |
| 3.1 GSC / Bing | 两个 Domain 资源 DNS TXT 验证通过，两个 sitemap 均显示成功；Bing 等待用户登录，尚未导入 |
| Cloudflare Web Analytics | 手动模式保持；PR #44 已随 v0.1.1 发布，首页/定价含本站 token，已认证 app/admin 无 beacon；匿名 admin 的 404 HTML 仍含 beacon，未完全通过范围验收 |
| support 收件 | 两条 Routing Active、目标 Verified；实际收信仍需用户确认 |
| Resend | 延后；邮件传输保持 log |
| 支付 / 详批 / Sentry | 未配置新密钥；未运行 billing:sync、未改套餐价格、未启用详批模型 |

## v0.1.1 发布与复验（最新）

- 完整 SHA：`c0dc8cf9cdd075811ead3179b078f19c9fb15661`，包含 PR #43 删号修复与 PR #44 按站 Analytics token。
- 同 SHA [CI 39466361482](https://github.com/ustclhx/xuanxue-saas/actions/runs/39466361482) 与 [Deploy staging 39467310532](https://github.com/ustclhx/xuanxue-saas/actions/runs/39467310532) 全部成功后，创建 annotated tag `v0.1.1` 并推送。浏览器批准 production，`gh run watch --exit-status` 退出 0；[production 39467824210](https://github.com/ustclhx/xuanxue-saas/actions/runs/39467824210) 全部成功，迁移、jobs、web、两站版本健康、东方 6 / 西方 3 冒烟通过。未重跑、未修改代码/工作流、未新增支付/模型密钥或改价格。
- jobs version：`a626cb32-4bc4-4cea-87b5-6383b8937117`；web version：`4c696e11-9927-4081-9f05-f0630eef40ef`。独立 curl 两站 `/api/health` HTTP 200、db.up、完整 SHA 等于上述版本。
- 两站 `/`、`/pricing` 各恰好一个 `data-cf-beacon`，分别为 Arcanumber `aa32b146781b4880aa9686d85c3a8f66`、Ganjiday `21bda25feef743088c8ca9fb63b76a36`，均 `spa=false`，没有跨站 token。此前“无 beacon”证据属于 PR #44 发布前的 v0.1.0，不能代表当前公开页。
- 已登录西方站浏览器 `/admin` 正常显示 Admin/Overview、个人 `/app` 显示 Personal，两处 DOM 均无 beacon。匿名 `/app` 原始响应两站均为 307、空正文、无 beacon；curl 跟随跳转后的 `/login` HTML 含本站 beacon。两站匿名 `/admin` 原始 404 HTML 仍含本站 beacon，后台路径排除验收未全部满足；保留失败证据，交协调者决定修复，不改代码绕过。
- 删号复验未完成：原测试账号 `launch-test-20261021@example.org` 的随机密码仅存在操作内存，已被代理在前轮清空且未落盘；当前登录表单无可用自动填充。本轮未提交密码登录或删除，账号保留；已询问能否新建一次性测试账号完成密码登录→删号→原密码被拒绝，等待答复，不能以猜测密码或只读冒烟代替验收。
- Lighthouse 不重跑，旧六页报告明确属于 v0.1.0；LCP 仍只记录。Bing 继续等待用户登录。2.2 因删号复验缺口保持未完成，2.3/3.1 也不提前勾选。

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

## Web Analytics

| 域名 | 手动 JS 站点 | 公开 site token |
| --- | --- | --- |
| `arcanumber.com` | JS Snippet installation，自动注入已关闭 | `aa32b146781b4880aa9686d85c3a8f66` |
| `ganjiday.com` | JS Snippet installation，自动注入已关闭 | `21bda25feef743088c8ca9fb63b76a36` |

按协调者本轮明确授权，两个 hostname 各点 Done 创建后，立即在 Manage Site 切换为 **Enable with JS Snippet installation** 并 Update；列表回读均为 JS Snippet installation，自动注入关闭。公开 site token 来自安装片段，与控制台 siteTag 不同；两者均记录在 [Analytics 证据](evidence/launch-v1/web-analytics.json)。未把片段加入代码。

`curl --location` 检查两站 `/` 与 `/app` 四项最终 HTML，均 HTTP 200，未发现 `beacon.min.js`、`static.cloudflareinsights.com`、`data-cf-beacon`、`/cdn-cgi/rum` 或 `cloudflareinsights.com`。`/app` 为匿名请求，均跳转 `/login`，此检查不冒充已认证空间 HTML 验收；另用已登录浏览器补查西方站个人空间（Personal）DOM 的 script 属性，Cloudflare beacon 列表为空，未导出 Cookie/认证凭据。

最新 [心跳复查](evidence/launch-v1/production-heartbeat.json)：2026-10-20T17:05:42Z 两站 health 200、db.up、完整部署 SHA 一致，`jobs.lastCronAt=2026-10-20T17:05:09.507Z`；先前初始 null 状态已解除。

Lighthouse 每页 ZIP 包含该次未改写的 `.report.html` 与 `.report.json`；归档后逐字节核验一致，解压 HTML 可查看完整报告。

管理员复验 UTC：`2026-10-20T17:10:49.112970+00:00`；证据见 [浏览器验收记录](evidence/launch-v1/production-browser.json)。测试账号继续保留，等待协调者在删号修复 PR #43 合并部署后下达下一步；本轮没有重试删除。
