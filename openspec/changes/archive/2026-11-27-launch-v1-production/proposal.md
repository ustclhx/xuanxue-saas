# Proposal

## Why

前五个 change 交付了 v1 功能，上线还需要：真实域名、生产资源与密钥、搜索引擎收录、AI 目录提交，以及面向玄学类产品的法律/免责页面（`doc/design.md` §6、TASK-06、§7 P7）。

## What Changes

- 法律页增加「免责声明」（娱乐用途、不预测未来、健康/法律/财务需咨询专业人士），三语；隐私政策补充出生信息的处理说明（免费结果只在本地计算，付费报告保存在账户中，可删除）。
- 生产部署：Cloudflare Workers + Neon 生产库，两个自定义域名绑定同一个 web Worker，`EAST_URL`/`WEST_URL` 构建变量，Stripe live、Resend 域名、Google OAuth（两站回调）、Turnstile（两站 hostname）、Sentry。
- 上线检查：Lighthouse 移动端（LCP < 2.5s、CLS < 0.1）、三语 e2e 冒烟、`/api/health` 版本 SHA。
- 收录：Google Search Console 与 Bing Webmaster 两站验证并提交站点地图；AI 目录提交清单（≥ 19 个）与执行记录。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `marketing-site`: 法律页增加免责声明，并说明出生信息的处理方式。

## Impact

- `apps/web/content/legal/<locale>/`；`wrangler.jsonc` 生产环境 routes；`PROJECT_SETUP.md`；`docs/runbooks/launch-v1.md`。
- 需要人工完成的 decision gate：购买域名并接入 Cloudflare、Stripe live 账号、Resend 域名、Google OAuth 应用、Neon 生产库、Sentry 项目、GSC/Bing 账号。
