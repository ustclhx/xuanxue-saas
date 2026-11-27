# Proposal

## Why

目前两站只卖一次性积分包（$1.99 / 100 积分、$6.99 / 500 积分），没有回访激励，也没有稳定的经常性收入。模板 0.3.0 已经提供了「订阅 + 积分包并存」的目录、账单分区、余额不足合同，以及每日登录赠送积分（`credits.dailyEnabled`），本项目尚未启用。使用者已拍板以下方案：

- 两档月付订阅：**$4.99/月，含 400 积分**；**$9.99/月，含 1000 积分**；
- 每日登录赠送 **10 积分/天，每月最多 10 天**。

## What Changes

- **订阅套餐**：在目录中新增两个月付订阅套餐，工作键名为 `plus`（400 积分）和 `premium`（1000 积分），名称待确认；只提供月付，不提供年付。模板示例套餐 `pro`/`team` 保持停售。权益沿用免费档，模型授权不低于免费档，避免订阅后反而失去 Chat 模型。
- **订阅积分**：首付与每次续费按付款发放当期积分，到周期末加 24 小时宽限后过期，默认不结转，沿用模板逻辑。消耗顺序沿用「先到期先用」：每日积分 → 订阅积分 → 积分包。
- **支付平台**：订阅首发只经 Stripe 提供。PayPal 继续只卖积分包，不显示订阅选项（理由见 design）。
- **订阅币种**：订阅价格写入 `localize-checkout-currency` 的价目表。该 change 合并后，zh-Hant 订阅用 TWD、ko 用 KRW、其余用 USD；未合并时先以 USD 上线。续费币种在订阅创建时确定，不随界面语言改变。
- **定价页与账单页**：本项目定制的定价页目前只展示积分包，改为订阅与积分包并列（需先出设计稿并经使用者确认）。账单页、余额不足弹窗和解锁卡的「积分不足」流程都提供订阅入口。账单页直接复用模板的订阅分区、取消/恢复和 Stripe 客户门户。
- **取消与退款**：随时可以取消，在周期末生效，已付周期的积分与权益保留到周期结束。退款沿用人工审核的退款申请：全额退款回收剩余积分，部分退款按比例回收。法律页与 FAQ 补充自动续费、取消与退款条款。
- **每日积分**：将 `credits.dailyEnabled` 设为 `true`；运行时设置 `credits.dailyAmount=10`、`credits.dailyMaxDaysPerMonth=10`，有效期与「是否要求已验证邮箱」按 design 中的决定设置。领取在用户进入 App 区时自动检查并发放，App 布局显示领取提示，补齐四种语言的文案。
- **已知限制（已接受）**：两站按站点拆分账户，而每日领取按「规范化邮箱 + UTC 日期」全库唯一，所以同一邮箱在两站的账户共享每日与每月领取额度。之前已评估可以接受，本 change 将其写入 spec 与 FAQ。
- **外部动作**（需使用者批准）：
  - 在 Stripe 沙盒与 live 创建订阅 Product/Price；
  - 配置 Stripe 客户门户；
  - 更新 Stripe 业务描述（现为「No subscriptions」）；
  - staging 订阅端到端验收（staging 沙盒目前没有订阅价格）。

## Capabilities

### New Capabilities
- `daily-credits`：每日登录赠送积分的领取条件、每日/每月额度、有效期，以及跨站共享额度的行为。

### Modified Capabilities
- `subscriptions`：新增本站在售订阅档位、订阅积分有效期与不结转、续费币种固定、订阅内换档的积分规则。
- `payments`：新增「订阅只经启用订阅的平台提供」的要求（PayPal 只卖积分包）。
- `marketing-site`：新增「定价页并列展示订阅与积分包」的要求。
- `paid-readings`：修改「解锁流程保留意图」，积分不足时同时提供积分包与订阅。

## Impact

- 代码：
  - `packages/billing/src/catalog.ts`（新增套餐，与 A change 共享文件）；
  - `packages/billing/src/price-table.ts`（订阅价格，来自 A change）；
  - `packages/billing/scripts/sync-stripe-live.ts`：取消「只允许积分包」的限制，允许订阅价格；
  - `template.config.ts`：`dailyEnabled`；
  - `apps/web/src/features/marketing/pricing-page.tsx`（重做）、`features/readings/unlock-card.tsx`、`features/billing/*`、`messages/<locale>/*`、法律页内容。
- 数据：只新增 `plan` 和 `plan_price` 行，修改运行时设置，无 schema 迁移。模板的 `0021_daily_credits` 迁移已随 0.3.0 采纳。
- 外部：Stripe Product/Price（沙盒与 live）、客户门户配置、业务描述复审、webhook 事件（现有 10 项已包含订阅事件，无需改动）。
- Neon 成本：每日领取只在用户访问 App 时触发，KV 按天缓存检查结果；不新增定时任务。订阅续费沿用现有 webhook，补偿任务也沿用现有的 Cron 档位。
