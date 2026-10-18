# v1 待你决策 / 介入事项

协调者在长任务中遇到需要用户决定或人工操作的卡点时记录在这里，不阻塞其他可推进的任务。每项注明影响范围与当前的临时做法。处理后把状态改为「已决定」并写下结论。

| # | 事项 | 类型 | 影响 | 临时做法 | 状态 |
|---|---|---|---|---|---|
| D1 | AI 详批使用的模型（高性价比） | 决策 | `readings-core` 上线前；后台运行时设置 `readings.<kind>.modelKey` | 开发与测试用 fake provider，不写死模型 | 待决定（骨架完成后） |
| D2 | 东西两站的品牌名与正式域名 | 决策 + 购买 | hreflang 绝对地址、站点地图、OG、Organization 结构化数据、OAuth 回调 | 占位 `xuanxue-east.example` / `xuanxue-west.example`，品牌 `[东方站品牌名]` | 待决定 |
| D3 | 法国本地搜索量重核（`doc/design.md` §8 方式 B） | 人工 | 是否启动法语站 | v1 不做法语 | 待你在 Keyword Planner 导出 |
| D4 | 台湾 / 韩国本地官方搜索量 | 人工 | 长尾页优先级 | 按设计文档的第三方口径排期 | 待你在 Keyword Planner 导出 |

## 上线前需要的账号与凭据（decision gate，见 launch-v1-production §2）

Cloudflare 账号与 API Token、Neon 生产库、Stripe（测试与 live）、Resend 发件域名、Google OAuth 应用（两站回调）、Turnstile（两站 hostname）、Sentry、GSC / Bing 账号。准备好后只需告诉协调者已就绪；密钥只写入 Wrangler / GitHub secrets，不进仓库。
