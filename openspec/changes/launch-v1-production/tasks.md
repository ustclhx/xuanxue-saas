# Tasks

## 1. 内容

- [ ] 1.1 三语免责声明页与隐私政策补充（出生信息的处理方式），服务条款补充娱乐用途条款；验证：e2e 打开三语免责声明页，站点地图包含它们

## 2. 生产环境（decision gate：域名、Stripe live、Resend、Google OAuth、Turnstile、Neon、Sentry 由用户准备）

- [ ] 2.1 按 `deploy-cloudflare` 技能做生产资源与密钥预检，`wrangler.jsonc` 生产环境加两条 custom_domain 路由，构建变量 `EAST_URL`/`WEST_URL`；验证：预检脚本无缺失项，`wrangler deploy --dry-run` 通过
- [ ] 2.2 生产部署（迁移 → seed → jobs → web）与后台配置（模型、详批开关与价格）；验证：两站 `/api/health` 返回部署 SHA，三语冒烟 e2e（`e2e-live`）通过
- [ ] 2.3 Lighthouse 移动端审计两站各 3 个核心页（LCP < 2.5s、CLS < 0.1、INP < 200ms）；验证：报告存入 `docs/runbooks/evidence/launch-v1/`

## 3. 收录

- [ ] 3.1 GSC 与 Bing 验证两站并提交站点地图，记录在 `docs/runbooks/launch-v1.md`；验证：GSC 显示站点地图状态为「成功」
- [ ] 3.2 AI 目录提交清单（≥ 19 个）与执行记录；验证：清单中每条都有提交日期与状态
