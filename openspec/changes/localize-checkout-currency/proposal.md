# Proposal

## Why

东方站（ganjiday.com）的主要客群在台湾与韩国，目前所有付款都以美元扣款（Stripe 关闭了 Adaptive Pricing，PayPal 只支持 USD）。页面上「≈ NT$65」「≈ ₩2,800」只是按实时汇率估算的参考值，实际扣款金额要由发卡行换算，用户还可能被收取境外交易手续费。这造成两个问题：页面显示的价格和账单金额对不上，影响用户信任；本地化价格本身也有助于转化。

使用者已拍板，按界面语言决定结算币种：

| 界面语言 | Stripe 结算币种 | PayPal 结算币种 | 页面展示 |
|---|---|---|---|
| zh-Hant | TWD | USD | Stripe 显示 NT$ 实价，PayPal 显示 USD |
| ko | KRW | USD | Stripe 显示 ₩ 实价，PayPal 显示 USD |
| zh-Hans | USD | USD | 以 USD 为准，附 CNY 参考价 |
| en | USD | USD | USD |

本地价格不随实时汇率浮动，而是按一份固定汇率换算并取整，写成可维护的价目表。

## What Changes

- **价目表**：新增项目自有的价目表，列出每个套餐、每个币种的固定金额（以最小货币单位记录），并写明换算所用的汇率快照和取整规则。种子数据、Stripe/PayPal 价格同步、定价页展示都从这一处读取。CNY 参考价使用同一份表中的固定汇率，不再请求实时汇率接口。
- **多币种价格行**：`plan_price` 按 (套餐, 支付平台, 周期, 币种) 各建一行，每行映射到支付平台上的一个独立价格对象。不使用 Stripe Price 的 `currency_options`。无需数据库迁移，`plan_price` 已有 currency 列。
- **结账选价**：服务端根据请求的界面语言和支付平台选出要扣款的价格行。如果该币种的价格未同步或已停用，回退到 USD，并且定价页显示的价格与实际扣款保持一致。客户端不能指定币种。
- **币种感知的账务校验**：回调入账不再只接受 USD，改为允许 USD / TWD / KRW 三种币种，并且要求付款币种与价格行的币种一致。币种不符仍按 `BILLING_CURRENCY_MISMATCH` 处理，不重试。订单、付款、退款与退款申请都按付款币种的最小单位记录。**BREAKING（内部）**：`money()` 等函数会把币种作为参数传入。
- **零小数与特殊币种**：KRW 是零小数币种。TWD 在 Stripe 中按两位小数记录，但金额必须是整元（最小单位为 100 的倍数）。在 PayPal 中 TWD 不能带小数。这些规则统一由一张币种指数表处理，不再到处写死除以 100。
- **展示**：新增统一的价格格式化函数，用 `Intl.NumberFormat` 输出，按币种指数换算并去掉小数，例如 `NT$65`、`₩2,800`、`US$1.99`，zh-Hans 显示「约 ¥13」。适用页面包括定价页、解锁卡、账单页、后台付款与退款列表、运营通知和分析事件。
- **价格同步脚本**：Stripe 的 test 与 live 同步脚本、PayPal 的价格激活脚本都支持多币种价格。在 live 环境创建价格属于外部写操作，必须先经使用者批准。
- **合规文案**：如实说明「价格已含税/以结账页为准」，以及跨币种退款的处理方式。Stripe 账户的业务描述中「只收美元」需要由运营更新。

## Capabilities

### New Capabilities
- `checkout-currency`：按界面语言决定结算币种、固定汇率的本地价目表、零小数币种的金额规则、多币种的订单/付款/退款记录与价格展示。

### Modified Capabilities
- `paid-readings`：「解锁入口」中「按访客地区估算的当地货币价格」改为按界面语言显示实际结算价（zh-Hant、ko）或参考价（zh-Hans）。

## Impact

- 代码：
  - `packages/billing`：`catalog.ts` 的种子与激活、`events/shared.ts` 的 `money()`、`services.ts` 的 `priceFor`、`stripe/operations.ts` 中的结账选价与同步、`stripe/localized.ts`、`paypal/money.ts`、`refunds.ts`；脚本 `seed.ts`、`sync.ts`、`sync-stripe-live.ts`、`activate-credit-packs.ts`；
  - `apps/web`：`features/readings/price.ts`、`readings.functions.ts`（移除实时汇率）、`features/marketing/pricing-page.tsx`、`pricing-read.ts`、`features/billing/*`（账单页与后台展示、退款金额输入）；
  - `apps/jobs`：`notifications/analytics.ts`（修复 `amount / 100` 写死的问题）。
- 数据：只新增 `plan_price` 行，并停用或替换已有行，不做 schema 迁移。已有 USD 行和历史付款不变。
- 外部：需在 Stripe（staging 沙盒与 live）创建 TWD/KRW 价格；PayPal 需确认账户能接收 TWD；更新 Stripe 业务描述；税务登记由运营确认。
- 与 `enable-subscriptions-daily-credits` 的关系：订阅价格也写入同一份价目表。两个 change 的分工与合并顺序见两者的 design.md。
