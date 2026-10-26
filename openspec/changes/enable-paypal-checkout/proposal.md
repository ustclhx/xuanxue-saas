# Proposal

## Why

v0.1.1 在两站（arcanumber.com / ganjiday.com）以「支付未开通」状态上线，详批解锁入口一直显示「即将开放」。D6 已决定先接 PayPal（个人开发者、税务居住地 CN，Stripe 暂缓）。模板自带的 PayPal 适配器（Orders v2、capture、验签、退款）已在 Sandbox 录制验证，但本站还没有能实际收款的完整链路：

- 回跳页只有英文，用户必须手动点「Confirm payment」才会 capture；
- 用户批准付款后关掉页面，订单永远不会被 capture；
- 生产环境没有设置 `PAYMENT_MODE`，也没有激活 PayPal 积分包价格的安全路径；
- 法律页写的仍是 Stripe。

## What Changes

- `template.config.ts` 的 `billing.providers` 改为 `['paypal']`。Stripe 代码保留但不启用。依赖 Stripe 结账入口的 e2e 改为不绑定具体 provider，或改为 PayPal。
- PayPal 一次性付款回跳页：
  - 进入页面后自动 capture，去掉手动按钮；
  - 按发起站点的语言显示（en / zh-Hant / zh-Hans / ko）；
  - capture 成功后自动回到发起页，交给解锁卡继续生成；
  - 遇到可恢复的拒付时引导用户回到 PayPal 重新选择付款方式。
- PayPal 下单信息：
  - 按发起站点传入品牌名（Arcanumber / Ganjiday·干支日）和页面语言；
  - 订单附带商品描述（积分数量与站点品牌）。
- 漏单兜底：已批准但未 capture 的 PayPal 订单由后台补 capture。触发方式有两种：`CHECKOUT.ORDER.APPROVED` 回调，以及定时扫描。补 capture 与返回页 capture 共用同一幂等键。
- 生产支付配置：
  - web / jobs production 显式设置 `PAYMENT_MODE=live`；
  - 生产 secret 检查按启用的 provider 要求 `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID`；
  - 新增 live 环境下只激活 PayPal 积分包映射的命令，不发起远端请求，不触碰订阅价格。
- 账单页只有一个可用 provider 时不再显示支付方式下拉。
- 法律页（terms / privacy / refund）把付款处理方改为 PayPal，并更新第三方处理方表格。文本仍需人工审阅。
- 文档：更新 `docs/05-billing.md`、`docs/v1-decisions.md`、`docs/runbooks/production-xuanxue.md`、`docs/runbooks/launch-v1.md`，加入 PayPal staging/生产上线 runbook。
- 验收：staging 用 PayPal Sandbox 跑通「解锁 → 付款 → 入账 → 自动生成」、取消、退款与删号。生产在两站各完成一笔真实小额购买并退款。

**不在本次范围**：

- 积分包价格与档位。用户核实 PayPal 费率后决定；在此之前沿用种子值 Single 100 积分 $0.99、Five 500 积分 $3.99。若调整，作为单独任务修改目录。
- 订阅（pro/team 保持停用）。
- Stripe 上线。
- 购买收据邮件。
- PayPal 高级信用卡（ACDC）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `payments`：
  - 一次性付款从返回页的手动确认改为自动 capture，并增加批准后未返回时的后台补 capture；
  - 新增回跳页按站点语言显示、拒付后可恢复的要求；
  - 新增 PayPal 订单按发起站点展示品牌与商品描述的要求；
  - 新增账单页单一 provider 时不显示选择器的要求。
- `payment-mode`：
  - 新增生产环境显式 live 模式与 PayPal 凭据预检要求；
  - 新增 live 环境只激活积分包映射（无远端调用）的要求。

## Impact

- 代码：
  - `template.config.ts`
  - `apps/web/src/routes/app/$slug/billing-return.tsx`
  - `apps/web/messages/*`
  - `apps/web/src/features/billing/customer.functions.ts`
  - `apps/web/src/routes/app/$slug/billing.tsx`
  - `packages/billing/src/paypal/operations.ts`、`provider.ts`（CheckoutInput 增加站点展示字段）
  - `packages/billing/src/services.ts` 与 `cron.ts`（补 capture）
  - `packages/billing/scripts/`（live 积分包激活）
  - `apps/jobs/src/`（定时补 capture 入口）
  - `apps/web/wrangler.jsonc`、`apps/jobs/wrangler.jsonc`（production `PAYMENT_MODE`）
  - `scripts/staging/check-secrets.mjs`、`scripts/production/*`
  - `apps/web/content/legal/en/*`
  - e2e：`smoke.spec.ts`、`billing-pages.spec.ts`、`billing-actions-helper.ts`
- 外部系统：
  - PayPal Business 账号；
  - Sandbox 与 Live REST App；
  - 两个 webhook（staging / production）；
  - Wrangler secrets（web 与 jobs）。
- 依赖：
  - 生产开放付款要和 D1 上线模型、生产 `DEEPSEEK_API_KEY`、后台详批开关同时完成（launch-v1-production 2.2），否则用户买到的积分无法使用；
  - 积分包价格待用户决定。
