# v1 待你决策 / 介入事项

协调者在长任务中遇到需要用户决定或人工操作的卡点时记录在这里，不阻塞其他可推进的任务。每项注明影响范围与当前的临时做法。处理后把状态改为「已决定」并写下结论。

| # | 事项 | 类型 | 影响 | 临时做法 | 状态 |
|---|---|---|---|---|---|
| D1 | AI 详批使用的模型（高性价比） | 决策 | `readings-core` 上线前；后台运行时设置 `readings.<kind>.modelKey` | 测试阶段用 DeepSeek `deepseek-flash`（当前即 V4.1-Flash-1017，见下方「D1 测试接入」）；正式上线前再选定模型接入 API | 已决定（测试：deepseek-flash；上线模型待选） |
| D2 | 东西两站的品牌名与正式域名 | 决策 + 购买 | hreflang 绝对地址、站点地图、OG、Organization 结构化数据、OAuth 回调 | — | 已决定（2026-10-20，域名已购买）：东方站 `ganjiday.com`，品牌 繁中「干支日」/ 韩语「간지데이」/ 标识 Ganjiday；西方站 `arcanumber.com`，各语言统一 Arcanumber（副标题本地化）。www 由 Cloudflare 重定向到裸域 |
| D3 | 法国本地搜索量重核（`doc/design.md` §8 方式 B） | 人工 | 是否启动法语站 | v1 不做法语 | 待你在 Keyword Planner 导出 |
| D5 | 韩语만세력是否默认开启「진태양시」（真太阳时）修正 | 决策 | `/ko/` 时柱：与韩国常见만세력一致（首尔约 −32 分钟） | — | 已决定：默认开启（`KO_TRUE_SOLAR_DEFAULT = true`，访客可关闭） |
| D6 | 运营主体信息与法律审阅 | 决策 + 人工 | 法律页运营者、联系方式；支付主体 | — | 已决定（2026-10-20）：个人开发者（税务居住地 CN），法律页以品牌名称呼运营者，不公开姓名与地址，只留各站联系邮箱 `support@arcanumber.com` / `support@ganjiday.com`（Cloudflare Email Routing 转发）。支付先接 Creem（MoR，个人可申请），后续注册美国公司后接 Stripe。法律文本仍需人工审阅 |
| D4 | 台湾 / 韩国本地官方搜索量 | 人工 | 长尾页优先级 | 按设计文档的第三方口径排期 | 待你在 Keyword Planner 导出 |

## D1 测试接入（DeepSeek `deepseek-flash`）

DeepSeek 官方 API 的模型名是 `deepseek-flash`，当前由 DeepSeek-V4.1-Flash-1017 提供（旧名 `deepseek-v4-flash` 也会路由到它）。详批是流式输出，而 AI Gateway 会把 DeepSeek SSE 整段缓冲（docs/06-ai.md），所以用 `AI_TEXT_EGRESS=direct` + `DEEPSEEK_API_KEY` 直连官方端点。

1. 密钥：本地已写入 `apps/web/.dev.vars`（gitignore，值取自 saas-template 本地 `.env.local`）；本项目 staging web secret 已配置 `DEEPSEEK_API_KEY`（仅核对名称；staging 已设 `AI_TEXT_EGRESS=direct`）。Neon 的模型行及六项 readings modelKey 已按本地配置写入；首次业务部署与实际链路验收见下述 staging 状态。密钥不进仓库。
2. 后台 → AI 模型 → 新增文本模型：key `deepseek-flash`，provider `deepseek`，Provider model ID `deepseek-flash`，参数 schema 加 `"x-text": {"thinking": false, "maxOutputTokens": 6000}`（关闭 thinking，首字更快、成本更低），启用。本地库已按此写入。
3. 后台 → 运行时设置：六个 `readings.<kind>.modelKey`（bazi-full、saju-full、ziwei-full、saju-compat、numerology-full、tarot-spread）填 `deepseek-flash`，`enabled` 默认开启。本地库已写入。
4. 2026-10-19 本地真实调用抽检（每类 1 份，thinking 关闭）：6 类章节齐全、语言正确；首字 0.6–1.0 s，整份 6–22 s，输出 0.8k–2.8k tokens；合规检查仅八字报告 1 段因「槓桿」命中投资规则并按设计替换。三语各 10 份的正式抽检（monetization 5.1）仍在 staging 做。
5. 正式上线换模型时只改第 2、3 步。Anthropic 模型也可在未配置 Gateway 时凭 `ANTHROPIC_API_KEY` 直连（PR #23）。

### D1 上线模型选型抽检基线（2026-10-20）

上线模型选型须使用5.1抽检的同一组30份输入做对比，保留原出生/姓名数据及塔罗牌组、牌序、正逆位和问题。输入摘要、两轮相同请求体核验、报告全文与逐份审读见[第二轮证据](runbooks/evidence/readings/2026-10-staging-sampling.md)和[第一轮证据](runbooks/evidence/readings/2026-10-staging-sampling-r1.md)。重点比较语言纯度（繁中简体/外语混入，韩语混入非术语汉字、日文或中文）与事实准确性（十神的时干/时支位置、神煞名称与次数、五行比例等）。

deepseek-flash第二轮基线为30份中4处语言问题、6处事实错误（R2-01–R2-10）。协调者决定：合规人工发现0、自动替换4处均通顺、R1的13项已解决，5.1合规验收通过；上述10条品质问题全部转入D1上线模型选型，正式上线模型仍待确定。保留原始报告与摘录，用于候选模型的同输入对比。

## 上线前需要的账号与凭据（decision gate，见 launch-v1-production §2）

Cloudflare 账号与 API Token、Neon 生产库、Stripe（测试与 live）、Resend 发件域名、Google OAuth 应用（两站回调）、Turnstile（两站 hostname）、Sentry、GSC / Bing 账号。准备好后只需告诉协调者已就绪；密钥只写入 Wrangler / GitHub secrets，不进仓库。

**staging 已启用（2026-10-19 UTC），自动发布开关待合并后开启**：Neon `xuanxue_staging`（`noisy-fire-19510813`，PG18 / aws-us-east-2）已建库、受限角色、完成 14 条迁移、billing seed 与 Stripe Sandbox 报价同步。Cloudflare 已新建 `xuanxue-files-staging`、`staging-xuanxue-staging-cache`、`xuanxue-email-staging` / `xuanxue-events-staging`、`xuanxue-staging-neon` / `xuanxue-staging-neon-cached`，ID 已回填；两个 Worker 的业务产物已部署，`staging:check-secrets` 退出 0。workflow 与 APP_URL 已设为 `https://xuanxue-web-staging.saas-jobs.workers.dev`，GitHub staging 三项发布 secrets 名称齐全。`STAGING_ENABLED` 未设置，由协调者在合并后启用。

Google 两项仍是启动必需项：协调者决定只在 staging secrets 使用明确占位值满足校验，**Google 登录按钮暂不可用**；等 D2 正式域名后再配置真实 OAuth 应用。未启用 PayPal/GitHub OAuth；Sentry 无 token 时跳过 release，仍删除客户端 maps。邮件默认 log，Resend/Sentry/R2 签名凭据尚未配置。

已知 staging 限制：报告邮件在 `features/readings/generate.ts:189–197` 使用 `siteOrigin`，实际函数对 workers.dev 的 west 请求仍返回 `https://xuanxue-west.example`。认证/支付回跳使用的 `requestSiteOrigin` 可正确回退到 APP_URL，但报告邮件不是这一路径。协调者明确决定该项不阻塞（未配 Resend，不发送实际邮件），并将在单独分支修改 siteOrigin；本分支不改认证运行时或站点解析。首次手动部署 SHA `853a55a6ab408789f3995345f60dd8b530fd5a47` 的 health（200/db.up/完整 SHA）、原有冒烟 3/3、Stripe 4242 购买 Single（99 美分 USD）、DeepSeek numerology-full 真实生成及报告页八章节、积分 +100/−100/余额 0 均已通过。管理员与测试用户凭据仅保存在忽略的 `.env.staging`（600）。资源 ID、实际步骤和核验记录见 [本项目 staging runbook](runbooks/staging-xuanxue.md)。

## 运营备注（不阻塞上线，供审阅）

- 性能：本地预检 CLS 已全部达标；LCP（本地未压缩 6.8–12.2s）需要上线 staging/生产后在 Brotli + HTTP/2 下复测。若仍超 2.5s，下一轮优化方向已列出：zod 移出入口、排盘引擎改为提交时加载、概念页与塔罗页拆分数据（报告「修复后复测」小节）。

- 付费卡上的当地货币「约」值使用代码内固定参考汇率（KRW 1400、TWD 32.5 / USD），实际扣款以 Stripe Adaptive Pricing 为准；建议每季度人工校准（`features/readings/unlock-card.tsx`）。
- 积分包种子：Single 100 积分 $0.99、Five 500 积分 $3.99，每次详批 100 积分；可在后台修改。
- 紫微详批的集成测试使用固定命盘 mock（iztro 在 vitest workers 池中的 CJS 加载问题），真实复算已在 workerd 中验证。

