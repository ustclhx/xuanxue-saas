# Stripe 上线 runbook（两站共用一个 live 账户）

Stripe 接入复用模板实现（模板已在 Stripe 沙盒验收，见 [p2-acceptance-stripe](p2-acceptance-stripe.md)），本文只写本站两站差异与生产步骤。
PayPal 保留，步骤见 [paypal-launch](paypal-launch.md)。

## 0. 边界

- 一次性积分包：`reading_single` 100 积分 $1.99、`reading_five` 500 积分 $6.99，积分 365 天到期。
- 月付订阅（change `enable-subscriptions-daily-credits`）：`plus` $4.99 / NT$162 / ₩7,000 每月 400 积分，`premium` $9.99 / NT$325 / ₩14,000 每月 1000 积分；
  积分当期有效（周期末加 24 小时宽限）、不结转；只经 Stripe，PayPal 不卖订阅。模板示例 `pro` / `team` 仍停售、无价格。
  - 创建：`billing:seed` 为每档建 Stripe USD / TWD / KRW 月付占位行（停用）；第 3 节第 4 步的同一条命令负责创建，演练中订阅行显示为
    `+ plus USD 499 /month on canonical product`、`+ plus TWD 16200 /month on zh-Hant localized product` 等，并输出
    `Model grants: <档位> OK / MISSING …`。出现 MISSING 时先在 `/admin/billing/plans` 给该档授予不少于免费档的模型，否则写入会在调用 Stripe 前失败。
  - 客户门户（Stripe 后台 Settings → Billing → Customer portal，沙盒与 live 各配一次）：允许修改付款方式、查看发票、取消订阅（设为周期末生效）；
    关闭「切换方案」与「暂停」，换档只走账单页以保持续费币种。
  - 停用：经使用者批准后把 `plan.key in ('plus','premium')` 的 Stripe `plan_price` 行设为 `active=false`，并在 Stripe 后台把对应 Price 设为 inactive；
    定价页回到「即将开放」，已存在的订阅照常续费，用户可在账单页或门户取消。
  - live 激活前须完成第 4 节业务描述更新（原描述写有「No subscriptions」）。
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
   **多币种价格（change `localize-checkout-currency`）**：价目表 `packages/billing/src/price-table.ts` 为每个积分包另有
   TWD / KRW 金额。`billing:seed` 为它们各建一行 Stripe 占位价格（`unsynced:stripe:…`、停用），PayPal 只有 USD 行。
   上述同一条命令负责创建：TWD Price 挂在 `zh-Hant` 本地化商品上、KRW Price 挂在 `ko` 本地化商品上，元数据含
   `planPriceId` 与 `currency`，Price ID 直接写回对应的 `plan_price` 行并启用（不使用 `lookup_key`）。

   - 部署顺序：先部署币种感知的 web 与 jobs，再 `billing:seed`（新行停用，页面与结账仍为 USD），最后演练并写入。
   - 演练输出先列出现状，再列出将创建的价格，例如：

     ```text
     reading_single KRW 2800 unsynced
     reading_single TWD 6500 unsynced
     reading_single USD 199 price_…
     Would create 2 live Stripe prices:
       + reading_single KRW 2800 on ko localized product
       + reading_single TWD 6500 on zh-Hant localized product
     Dry run: set BILLING_SYNC_CONFIRM=stripe-live to create live mappings.
     ```

     清单经使用者确认后才执行写入命令。TWD 金额不是 100 的倍数（整元）时，种子与同步在写库或调用 Stripe 之前失败。
   - 调价：改价目表 → 评审合并 → `billing:seed` 新增新金额的占位行 → 演练与写入创建新 Price；旧行保留历史映射，
     在 Stripe 后台把旧 Price 设为 inactive（Price 不可改价）。
   - 停用本地币种（回滚）：把对应 `plan_price` 行设为 `active=false`（例如
     `update plan_price set active = false where provider = 'stripe' and currency in ('TWD', 'KRW')`，需经使用者批准后在生产库执行）。
     定价页与结账自动回退 USD；已入账的 TWD/KRW 付款仍可正常退款。恢复时把这些行重新设为 `active=true`。
   - 沙盒（staging）用 `BILLING_SYNC_MODE=test pnpm billing:sync`，同样只创建缺少的价格，执行前列出对象清单并获批准。

5. 两站各做一笔真实小额购买并退款：核对页头名称、语言、商品行名称（东方站为本地化商品名）、账单描述、到账积分、退款后积分回收、回调列表站点列。

## 4. 需运营确认的商家资料（不由代码修改）

Stripe 后台现有业务描述与实际服务不符时，按下列事实改写后由运营提交；改动可能触发复审。

- 运营主体：Lucinum LLC（美国怀俄明州有限责任公司）。
- 网站：arcanumber.com（主网址）与 ganjiday.com（同一主体的第二个品牌站，在业务描述中说明，或按 Stripe 要求登记为附加网站）。
- 建议描述（英文）：

  > Lucinum LLC operates two websites offering free online calculators for Chinese metaphysics (BaZi / Four Pillars, Zi Wei Dou Shu; ganjiday.com, in Chinese and Korean) and numerology and tarot (arcanumber.com, in English). Users can buy one-time digital credit packs (US$1.99 for 100 credits, US$6.99 for 500 credits) to unlock AI-generated written reports delivered instantly online, for entertainment and self-reflection. No subscriptions, physical goods, live or phone readings, or guaranteed outcomes. Credits expire 365 days after purchase; unused credits are refundable within 30 days.

  启用订阅（change `enable-subscriptions-daily-credits` 任务 1.3）后，把上段第二、第三句改为：

  > Users can buy one-time digital credit packs (US$1.99 for 100 credits, US$6.99 for 500 credits) or subscribe monthly (US$4.99 for 400 credits per month, US$9.99 for 1,000 credits per month; auto-renews until canceled, cancel anytime, effective at the end of the paid period) to unlock AI-generated written reports delivered instantly online, for entertainment and self-reflection. No physical goods, live or phone readings, or guaranteed outcomes. Credit pack credits expire 365 days after purchase and subscription credits at the end of each billing period; refund requests are reviewed manually within 30 days.

- 行业类别：选与「数字内容 / 娱乐类在线服务」最接近的类别，并如实写明命理与塔罗内容。占卜、命理类业务在 Stripe 可能属于需审查的类别，以 Stripe 的回复为准，不以账户已启用为准。
- 公开商家名与卡账单前缀：建议 `LUCINUM` / `LUCINUM LLC`，与条款中的运营主体一致。
- 客服信息：两站分别为 support@ganjiday.com、support@arcanumber.com；Stripe 后台只能填一个，建议填西方站邮箱并在描述中注明两站。
- 业务限制：按界面语言以固定价目表收取美元、新台币或韩元（繁体中文界面 TWD、韩语界面 KRW，其余 USD；PayPal 一律 USD），
  价格不随汇率浮动，已关闭 Adaptive Pricing；未启用 Stripe Tax，税务处理需运营另行确认；退款人工审核（30 天内未使用积分），按原付款币种退回。
  原描述中的「只收美元」须在 live 激活 TWD/KRW 价格之前由运营改写（localize-checkout-currency 任务 1.2）。
  建议在英文描述中把价格改为 `US$1.99 / NT$65 / ₩2,800 for 100 credits, US$6.99 / NT$227 / ₩9,800 for 500 credits`。
