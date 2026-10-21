# Tasks

## 1. 内容

- [x] 1.1 三语免责声明页与隐私政策补充（出生信息的处理方式），服务条款补充娱乐用途条款；验证：e2e 打开三语免责声明页，站点地图包含它们
- [x] 1.2 法律页按语言收敛为英文四页 `/privacy` `/terms` `/disclaimer` `/refund`（仅页脚入口，其他语言显示英文并标注、noindex），以 Basecamp 政策（CC BY 4.0）改写；删除报告/账号时清除 AI 对话正文与订阅记录；验证：e2e 打开四页与繁中/韩语标注页，集成测试覆盖删除
- [x] 1.3 定价页改为三语积分包真实内容（免费工具说明、积分包价格与可解锁详批、常见问题、政策链接），删除模板订阅/虚构评价；支付未开通时显示即将开放并隐藏详批解锁入口；验证：e2e 定价页两积分包、无结账入口、韩语页显示当地货币估价

## 2. 生产环境（decision gate：域名、Stripe live、Resend、Google OAuth、Turnstile、Neon、Sentry 由用户准备）

- [x] 2.1 按 `deploy-cloudflare` 技能做生产资源与密钥预检，`wrangler.jsonc` 生产环境加两条 custom_domain 路由，构建变量 `EAST_URL`/`WEST_URL`；验证：预检脚本无缺失项，`wrangler deploy --dry-run` 通过
- [ ] 2.2 生产部署（迁移 → seed → jobs → web）与后台配置（模型、详批开关与价格）；验证：两站 `/api/health` 返回部署 SHA，三语冒烟 e2e（`e2e-live`）通过
  - 部署与删号验收已完成（v0.1.1，见 `docs/runbooks/launch-v1.md`）；未完成：后台配置（模型、详批开关与价格）待 PayPal 上线与 D1 选定模型后完成；`e2e-live` 未运行（只跑了只读 `e2e/production`），补跑或改写验证条款后再勾选
- [ ] 2.3 Lighthouse 移动端审计两站各 3 个核心页（LCP < 2.5s、CLS < 0.1、INP < 200ms）；验证：报告存入 `docs/runbooks/evidence/launch-v1/`

## 3. 收录

- [ ] 3.1 GSC 与 Bing 验证两站并提交站点地图，记录在 `docs/runbooks/launch-v1.md`；验证：GSC 显示站点地图状态为「成功」
- [ ] 3.2 AI 目录提交清单（≥ 19 个）与执行记录；验证：清单中每条都有提交日期与状态


## 本轮验收边界（2026-10-20，历史过程）

- 2.1 按用户最新决定验收「无支付、无 DeepSeek、log 邮件、不做 Sentry」配置：五项 web 必需 secret 名称齐全，双域资源与 jobs/web production dry-run 通过。GitHub CI 两项 Cloudflare 凭据待用户输入，属于 2.2 发布阻塞；详情见 `docs/runbooks/production-xuanxue.md`。
- 2.2 未完成：迁移 14/14 与既有 seed 只读复核通过；尚未部署业务产物。等待生产 CI 凭据、修正工作流合入 main、同 SHA CI/staging 成功及 production 审批，不提前勾选健康/三语冒烟、真实注册/删号。
- 2.3 未完成：生产未部署，尚无六页 Lighthouse 报告；不将计划表当作实测结果。
- 3.1 未完成：GSC/Bing 尚未操作，没有 sitemap「成功」证据。
- 管理员邮箱 secret 已存在，不代用户注册；当前实现要求邮箱已验证才能提升，log 邮件限制待处理。support Routing 已 Active，实际收信仍待用户确认；Resend 发信按用户决定延后。Cloudflare Web Analytics 手动片段与公开 token 尚未创建。记录见 `docs/runbooks/launch-v1.md`。


## 本轮生产实测（2026-10-20 UTC / 台北 2026-10-21，历史过程）

- 2.2：v0.1.0 已成功部署完整 SHA `661e627ea2300b63c7aca22efc771f8ddc1ef8bd`；双站 health/db/版本与东方 6、西方 3 只读冒烟通过。测试账号注册/重新登录通过，但删号返回 Payment configuration is unavailable，指定 Google 账号注册且邮箱已验证，协调者重写 bootstrap secret 后重新登录可正常进入 /admin；整体验收未通过，暂不勾选。不开支付/不改价格/不启用详批模型的边界保持不变。
- 2.3：六页移动端 HTML/JSON 已存入 evidence/launch-v1/lighthouse；西方首页 LCP 2.85s 超过 2.5s，其他五页 LCP 达标，全部 CLS 达标；无现场 INP。按用户要求只记录，保留未完成。
- 3.1：两站 GSC Domain DNS TXT 验证通过，sitemap 均显示成功；Bing 未登录，等待用户操作，尚未导入，保留未完成。
- 管理员、Analytics token 与后续状态见 docs/runbooks/launch-v1.md；本轮没有改代码绕过验收。

- 本轮续跑：Google 常规授权已获协调者确认并完成；账号已注册、邮箱已验证、无密码；协调者重写 bootstrap secret 后重新登录，管理员权限验收通过；2.2 因删号待验收保持未完成。测试账号由协调者修复部署后再验；Bing 先跳过，LCP 只记录。两个 Web Analytics 已创建并立即切为手动，四项匿名 curl HTML 无 beacon，公开 token 已记录；不勾选尚未满足的 2.2/2.3/3.1。

- 管理员复验通过（`2026-10-20T17:10:49.112970+00:00`）：退出后使用同一 Google 账号重新登录，/admin 显示 Admin 导航及 Overview。未读取/重写 secret、未设密码、未写库。删号等待协调者下一步，不提前勾选 2.2。


## v0.1.1 复验（c0dc8cf，历史过程）

- 同 SHA CI/staging 成功后，annotated tag v0.1.1 生产发布成功；两站 /api/health 完整 SHA=`c0dc8cf9cdd075811ead3179b078f19c9fb15661`、db.up，东方 6/西方 3 只读冒烟通过，管理员仍可访问。
- 2.2 暂不勾选：原测试账号密码仅在操作内存，已被代理于前轮清空，未能完成新版本登录/删号/删除后登录拒绝；账号保留，已询问新账号替代复验，等待答复。
- 两站首页/定价的本站 beacon token 正确，已认证西方 app/admin 无 beacon；匿名 admin 404 HTML 仍含 beacon，保留失败证据交协调者处理。匿名 app 原始 307 无 beacon，跟随登录页有 beacon，记录两者差异。
- 2.3 保留旧版本 LCP 实测、不重跑；3.1 Bing 继续等待登录。最新证据与限制见 docs/runbooks/launch-v1.md。


## 2.2 最终验收完成

- 按协调者本轮授权，新账号 `launch-test-20261020174555043@example.org` 在 v0.1.1 完成真实注册、个人空间、退出后密码登录、DELETE 删号、同一邮箱/原密码登录被拒绝（Incorrect email or password.）；后台可见匿名化测试用户，密码仅内存且验收后清空。
- 旧账号后台用户详情无删除/匿名化操作，只有模拟登录和封禁管理，按指示保留并已记 runbook；未用替代动作或直接写库清理。
- 两站匿名 /admin 404 HTML 的 beacon 经协调者明确接受为无用户数据的非阻断已知小问题；保留原始失败证据，后续处理，本轮不改代码。
- v0.1.1 发布、完整 SHA/db、三语 9 项只读冒烟、Google 管理员与上述删号均满足本轮已批准的无支付/无详批模型范围，2.2 勾选；历史“未完成”记录保留为当时状态。2.3 / 3.1 仍未完成，LCP 只记录，Bing 等待登录。

## 勾选修正（2026-10-21）

- 2.2 保持未勾选。此前 `launch-v1.md` 写成「已勾选」与本文件不一致，已改为未勾选；部署与删号验收的证据仍有效。
