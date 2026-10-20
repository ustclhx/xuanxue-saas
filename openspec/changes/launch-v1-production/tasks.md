# Tasks

## 1. 内容

- [x] 1.1 三语免责声明页与隐私政策补充（出生信息的处理方式），服务条款补充娱乐用途条款；验证：e2e 打开三语免责声明页，站点地图包含它们
- [x] 1.2 法律页按语言收敛为英文四页 `/privacy` `/terms` `/disclaimer` `/refund`（仅页脚入口，其他语言显示英文并标注、noindex），以 Basecamp 政策（CC BY 4.0）改写；删除报告/账号时清除 AI 对话正文与订阅记录；验证：e2e 打开四页与繁中/韩语标注页，集成测试覆盖删除
- [x] 1.3 定价页改为三语积分包真实内容（免费工具说明、积分包价格与可解锁详批、常见问题、政策链接），删除模板订阅/虚构评价；支付未开通时显示即将开放并隐藏详批解锁入口；验证：e2e 定价页两积分包、无结账入口、韩语页显示当地货币估价

## 2. 生产环境（decision gate：域名、Stripe live、Resend、Google OAuth、Turnstile、Neon、Sentry 由用户准备）

- [x] 2.1 按 `deploy-cloudflare` 技能做生产资源与密钥预检，`wrangler.jsonc` 生产环境加两条 custom_domain 路由，构建变量 `EAST_URL`/`WEST_URL`；验证：预检脚本无缺失项，`wrangler deploy --dry-run` 通过
- [ ] 2.2 生产部署（迁移 → seed → jobs → web）与后台配置（模型、详批开关与价格）；验证：两站 `/api/health` 返回部署 SHA，三语冒烟 e2e（`e2e-live`）通过
- [ ] 2.3 Lighthouse 移动端审计两站各 3 个核心页（LCP < 2.5s、CLS < 0.1、INP < 200ms）；验证：报告存入 `docs/runbooks/evidence/launch-v1/`

## 3. 收录

- [ ] 3.1 GSC 与 Bing 验证两站并提交站点地图，记录在 `docs/runbooks/launch-v1.md`；验证：GSC 显示站点地图状态为「成功」
- [ ] 3.2 AI 目录提交清单（≥ 19 个）与执行记录；验证：清单中每条都有提交日期与状态


## 本轮验收边界（2026-10-20）

- 2.1 按用户最新决定验收「无支付、无 DeepSeek、log 邮件、不做 Sentry」配置：五项 web 必需 secret 名称齐全，双域资源与 jobs/web production dry-run 通过。GitHub CI 两项 Cloudflare 凭据待用户输入，属于 2.2 发布阻塞；详情见 `docs/runbooks/production-xuanxue.md`。
- 2.2 未完成：迁移 14/14 与既有 seed 只读复核通过；尚未部署业务产物。等待生产 CI 凭据、修正工作流合入 main、同 SHA CI/staging 成功及 production 审批，不提前勾选健康/三语冒烟、真实注册/删号。
- 2.3 未完成：生产未部署，尚无六页 Lighthouse 报告；不将计划表当作实测结果。
- 3.1 未完成：GSC/Bing 尚未操作，没有 sitemap「成功」证据。
- 管理员邮箱 secret 已存在，不代用户注册；当前实现要求邮箱已验证才能提升，log 邮件限制待处理。support Routing 已 Active，实际收信仍待用户确认；Resend 发信按用户决定延后。Cloudflare Web Analytics 手动片段与公开 token 尚未创建。记录见 `docs/runbooks/launch-v1.md`。
