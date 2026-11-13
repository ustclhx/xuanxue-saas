# Design

## Context

动机见 proposal.md。以下是本 change 涉及的现状：

**数据模型**
- `plan_price` 按 (plan, provider, interval, amount, currency) 建模，金额是整数最小单位，并有 `currency` 列。
- 但是种子 `catalog.ts`、激活脚本 `activateCreditPackMappings`、`tuple()` 都写死 `currency='USD'`。

**USD-only 硬限制**
- `packages/billing/src/events/shared.ts` 的 `money()` 遇到非 USD 抛出 `BILLING_CURRENCY_MISMATCH`，属于不可重试错误，回调返回 200 并告警。
- `services.ts` 的 `priceFor` 要求 USD。
- `pricing-read.ts` 中，只有 USD 价格的 `available` 为 true。
- `paypal/money.ts` 只支持 USD。

**Stripe**
- Checkout 显式关闭 `adaptive_pricing` 与 `managed_payments`。
- 规范价格挂在规范 Product 上，Price 本身不可变，同步时核对金额与币种，不一致即报错。
- 东方站积分包另有按语言的本地化 Product + Price（`stripe/localized.ts`），金额与规范价格相同，通过 `lookup_key` 查找，入账时还原为规范价格 ID。
- 这些本地化价格只有 USD，`currency_options` 未使用。

**展示**
- `features/readings/price.ts` 用 Exchange Rate API 的实时汇率（KV 缓存 1 天），失败时回退到参考值（KRW 1400、TWD 32.5、CNY 6.7），显示「≈ 当地货币」。
- 定价页是预渲染页，价格来自构建期快照 `__PRICING_SNAPSHOT__` 和运行时缓存（≤1 小时），汇率在浏览器中另取。

**下游**
- 退款：`payment_refund`、`refund_request` 以付款币种的最小单位记录，部分退款按比例回收积分，与币种无关。
- `apps/jobs/src/notifications/analytics.ts` 用 `amount / 100` 生成收入，KRW 会出错。
- `metrics_daily.mrr_by_currency` 已经按币种分开统计。

**外部与配置**
- Stripe 账户公开描述写着「只收美元（已关闭 Adaptive Pricing）」（`docs/runbooks/stripe-launch.md` §4）。
- 未启用 Stripe Tax。
- 收款主体是 Lucinum LLC（美国），Stripe 结算币种为 USD。

## Goals / Non-Goals

**Goals:**
- 东方站 zh-Hant、ko 用户看到的价格就是扣款金额，交易以 TWD/KRW 完成（ko 的 PayPal 除外）。
- 一份价目表同时驱动种子、平台价格同步和页面展示，调价流程可审计。
- 所有账务路径（入账、退款、对账、通知、分析、后台展示）都能正确处理零小数币种。
- 本地价格未就绪时自动退回 USD，部署顺序安全。

**Non-Goals:**
- 不按 IP 或买家所在地选择币种，不启用 Stripe Adaptive Pricing。
- 不接实时汇率，也不做自动调价。
- 不启用 Stripe Tax，不自动开立台湾电子发票（见 Open Questions）。
- 西方站（en）不变，仍为 USD。
- 不支持 CNY 实际结算。
- 不新增数据库表或列。

## Decisions

### D1 每个币种一个独立价格对象，不使用 `currency_options`

在 `plan_price` 中为每个 (plan, provider, interval, currency) 建一行，每行映射到平台上一个独立的 Price（Stripe）或独立的金额（PayPal 一次性订单不需要预建价格）。

不选 `currency_options` 的理由：
1. 入账校验要求付款金额和币种等于本地价格行（`events/payments.ts` 与 `conflictPayment` 都做精确比对）。如果用多币种 Price，就需要在本地另建一层「Stripe 价格 + 币种 → 金额」的映射，等于把独立价格行重新做一遍。
2. `currency_options` 可以在已有 Price 上修改。这打破了现有的「平台价格不可变、同步只核对」的不变式，调价无法留下新旧对象的审计轨迹。
3. 本地化商品名已经按语言拆成独立 Product。TWD 只服务 zh-Hant，KRW 只服务 ko，直接把 TWD Price 挂在 `zh_hant` 本地化 Product 上、KRW Price 挂在 `ko` 本地化 Product 上即可，不需要再经过 `lookup_key` 间接查找。
4. 订阅续费沿用订阅创建时的 Price 及其币种，独立 Price 的语义最清楚。

代价是 Stripe 中的 Price 对象数量增加，但对象由脚本按价目表幂等创建，可以接受。

USD 行保持现状：规范 Product + zh-Hans/ko 本地化 lookup。ko 的 USD 本地化价格只在回退时使用。

### D2 价目表是项目自有代码文件

在 `packages/billing/src/price-table.ts`（项目自有，不在模板文件中）中定义：
- `FX_SNAPSHOT = { date, perUsd: { TWD, KRW, CNY } }`；
- 取整规则；
- `PRICE_TABLE[planKey][interval][currency] = 最小单位金额`。

计算出的金额直接写成字面量，不在运行时换算。单元测试断言字面量与「快照 × 规则」一致，并在偏差过大时提醒更新。

`EXAMPLE_CATALOG.prices` 改为从价目表展开出多币种价格。草案（汇率与尾数待使用者确认，见 Open Questions）：

| 套餐 | USD | TWD（@32.5，取整到元） | KRW（@1400，取整到百） | CNY 参考（@6.7） |
|---|---|---|---|---|
| reading_single 100 积分 | 199 | NT$65（6500） | ₩2,800（2800） | ¥13 |
| reading_five 500 积分 | 699 | NT$227（22700） | ₩9,800（9800） | ¥47 |
| 订阅 400/月（B change） | 499 | NT$162（16200） | ₩7,000（7000） | ¥33 |
| 订阅 1000/月（B change） | 999 | NT$325（32500） | ₩14,000（14000） | ¥67 |

CNY 只用于展示，不建 `plan_price` 行。zh-Hans 的参考价也改用这份固定汇率：使用者已定「不用实时汇率」，并且这样可以去掉 Exchange Rate API 请求和署名组件，定价页也不必再在浏览器中拉取汇率。

不选「后台可编辑价格」，原因有三：现有后台套餐页只管理模型授权；价格对象在平台侧不可变，改价必然伴随同步脚本；代码化的价目表经过 PR 评审，便于审计。

### D3 币种规则集中在一个模块

在 `packages/billing/src/currency.ts` 中集中定义：
- `ENABLED_CURRENCIES = ['USD','TWD','KRW']`；
- 每个币种的指数（Stripe 视角：USD 2、TWD 2、KRW 0）；
- 平台约束：TWD 在 Stripe 中必须是 100 的倍数，PayPal 的 TWD 为整数元；
- `toMajor` / `toMinor` / `formatMoney(amount, currency, locale)`；
- `currencyFor(locale, provider)`。

各处的使用方式：
- `money(amount, currency, expected?)` 改为校验币种属于启用集合，再由调用方比对价格行的币种；
- `paypal/money.ts` 的 `toPayPalDecimal` 按指数输出，TWD 输出无小数字符串；
- jobs 的分析收入、运营通知、后台显示统一使用 `formatMoney` 或 `toMajor`。

指数表以平台约定为准，不依赖 `Intl.NumberFormat().resolvedOptions()`（Intl 给 TWD 的指数是 2，与 Stripe 一致，但 PayPal 的 TWD 不能有小数），用单元测试锁定。

### D4 结账时服务端选价

`checkoutCustomer` 收到的 `planPriceId` 只用来确定 (plan, interval)。服务端随后：
1. 按 `presentation.locale`（已由服务端按 returnTo 语言生成）和 provider 计算目标币种；
2. 选出 active、已同步、币种匹配的价格行，找不到时回退到 USD 行；
3. 把实际所选行的 ID 写入 Checkout metadata 和 `purchase`。

在这条路径中：
- 客户端无法指定币种；
- 回调用 metadata 中的 `planPriceId` 定位价格行，金额与币种精确比对的逻辑不变；
- 本地化 USD 价格仍经 `checkoutPrice` 的 lookup 还原为规范价格 ID。TWD/KRW 行本身就是本地化商品上的价格，不需要还原。

### D5 页面展示与结账使用同一选价函数

`pricing-read.ts` 去掉 `available` 中的 USD 条件，快照包含全部币种的价格行。定价页、解锁卡、账单页的积分包区和订阅区都调用同一个 `selectDisplayPrice(prices, locale, provider)`（与 D4 共用逻辑），其中 provider 取 `billing.providers` 中第一个可用的平台。

ko 用户的情况：Stripe 显示 KRW 主价；选择 PayPal 时，在支付方式旁注明「PayPal 以美元 US$1.99 结算」。

缓存行为不变：构建期快照 + ≤1 小时运行时缓存，读库失败时降级为快照。去掉浏览器端的汇率请求后，定价页不再有额外的网络依赖。

### D6 订单、付款与退款按原币种记录

不改 schema。`purchase.amount/currency`、`payment.amount/currency`、`payment_refund` 与 `refund_request.requested/approved_amount` 都以原付款币种的最小单位记录。

后台退款审批的输入框按币种显示单位（TWD、KRW 只接受整数元），提交前用 `toMinor` 转换。服务端校验金额是 TWD 的 100 倍数、不超过可退余额。部分退款保留积分的比例公式与币种无关，保持不变。

后台付款、购买、退款列表按各行的币种格式化；`metrics` 的收入继续按币种分开显示，不做汇率折算合计。若需要折算，以价目表快照估算并标注为估算，见 Open Questions。

### D7 Stripe 客户与订阅的币种约束

`billing_customer` 按 (workspace, provider) 复用同一个 Stripe Customer。Stripe 不允许一个 Customer 同时有不同币种的有效订阅、待开发票项或客户余额（一次性 Checkout payment 不受影响）。为此：
- 换套餐（`changePlan`）MUST 选择与当前订阅同币种的目标价格，而不是按当前界面语言选；
- 用户切换语言后新建订阅，如果与现有续费订阅币种不同，按现有「先周期末取消旧订阅再结账」的流程处理，并在 staging 实测 Stripe 是否接受。
- 如果 Stripe 拒绝，回退为沿用旧订阅的币种。此项留给 B change 的订阅验收覆盖。

### D8 部署顺序保证安全

1. 先部署币种感知的 web 与 jobs（`money()` 接受 TWD/KRW）。
2. 再执行种子，新增的本地价格行为 `unsynced` 且 inactive，此时页面与结账仍是 USD。
3. 最后同步并激活本地价格。

回滚只需停用本地价格行，选价函数自动回退 USD，已入账的 TWD/KRW 付款仍能被新代码处理退款。如果回滚代码到 USD-only 版本，已有 TWD/KRW 付款的退款回调会被判为币种错误，因此回滚代码前须确认没有待处理的本地币种退款，或保留 D3 的校验改动。

## Risks / Trade-offs

- **[Stripe 结算换汇费]** TWD/KRW 收入在结算到 USD 时会被收取货币转换费，美国账户约 1–2%，可能挤压毛利。→ 价目表取整时可略向上取；运营在 Open Questions 中确认可接受。
- **[税务]** 税务义务取决于买家所在地，与结算币种无关。但以本地币种标价会让「价格是否含税」更显眼。→ 文案写「价格以结账页为准」，税务登记由运营决定（Open Questions）。
- **[业务描述不一致]** Stripe 业务描述写着「只收美元」，开启多币种后需要更新，可能触发复审。→ 列为外部动作，在 live 激活前完成。
- **[汇率漂移]** 固定价格长期偏离市场汇率。→ 价目表记录快照日期，单元测试在快照超过 180 天时给出提醒（只告警，不失败）。是否季度复核由运营决定。
- **[模板同步冲突]** `money()`、`priceFor`、`pricing-read.ts`、`paypal/money.ts` 都是模板文件，改动会增加后续 template-sync 的冲突。→ 通用部分（D3 币种模块、多币种选价、币种感知校验）建议上交模板（Open Questions）。项目自有部分（价目表、语言→币种映射）放在项目文件中。
- **[PayPal TWD]** PayPal 账户可能未开通 TWD 收款，或会自动换汇。→ 先在 Sandbox 验证；live 激活前确认账户设置。未确认前 PayPal 仍用 USD，`currencyFor` 由一个开关控制。
- **[Customer 币种冲突]** 见 D7。

## Migration Plan

1. 合并代码（组 2–4）。staging 自动发布，此时本地价格行不存在或为 inactive，行为与现状一致。
2. 在 staging 执行 `billing:seed`，再执行 `BILLING_SYNC_MODE=test pnpm billing:sync`，在沙盒中创建 TWD/KRW Price 并激活（沙盒写操作需使用者批准，见 tasks）。
3. staging 端到端验收：四种语言 × 两个平台的购买，加上 TWD 部分退款与 KRW 全额退款。
4. live：先运行 `billing:sync-stripe-live` 的演练，批准后再写入，最后激活。PayPal TWD 在确认后单独激活。
5. 回滚：后台或脚本停用 TWD/KRW 价格行，选价自动回到 USD，无需迁移。

## Open Questions

1. **价目表数值**：汇率快照（TWD 32.5、KRW 1400、CNY 6.7 沿用现有参考值）与尾数策略（直接取整，还是使用 NT$69 / ₩2,900 这类心理定价）需要使用者确认。实现时以确认后的数值写入字面量，不影响结构。
2. **PayPal 是否对 zh-Hant 收 TWD**：使用者只明确了 ko 的 PayPal 仍用 USD。本设计默认 zh-Hant 的 PayPal 也收 TWD，但由开关控制，待使用者确认并核对 PayPal 账户的币种设置后再开启。
3. **税务**：台湾的境外电商（年销售额超过 NT$48 万需登记，税率 5%，开立电子发票）与韩国的境外电子劳务简易登记（税率 10%）如何处理、价格是否含税，由运营或会计确认。本 change 只做到「标价即结账价」。
4. **结算换汇费**是否接受。另外后台收入是否需要按价目表汇率折算成 USD 合计。
5. **通用部分是否先上交模板**：按「template 优先」路线，币种模块与多币种选价可以作为模板需求实现后再同步到本项目。若决定上交，组 2 改由模板完成，本项目只做组 3 之后的部分。
6. **汇率复核频率**：例如每季度复核一次，偏差超过 10% 时调价。
