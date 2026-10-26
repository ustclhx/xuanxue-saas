# xuanxue

基于 TanStack Start、Postgres 与 Cloudflare 的 SaaS 模板：认证与空间、订阅与积分、AI 文本/图片/视频、
后台管理和营销站点开箱即用，部署到 Cloudflare Workers。
架构与领域文档见 [文档目录](docs/README.md)。Node >=22，pnpm 版本以根 `package.json` 为准。

## 功能

| 领域 | 能力 |
|---|---|
| 账号与认证 | 邮箱密码、邮箱验证码、可选魔法链接与两步验证；Google / GitHub OAuth；Turnstile 防刷；首个管理员按邮箱名单自动提升；账号删除（30 天保留期）与删除前退款提醒 |
| 空间与多租户 | 个人空间默认开启，可选团队空间（成员、角色、邀请）；所有业务数据按空间隔离（`scoped()`） |
| 订阅与支付 | Stripe 与 PayPal：月付/年付订阅、换套餐、期末取消与恢复、积分包；Webhook 验签、去重与重放；test/live 模式切换；退款申请 → 管理员审核（全额或部分）→ 平台退款 |
| 积分 | 订阅/积分包/注册赠送/后台补发多种批次；先到期先消费；AI 调用预扣—结算（hold → capture/release）与超额容忍；部分退款按比例收回、已消费不追溯；账本与余额对账不变式 |
| AI 文本对话 | 流式对话、停止与关页后的可靠结算、用量检查点；按 token / 按次计费；可配置 thinking 与 reasoning 展示；可见正文前自动重试、DeepSeek 前缀续写；无可见输出的失败不收费 |
| AI 图片/视频 | fal.ai 与 Workers AI；异步任务（Workflow）、回调验签与轮询兜底、硬超时；输出转存 R2 与安全下载；失败全退、只扣一次 |
| 模型与套餐 | 后台模型注册（Provider、参数 schema、定价）；按套餐授权模型；后台套餐与价格同步到支付平台 |
| 后台管理 | 用户搜索/封禁/模拟登录、积分补发与收回、回调事件列表与重放、退款审核、运行时设置、每日指标看板；所有写操作带审计日志 |
| 营销与增长 | 首页、定价、博客、文档、法律页；多语言（en/zh）与 SEO（sitemap、robots、OG 图、预渲染）；候补名单、邮件订阅、站内通知 |
| 开放 API | API Key 调用 `/api/v1`（文本补全、媒体任务），默认关闭 |
| 可观测与运维 | 结构化日志与请求 ID、Sentry（含 source map）、`/api/health`（数据库与版本 SHA）、受控故障注入验收套件（仅 staging） |
| Agent Skills | 内置部署、扩展页面/模块/静态内容、AI 模型配置与安全扫描技能 |

功能开关集中在 [`template.config.ts`](template.config.ts)；可在后台热改的设置存数据库；密钥只放 secrets。三层互不覆盖。

## 依赖的外部服务与基础设施

按功能开关启用，未启用的功能不需要对应账号或密钥。

**Cloudflare**

| 服务 | 用途 | 必需性 |
|---|---|---|
| Cloudflare Workers | web 与 jobs 两个 Worker | 必需 |
| Hyperdrive + Postgres（如 Neon） | 业务数据库连接池 | 必需 |
| Workers KV | 缓存（模型注册表、OAuth token 等） | 必需 |
| Queues | 邮件与事件异步处理 | 必需 |
| Rate Limiting | 认证 / AI / API 限流 | 必需 |
| R2 | 用户文件与 AI 产出存储（S3 API 签发预签名 URL） | 必需（文件清理亦使用） |
| Workflows | AI 媒体任务编排 | 开启图片/视频时 |
| AI Gateway | 文本模型统一出口、BYOK 密钥与用量日志 | 开启文本 AI 时（DeepSeek 可直连） |
| Workers AI | 图片生成（无外部密钥） | 选用 Workers AI 时 |
| Turnstile | 注册/登录人机验证 | 默认开启，可关闭 |

**第三方服务（按功能启用）**

| 服务 | 用途 |
|---|---|
| Stripe / PayPal | 订阅、积分包与退款（各自 test/sandbox 与 live） |
| 文本模型服务商：OpenAI、Anthropic、Google AI、DeepSeek 等 | AI 对话 |
| fal.ai | 图片/视频生成 |
| Resend | 认证与通知邮件（默认 log 通道不外发） |
| Google / GitHub OAuth App | 第三方登录 |
| Sentry | 错误追踪与 source map |
| GitHub Actions | CI、staging 与生产发布 |

完整的 secret、变量与绑定清单见 [基础设施文档 §4](docs/07-infrastructure.md#4-环境变量与绑定清单)，
按本项目功能列出的资源与密钥见 `PROJECT_SETUP.md`。

## 本地开发

**1. 安装依赖**

```sh
pnpm install --frozen-lockfile
```

**2. 本地数据库**

```sh
docker compose -f infra/local/docker-compose.yml up -d postgres
pnpm --filter @xuanxue/db db:migrate
```

**3. 本地配置**

```sh
cp -n apps/web/.dev.vars.example apps/web/.dev.vars
cp -n apps/jobs/.dev.vars.example apps/jobs/.dev.vars
cp -n .env.example .env.local
```

至少填写 `BETTER_AUTH_SECRET` 与 `BOOTSTRAP_ADMIN_EMAILS`（你的管理员邮箱，web `.dev.vars`）；
支付测试密钥写根 `.env.local`；按需补 OAuth、AI、fal、R2 等密钥（见 `PROJECT_SETUP.md`）。
开启计费时写入示例套餐：`pnpm billing:seed`。

**4. 启动并验证**

```sh
pnpm dev        # web 默认 http://localhost:3000，jobs 默认 8788
```

注册管理员邮箱账号并完成邮箱验证后可进入 `/admin`。开启 AI 时在 `/admin/models` 配置模型与定价，
再到 `/admin/billing/plans` 为套餐授权模型，然后在 `/app/<空间>/chat` 发起首次对话。
`GET /api/health` 返回数据库状态与版本。

**5. 部署**

按 `PROJECT_SETUP.md` 创建 Cloudflare 资源并配置 Wrangler secrets 与 GitHub environment secrets，
main 分支 CI 通过后自动发布 staging；见 [基础设施文档](docs/07-infrastructure.md)，
或使用 `deploy-cloudflare` 技能做只读预检。

## Agent Skills

项目内提供 7 个技能，Codex 使用 `.agents/skills/`，Claude 使用 `.claude/skills/`：

| 技能 | 用途 |
| --- | --- |
| [deploy-cloudflare](.agents/skills/deploy-cloudflare/SKILL.md) | 新环境资源/绑定/secret 名称预检，迁移、发布、health SHA 与管理员；支持 `--env/--domain/--admin-email` |
| [new-page](.agents/skills/new-page/SKILL.md) | admin/app 路由、类型化 Server Functions、表格/表单、导航和 i18n |
| [new-module](.agents/skills/new-module/SKILL.md) | 复用现有表与领域模块，租户服务、鉴权入口、运行时设置与积分边界 |
| [new-static-page](.agents/skills/new-static-page/SKILL.md) | 多语言营销/法务 MDX 或静态路由、SEO、sitemap 与预渲染 |
| [add-ai-model](.agents/skills/add-ai-model/SKILL.md) | 后台模型编辑器、参数 schema/定价/套餐授权；必要时新增 Provider |
| [security-scan](.agents/skills/security-scan/SKILL.md) | 工程检查、敏感路径与凭据扫描、鉴权/注入/账本等 diff 审查 |
| [template-sync](.agents/skills/template-sync/SKILL.md) | 按模板版本采纳更新，含升级说明待办、迁移移植与基准推断 |

在项目根按技能名发起请求（Codex `$new-page`、Claude `/new-page`），或直接要求 agent 阅读对应 `SKILL.md` 执行。
部署默认只读预检与 dry-run；具体写入清单确认后才操作，缺外部凭据的环节明确标记待验收。

维护时编辑 `.agents/skills/<name>/SKILL.md` 后复制到 `.claude` 同名路径，两份逐字节一致（不用符号链接）。提交前核对：

```sh
for skill in deploy-cloudflare new-page new-module new-static-page add-ai-model security-scan template-sync; do
  cmp ".agents/skills/$skill/SKILL.md" ".claude/skills/$skill/SKILL.md" || exit 1
done
```

OpenSpec 技能保留各 agent 的调用语法差异，不纳入此核对。

## 常用命令

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 本地启动 web 与 jobs |
| `pnpm check` / `pnpm typecheck` / `pnpm test` | 代码规范、类型检查、测试 |
| `pnpm check:deps` | 包依赖方向检查 |
| `pnpm build` | web 生产构建与 jobs 部署 dry-run |
| `pnpm billing:seed` / `pnpm billing:sync` | 写入示例套餐 / 同步价格到支付平台 |
