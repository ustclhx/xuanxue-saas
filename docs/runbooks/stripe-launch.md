# Stripe 上线 runbook（两站共用一个 live 账户）

Stripe 接入复用模板实现（模板已在 Stripe 沙盒验收，见 [p2-acceptance-stripe](p2-acceptance-stripe.md)），本文只写本站两站差异与生产步骤。
PayPal 保留，步骤见 [paypal-launch](paypal-launch.md)。

## 0. 边界

- 只卖一次性积分包：`reading_single` 100 积分 $1.99、`reading_five` 500 积分 $6.99，积分 365 天到期；订阅 `pro` / `team` 停售、无价格，不在 Stripe 创建订阅价格。
- `billing.providers: ['stripe', 'paypal']`：生产未写入 Stripe 密钥时 Stripe 显示为不可用，PayPal 照常；写入密钥并完成映射后 Stripe 才可选。
- 仓库公开：密钥、webhook signing secret、数据库 URL、账户邮箱不写入本文、证据、PR 或日志。secret 只经 stdin 写入。
- **账户可收款不等于业务已获批**：Stripe 可能在收款后按业务描述复审、要求补材料或限制账户。开放生产付款前需运营确认第 4 节。

## 1. 两站差异（代码已处理）

| 项 | ganjiday.com（east） | arcanumber.com（west） |
| --- | --- | --- |
| Checkout 页头名称（`branding_settings.display_name`） | 干支日 / 간지데이（按语言） | Arcanumber |
| Checkout 语言 | zh-TW / zh / ko | en |
| Checkout 商品行（Product 名称） | 單次詳批 / 单次详批 / 상세 풀이 1회 等（按语言的本地化商品） | Single Reading / 5-Reading Pack |
| 付款说明（PaymentIntent description） | `100 積分 · 干支日` 等 | `100 credits · Arcanumber` |
| 卡账单后缀（`statement_descriptor_suffix`） | `GANJIDAY` | `ARCANUMBER` |
| 元数据 `site` | `east` | `west` |
| 成功 / 取消回跳 | ganjiday.com | arcanumber.com |

- 订单与积分归属只认 Checkout 元数据中的 `workspaceId` / `userId` / `planPriceId`（UUID，服务端生成）；`site` 只用于 Stripe 后台对账，不参与归属。回调列表的站点列由空间推出（`webhook-attribution.ts`）。
- 本地化商品：`plan_price.providerPriceId` 只记录规范（英文）价格，西方站与订阅照旧使用。积分包另为 zh-Hant / zh-Hans / ko 各建一个 Product（ID `xuanxue_plan_<planId 去横线>_<zh_hant|zh_hans|ko>`，名称与说明如 `單次詳批`、`100 積分`）和同金额 Price（`lookup_key` 为 `xuanxue_<planPriceId>_<语言>`，元数据含 `planPriceId`、`canonicalPriceId`、`locale`）。译名表在 `packages/billing/src/stripe/localized.ts`，对应 `apps/web/messages/*/marketing.json` 的积分包文案，改文案需两处同步。
- 东方站 Checkout 按语言用 `lookup_key` 查本地化价格，核对 `planPriceId`、`canonicalPriceId`、金额与币种后作为商品行；查不到或不一致时回退到规范价格（英文商品名），不阻断付款，因此先部署代码、后跑映射也安全。订单快照把本地化价格还原为规范价格 ID，入账与对账只看到规范价格。
- 页头名称之外，Stripe 收据、条款与卡账单前缀仍显示账户的公开商家名（第 4 节）。

## 2. 回调

一个 web Worker 服务两站，生产只登记一个 endpoint：`https://arcanumber.com/api/billing/webhooks/stripe`，API version `2026-09-30.endive`（代码严格校验）。事件取自 `stripe/adapter.ts`：

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
charge.refunded
charge.dispute.created
```

- 验签：`STRIPE_WEBHOOK_SECRET`；事件 `livemode` 必须与 `PAYMENT_MODE=live` 一致，否则拒收。
- 幂等：回调按事件 ID 去重；付款按 `(provider, providerPaymentId)` 唯一，积分按付款发放，重复投递不重复发积分。
- 延迟付款失败（`async_payment_failed`）：只把仍待付款的订单标为 failed，不发积分；之后若平台又报告付款成功，以平台为准改为 paid。
- staging endpoint 需补订阅 `checkout.session.async_payment_failed`。

## 3. 生产配置差异与步骤（由用户执行）

| 名称 | staging | 生产 | 写入位置 |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…`（沙盒） | `sk_live_…` 或受限 `rk_live_…` | web 与 jobs `--env production` |
| `STRIPE_WEBHOOK_SECRET` | 沙盒 endpoint 的 `whsec_…` | live endpoint 的 `whsec_…` | web 与 jobs `--env production` |
| `PAYMENT_MODE` | `test` | `live`（已在 wrangler.jsonc） | — |

受限密钥至少需要：Checkout Sessions 写、PaymentIntents / Charges / Customers / Invoices / Prices 读（Prices 读用于东方站查本地化价格，缺少时回退英文商品名）、Refunds 写、Products / Prices 写（仅映射时用，可用单独密钥）。

1. Stripe 后台确认账户公开信息（第 4 节）与卡账单前缀，前缀加 `* ` 与后缀不超过 22 个字符（如 `LUCINUM* ARCANUMBER` 共 19）。
2. 建 live endpoint（第 2 节事件），取 signing secret。
3. 写 secret（不回显）：`wrangler secret put STRIPE_SECRET_KEY --env production` 等，web 与 jobs 各一次。
4. 积分包映射，先演练后写入：

   ```sh
   # 演练：只读库连接，只列出现状，不调用 Stripe、不需要 Stripe 密钥
   CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=<只读库 URL> \
   BILLING_SYNC_DATABASE_CONFIRM=<库名> pnpm billing:sync-stripe-live
   # 写入：应用库连接 + live 密钥，创建规范与本地化 Product/Price，并把规范价格写回 plan_price
   STRIPE_SECRET_KEY=… CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=<应用库 URL> \
   BILLING_SYNC_DATABASE_CONFIRM=<库名> BILLING_SYNC_CONFIRM=stripe-live pnpm billing:sync-stripe-live
   ```

   生产库需已跑过 `billing:seed`（Stripe 占位行）。只有写入时才要求 `sk_live_` / `rk_live_` 密钥。重跑幂等：已映射的规范价格与已存在的本地化价格只核对金额、币种与元数据，不一致即报错、不改指向；在已映射的库上重跑会补建缺少的本地化商品与价格（不写库）。
5. 两站各做一笔真实小额购买并退款：核对页头名称、语言、商品行名称（东方站为本地化商品名）、账单描述、到账积分、退款后积分回收、回调列表站点列。

## 4. 需运营确认的商家资料（不由代码修改）

Stripe 后台现有业务描述与实际服务不符时，按下列事实改写后由运营提交；改动可能触发复审。

- 运营主体：Lucinum LLC（美国怀俄明州有限责任公司）。
- 网站：arcanumber.com（主网址）与 ganjiday.com（同一主体的第二个品牌站，在业务描述中说明，或按 Stripe 要求登记为附加网站）。
- 建议描述（英文）：

  > Lucinum LLC operates two websites offering free online calculators for Chinese metaphysics (BaZi / Four Pillars, Zi Wei Dou Shu; ganjiday.com, in Chinese and Korean) and numerology and tarot (arcanumber.com, in English). Users can buy one-time digital credit packs (US$1.99 for 100 credits, US$6.99 for 500 credits) to unlock AI-generated written reports delivered instantly online, for entertainment and self-reflection. No subscriptions, physical goods, live or phone readings, or guaranteed outcomes. Credits expire 365 days after purchase; unused credits are refundable within 30 days.

- 行业类别：选与「数字内容 / 娱乐类在线服务」最接近的类别，并如实写明命理与塔罗内容。占卜、命理类业务在 Stripe 可能属于需审查的类别，以 Stripe 的回复为准，不以账户已启用为准。
- 公开商家名与卡账单前缀：建议 `LUCINUM` / `LUCINUM LLC`，与条款中的运营主体一致。
- 客服信息：两站分别为 support@ganjiday.com、support@arcanumber.com；Stripe 后台只能填一个，建议填西方站邮箱并在描述中注明两站。
- 业务限制：只收美元（已关闭 Adaptive Pricing）；未启用 Stripe Tax，税务处理需运营另行确认；退款人工审核（30 天内未使用积分）。
