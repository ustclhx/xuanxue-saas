# 运行时配置

Cloudflare 默认入口保持 `envSchema` / `loadEnv`：必须提供 HYPERDRIVE，app 可扩展绑定 schema，绑定保留原引用。三层配置仍分别属于模板代码、数据库 setting 和运行时密钥。

`billing.enabled`、`credits.enabled`、`marketing.enabled` 和 `i18n.enabled` 是模板开关，默认均为 `true`，只能通过代码修改后重新部署。关闭开关保留该模块其他字段的值；营销子功能仍由既有 `features` 字段控制，单语言使用 `i18n.defaultLocale`，关闭 i18n 不会改写语言列表。

计费启用要求积分启用；任一 AI 模态启用要求计费和积分同时启用，沿用现有套餐授权与积分结算，不建立替代额度。可以在 AI 全关时单独保留积分并关闭计费。团队工具全关组合应同时关闭三个 AI 模态；认证、空间和邮件配置继续独立生效。关闭计费不要求支付模式或支付凭据，也不应触发计费套餐 seed；入口、任务和 seed 接线由应用负责，不能仅清空 `billing.providers` 来关闭计费。现有显式 `_FILE` 错误规则仍适用。

禁止把配置对象序列化到前端或健康响应；只在服务器显式挑选公开 UI 字段。密钥不得放入 VITE_* 或构建缓存。

验证：`pnpm --filter @xuanxue/config test`、`pnpm --filter @xuanxue/config typecheck`。
