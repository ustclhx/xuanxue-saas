# v1 待你决策 / 介入事项

协调者在长任务中遇到需要用户决定或人工操作的卡点时记录在这里，不阻塞其他可推进的任务。每项注明影响范围与当前的临时做法。处理后把状态改为「已决定」并写下结论。

| # | 事项 | 类型 | 影响 | 临时做法 | 状态 |
|---|---|---|---|---|---|
| D1 | AI 详批使用的模型（高性价比） | 决策 | `readings-core` 上线前；后台运行时设置 `readings.<kind>.modelKey` | 开发与测试用 fake provider，不写死模型 | 待决定（骨架完成后） |
| D2 | 东西两站的品牌名与正式域名 | 决策 + 购买 | hreflang 绝对地址、站点地图、OG、Organization 结构化数据、OAuth 回调 | 占位 `xuanxue-east.example` / `xuanxue-west.example`，品牌 `[东方站品牌名]` | 待决定 |
| D3 | 法国本地搜索量重核（`doc/design.md` §8 方式 B） | 人工 | 是否启动法语站 | v1 不做法语 | 待你在 Keyword Planner 导出 |
| D5 | 韩语만세력是否默认开启「진태양시」（真太阳时）修正 | 决策 | `/ko/` 时柱：抽查发现韩国站点默认修正（首尔约 −32 分钟），本引擎默认关闭，跨时辰时柱会不同（证据 docs/runbooks/evidence/bazi-crosscheck/2026-10-19.md） | 按 spec 默认关闭并醒目提示开关 | 待决定 |
| D6 | 运营主体信息与法律审阅 | 决策 + 人工 | 三语隐私政策/服务条款/退款/免责声明中的 `[公司名称]`、`[联系地址]` 占位，以及支持邮箱 | 占位文本，上线前替换并请法律专业人士审阅 | 待提供 |
| D4 | 台湾 / 韩国本地官方搜索量 | 人工 | 长尾页优先级 | 按设计文档的第三方口径排期 | 待你在 Keyword Planner 导出 |

## 上线前需要的账号与凭据（decision gate，见 launch-v1-production §2）

Cloudflare 账号与 API Token、Neon 生产库、Stripe（测试与 live）、Resend 发件域名、Google OAuth 应用（两站回调）、Turnstile（两站 hostname）、Sentry、GSC / Bing 账号。准备好后只需告诉协调者已就绪；密钥只写入 Wrangler / GitHub secrets，不进仓库。

**staging 自动发布目前关闭**：`.github/workflows/deploy-staging.yml` 只在仓库变量 `STAGING_ENABLED=true` 时运行。启用前需要：Neon staging 库与 `STAGING_MIGRATION_DATABASE_URL`、`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`、web/jobs 的 Wrangler secrets、`wrangler.jsonc` staging 资源 ID，并把 workflow 中的 `STAGING_URL` 占位改为真实 workers.dev 地址（由 Codex 部署 worker 按 deploy-cloudflare 技能执行）。

## 运营备注（不阻塞上线，供审阅）

- 付费卡上的当地货币「约」值使用代码内固定参考汇率（KRW 1400、TWD 32.5 / USD），实际扣款以 Stripe Adaptive Pricing 为准；建议每季度人工校准（`features/readings/unlock-card.tsx`）。
- 积分包种子：Single 100 积分 $0.99、Five 500 积分 $3.99，每次详批 100 积分；可在后台修改。
- 紫微详批的集成测试使用固定命盘 mock（iztro 在 vitest workers 池中的 CJS 加载问题），真实复算已在 workerd 中验证。

