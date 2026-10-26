# Design

## Context

模板已经提供 PayPal Provider，代码在 `packages/billing/src/paypal/`，能力包括：

- 一次性付款：Orders v2，`intent=CAPTURE`；`custom_id` 记录 workspaceId、planPriceId、userId。
- 回调：`POST /v1/notifications/verify-webhook-signature` 验签，按 `PAYMENT.CAPTURE.COMPLETED` 入账。
- 退款：调用 `/v2/payments/captures/{id}/refund`。
- OAuth token 缓存在 KV。

Sandbox 已录制 Capture 完成、Capture 退款、订单批准等回调，并据此建立测试夹具。

本站现状：

- 只开放一次性积分包，`pro`/`team` 已停用，目录里没有订阅价格。
- 结账入口有两处：解锁卡（`apps/web/src/features/readings/unlock-card.tsx`）和账单页。两者都调用 `checkoutCustomer`。
- 一次性订单在 `createCheckout` 时写入 `purchase(status='pending', providerOrderId=<order id>)`。
- 回跳页 `apps/web/src/routes/app/$slug/billing-return.tsx`：
  - 文案是英文硬编码；
  - 必须点击按钮才会调用 `confirmCustomerCheckout` 做 capture；
  - capture 后用户再点链接回到 `returnTo?checkout=success`；
  - 解锁卡看到 `checkout=success` 后轮询余额，到账后自动生成。
- `confirmCheckout` 使用幂等键 `capture:${purchase.id}`，透传为 `PayPal-Request-Id`。
- 生产 wrangler 没有设置 `PAYMENT_MODE`，生产库的 PayPal 价格行仍是 `unsynced:` 且 inactive。`billing:sync` 强制要求 `BILLING_SYNC_MODE=test`。
- jobs 的 `BILLING_RETRY_CRON`（`*/10 * * * *`）已经承担投递恢复和补偿任务。

约束：

- 运营者是个人开发者，税务居住地为中国。PayPal 商家账号不支持高级信用卡（ACDC），买家只能在 PayPal 托管页付款，可以用账户，也可以按 PayPal 规则以访客身份刷卡。
- 仓库是公开的，不能提交任何密钥。
- 积分包价格待用户核实费率后决定。

## Goals / Non-Goals

**Goals：**

- 两站用户在任意语言下都能完成「选择积分包 → PayPal 付款 → 自动回到原页面 → 积分到账 → 自动生成」，中途不需要额外点击。
- 用户批准付款后即使没有回来，也能在 10 分钟级别内被补 capture 并入账。
- 生产能安全地切到 live：凭据有预检，积分包可激活，全程不发起不受控的远端写操作。
- 法律页与实际付款处理方一致。

**Non-Goals：**

- 订阅、Stripe、购买收据邮件、PayPal 高级信用卡、多币种。
- 积分包价格调整（见 Open Questions）。
- 修改回调入账、退款与对账的既有账务逻辑。

## Decisions

### D1 回跳页自动 capture，失败分类返回

`billing-return` 在客户端挂载后，满足 `needsConfirm` 条件就自动调用 `confirmCustomerCheckout` 一次，用 ref 防止重复调用。结果分四类处理：

| 结果 | 页面行为 |
|---|---|
| 成功（含「已 paid」幂等返回） | `location.replace(returnHref(returnTo, false))`；没有 `returnTo` 时进入账单页 |
| `BILLING_PAYMENT_DECLINED` 且带 `retryUrl` | `location.assign(retryUrl)`，回到 PayPal 重新选择付款方式 |
| 其他错误 | 显示本地化错误和「重试」按钮。重试仍使用同一幂等键，不会重复扣款 |
| `canceled=true` | 保持现状，直接重定向回发起页 |

文案放在新的 `apps/web/messages/<locale>/billing.json`，共 4 种语言，遵守按功能拆分文案的规则。页面语言按以下顺序确定：

1. `returnTo` 带的语言前缀（`safeReturnPath` 已校验）；
2. 应用区现有的语言解析。

为什么不在服务端 `beforeLoad` 里 capture：GET 请求不应该产生扣款副作用，预取或爬虫也可能触发；而且服务端重定向里无法处理拒付跳转和错误展示。

### D2 拒付恢复的契约

PayPal capture 返回 `422 UNPROCESSABLE_ENTITY` 且 issue 为 `INSTRUMENT_DECLINED` 时，按 PayPal 推荐的做法，让买家用同一订单的 approve 链接重新选择付款方式。处理分三层：

- **transport**：`PayPalHttpError` 增加可选的 `issue` 字段。只从响应体中解析出 issue 名称，不携带响应正文，保持现有的脱敏约束。
- **operations**：`confirmCheckout` 捕获上述错误后，抛出带 `retryUrl` 的领域错误。`retryUrl` 是该订单的 approve 链接，由 `https://www.paypal.com/checkoutnow?token=<id>`（Sandbox 用 `www.sandbox.paypal.com`）按环境拼接。
- **services / customer.functions**：转换为 `AppError('BILLING_PAYMENT_DECLINED', …, { details: { retryUrl } })`。`safe()` 在 `ok:false` 的结果中额外返回 `retryUrl`，只有这个错误码会带。

其他 PayPal 错误维持现状，统一转为 `BILLING_UNAVAILABLE` 并记录日志。

### D3 PayPal 订单的站点展示

`CheckoutInput` 增加可选字段 `presentation: { brandName: string; locale: string; description: string }`：

- 由 `customer.functions.ts` 生成：按请求 Host 解析站点品牌，按 `returnTo` 的语言或当前语言取品牌本地名。`description` 形如「100 credits · Ganjiday」，由服务端模板生成，不接受客户端文本，避免写入出生信息等用户输入。
- `operations.ts` 的映射：
  - `experience_context.brand_name`：截断到 127 字符；
  - `experience_context.locale`：语言映射为 `en-US` / `zh-TW` / `zh-CN` / `ko-KR`；
  - `purchase_units[0].description`：截断到 127 字符；
  - `purchase_units[0].items`：一项，`category: 'DIGITAL_GOODS'`，并配上 `amount.breakdown.item_total`。
- Stripe 忽略该字段。
- 不设置 `soft_descriptor`：它受 PayPal 账户配置约束，首版不依赖它。

### D4 已批准未 capture 订单的后台补 capture

在 `packages/billing` 新增 `runPendingCaptures(ctx, now)`，挂到 jobs 的 `BILLING_RETRY_CRON`，与投递恢复并列：

- **扫描范围**：`purchase.status='pending'`、`provider='paypal'`、`created_at` 在 `[now-72h, now-10min]` 内，每轮最多 50 条。
- **逐条处理**：先 `GET /v2/checkout/orders/{id}`，再按状态处理：

  | 订单状态 | 处理 |
  |---|---|
  | `APPROVED` | 用同一幂等键 `capture:${purchase.id}` capture |
  | `COMPLETED` | 什么都不做，由回调或补偿入账 |
  | `CREATED` / `PAYER_ACTION_REQUIRED` 且超过 3 小时 | 标记 `failed` |
  | `VOIDED`，或 GET 返回 404 | 标记 `failed` |

- 超过 72 小时仍为 pending 的记录，一律标记 `failed`。
- 标记 `failed` 时用条件更新 `WHERE status='pending'`，避免覆盖已入账的状态。
- 为不依赖用户身份，把 `confirmCheckout` 拆出内部函数 `capturePurchase(ctx, purchase)`。用户入口继续做 owner 校验，再调用它。
- 不新增迁移：`purchase.status` 已有 `failed`。

不选「`CHECKOUT.ORDER.APPROVED` 回调里直接 capture」的原因：回调处理在数据库事务中，事务内做远端写操作违反现有处理顺序（验签 → 去重 → 事务 → 异步副作用）。10 分钟一轮的扫描已经满足需求，也少一条队列路径。

各时间阈值（72h、3h）作为常量集中定义。Sandbox 验收时要确认未批准订单的实际过期行为，如有差异再调整。

### D5 单一 provider 时隐藏选择器

账单页的「Payment method」下拉只在可用 provider 多于 1 个时渲染，否则直接用唯一可用的 provider。解锁卡已经按积分包携带 provider，不需要改。

### D6 live 环境积分包激活

`catalog.ts` 新增 `activateCreditPackMappings(db, provider: 'paypal')`。它只在数据库内操作，不构造 PayPal transport：

- 对当前目录中每个 `credit_pack` 计划的 PayPal 价格：把 `providerPriceId` 设为确定值 `paypal:credit_pack:{priceId}`，`active` 取 `plan.active`。规则与 `syncPlan` 一致，复用同一个导出的 `creditPackId`。
- 不在当前目录元组中的旧 PayPal 积分包价格设为 inactive，映射保留。这样价格调整后旧价格不会继续售卖。
- 订阅类计划一律跳过。重复执行时如实报告 0 处变更。

新增 CLI `packages/billing/scripts/activate-credit-packs.ts`，根脚本命名为 `billing:activate-packs`：

- 连接方式与 seed 相同，由进程环境显式注入目标库 URL；
- 要求 `BILLING_ACTIVATE_CONFIRM=<数据库名>` 与目标库名一致，防止误连；
- 输出变更条数，不输出连接串。

`billing:sync` 保持只允许 test，不放宽。

### D7 生产配置与检查器

- `apps/web/wrangler.jsonc` 与 `apps/jobs/wrangler.jsonc` 的 production `vars` 增加 `"PAYMENT_MODE": "live"`，并替换相关注释。
- 合并到 main 不等于上线，生产仍由版本 tag 加审批触发。runbook 规定的顺序是：先写入 secrets，再发布带 live 的版本。如果只有 live 模式而没有凭据，provider 不可用，定价页会降级为「即将开放」，不会出错。
- `scripts/staging/check-secrets.mjs` 的 `getSecretRequirements()` 已按 provider 派生必需项。新增 `--env production` 参数，或在 `scripts/production/` 中复用同一派生函数，用于检查生产 web 和 jobs 的 secret 名称。`check-wrangler-envs.mjs` 增加断言：production 的 `PAYMENT_MODE` 必须为 `live`。
- `template.config.ts` 中 `providers: ['paypal']`。
- `smoke.spec.ts` / `billing-actions-helper.ts` 原本写死 `selectOption('stripe')` 并 POST Stripe 模拟回调。按 D5 选择器消失后，改为直接点击购买，回调夹具改为 PayPal 的离线模拟。本地 e2e 使用的模拟 provider 机制保持不变，具体以现有 helper 为准。

### D8 法律文本

修改 `apps/web/content/legal/en/` 下的文件：

- `terms.mdx`：付款处理方改为 PayPal。
- `privacy.mdx`：付款段落改为 PayPal（付款信息直接提交给 PayPal，本站只保存交易记录）；第三方表格把 Stripe 行换成 PayPal，标注处理目的与数据类别，并更新日期。
- `refund.mdx`：核对表述，退款原路退回 PayPal。

PR 中注明「需人工审阅」。

## Risks / Trade-offs

- **小额手续费过高**：$0.99 档的手续费占比可能超过 30%。由用户核实费率后调整价格。代码按目录读取价格，换价只需要改目录加 seed，再执行 activate-packs。
- **自动 capture 被重复触发**（刷新、多标签页）：PayPal-Request-Id 幂等键加上 `purchase.status='paid'` 的短路检查已经覆盖；客户端另用 ref 防止重复调用。
- **补 capture 在买家仍停留在 PayPal 页面时发生**：只对 `APPROVED` 状态 capture，买家此时已经确认付款，结果与返回页 capture 一致。
- **生产先切 live、后写 secrets 之间的窗口**：provider 不可用，定价页降级为「即将开放」，不影响其他功能。runbook 要求先写 secrets。
- **CN 账号收款受限或业务类目被审查**：属于外部风险，上线前由用户确认；上线后观察争议与冻结。
- **积分买到但无法使用**：生产付款与 D1 模型、DeepSeek key、详批开关必须同一窗口完成，见上线任务。

## Migration Plan

1. 依次合并代码 PR（对生产无影响）。
2. staging：
   1. 用户创建 Sandbox App 和 webhook；
   2. 写入 staging 的 web 和 jobs secrets；
   3. 执行 `billing:seed`；
   4. 执行 `BILLING_SYNC_MODE=test billing:sync` 激活 PayPal 积分包；
   5. 发布并完成验收。
3. 生产：
   1. 用户创建 Live App 和 webhook；
   2. 写入 web 和 jobs secrets，通过检查器；
   3. 打 tag，经审批发布；
   4. 执行 `billing:activate-packs`；
   5. 在后台完成详批模型与开关配置；
   6. 两站各做一笔真实购买，再退款。
4. 回滚：
   - 暂停售卖：执行 `UPDATE plan_price SET active=false WHERE provider='paypal'`（运维 SQL，runbook 记录），或删除 PayPal secrets。provider 不可用后，定价页自动显示「即将开放」。
   - 已入账的付款和积分不回滚，按退款流程处理。

## Open Questions

- 积分包最终价格与档位，由用户核实费率后决定。确定后需要：
  1. 修改 `EXAMPLE_CATALOG`；
  2. 同步定价页文案和解锁卡展示；
  3. 在 staging 与生产重新 seed，再执行 activate-packs。
- PayPal 未批准订单的实际过期时间，在 Sandbox 验收时确认，并据此调整 D4 的阈值。
