# xuanxue 初始化清单

## 基础设施与账号

- [ ] Postgres（app / migrator / readonly 账号；Neon TLS 直连或自建库的 Tunnel / Workers VPC）
- [ ] 数据库：迁移后运行 pnpm billing:seed；首次 free.models=[]，模型授权在后台套餐页面配置，重跑保留已有 models
- [ ] Workers：xuanxue-web、xuanxue-jobs（staging 使用 -staging 后缀）
- [ ] Hyperdrive：HYPERDRIVE（关缓存）/ HYPERDRIVE_CACHED（开缓存），替换所有环境的 id
- [ ] KV：CACHE，替换所有环境的 id；Rate Limiting：RL_AUTH / RL_AI / RL_API，分配独立 namespace_id
- [ ] Queues：xuanxue-email、xuanxue-events（staging 使用 -staging 后缀）
- [ ] Resend：验证发件域名；本地 EMAIL_TRANSPORT=log 不需要凭据
- [ ] 域名 / DNS 与 Cloudflare 部署账号；CI 的 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
- [ ] R2：FILES 私有桶 xuanxue-files（staging 使用 -staging 后缀）；文本模式也保留文件清理 Cron 所需绑定
- [ ] Sentry：为 web / jobs 配置 DSN；CI 上传 source map 并使用部署提交 SHA 作为 release
- [ ] google OAuth 应用：登记新域名的回调 URL
- [ ] Turnstile 站点
- [ ] stripe 账号与 Webhook（先测试 / 沙箱）
- [ ] AI Gateway（开启鉴权，在 Provider Keys 保存所用文本服务商的密钥）；后台登记模型与价格

## Worker Secrets

- BETTER_AUTH_SECRET
- BOOTSTRAP_ADMIN_EMAILS（可选，仅 web：逗号分隔邮箱名单；已验证且未封禁才提升，空值禁用）
- RESEND_API_KEY_EAST
- RESEND_API_KEY_WEST
- SENTRY_DSN
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- TURNSTILE_SECRET_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- AI_GATEWAY_TOKEN

## 非敏感 Worker Vars

- APP_URL
- EMAIL_TRANSPORT
- SENTRY_ENVIRONMENT
- PAYMENT_MODE
- APP_VERSION
- TURNSTILE_SITE_KEY
- AI_GATEWAY_ACCOUNT_ID
- AI_GATEWAY_ID

## GitHub staging environment Secrets（不写入 Worker）

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- STAGING_MIGRATION_DATABASE_URL
- SENTRY_AUTH_TOKEN
- SENTRY_ORG
- SENTRY_PROJECT

所有部署资源 ID 为占位值，部署前逐项配置；参考 docs/07-infrastructure.md。
AI Gateway / R2 账号标识已清空；配置所选功能使用的新资源。
将 .github/workflows/deploy-staging.yml 的 STAGING_URL 占位值改为实际可访问的 staging URL，并核对该环境的 APP_URL。
SENTRY_DSN 分别写入 web 与 jobs secrets；SENTRY_ENVIRONMENT 设为 staging、production 或临时验收专用 smoke。
APP_VERSION 使用同一个完整提交 SHA，CI 已负责注入并上传 source map；手动部署按 docs/runbooks/sentry.md 操作。
复制 apps/web 与 apps/jobs 的 .dev.vars.example 后填写，本地密钥不提交；线上 secrets 需分别写入 Worker。
自检只运行单元测试，集成测试需独立数据库与迁移配置；上线前另做 staging 验收。

## 首次运行

1. 迁移后运行 pnpm billing:seed，首次 free 的 models=[]。
2. 为 web 配置可选 Worker secret BOOTSTRAP_ADMIN_EMAILS（本地填 apps/web/.dev.vars，逗号分隔、忽略大小写与两侧空白），名单内账号必须先验证邮箱且未封禁。
3. 用名单账号登录；Google OAuth 返回已验证邮箱可直接提升，邮箱密码账号在账号设置验证后提升，已有账号重新登录也会检查。
4. 在 /admin/models 创建模型，再到 /admin/billing/plans 为有效套餐（新用户通常为 free）多选模型 key 或 * 并保存；仅建模型或发积分仍不足以授权。
5. models 在下一次请求生效；历史 key 会警告并保留，其他权益及价格不改。重跑 seed 保留已有 models，其他示例配置仍按 seed 更新。

移除名单不会自动撤销既有管理员；需要撤权时先移除名单，再由运维显式修改数据库中的平台角色（当前后台不提供角色修改入口），否则下次登录会再次提升。
线上通过 wrangler secret put BOOTSTRAP_ADMIN_EMAILS --env staging 在 web Worker 配置；本地 .dev.vars 不上传。部署流水线不写入或替换此 secret；不要在模板、PR 或日志中保存真实邮箱。

## 页面与语言

- 营销页面已启用，/ 为营销首页。
- 多语言已启用，默认语言 en；其他语言使用语言前缀。
