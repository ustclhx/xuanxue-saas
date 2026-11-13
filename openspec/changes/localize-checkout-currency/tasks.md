# Tasks

> **执行约定**
> - **负责人标注**：
>   - 【Claude】复杂开发与评审；
>   - 【Codex】简单改动与浏览器核对；
>   - 【用户】决策与批准；
>   - 【协调者】合并顺序与外部动作的执行安排。
> - **Worktree 拆分**：W1（组 2）→ W2（组 3）与 W3（组 4）在 W1 合并后并行 → W4（组 5）在 W1 合并后即可开始，与 W2/W3 并行，最终以 W2 的快照数据联调。每个 worktree 开一个 PR。
> - **共享文件冲突点**：
>   - `packages/billing/src/catalog.ts`：W2 与 `enable-subscriptions-daily-credits` 的组 2 会同时修改，后合并者 rebase，以价目表为准；
>   - `apps/web/src/features/marketing/pricing-page.tsx`：W4 与 B change 的定价页改版冲突，建议 B 的定价页改版在 W4 之后进行，或由同一 worktree 完成；
>   - `apps/web/messages/<locale>/pricing.json`、`billing.json`：按 key 追加，不改已有 key；
>   - `docs/05-billing.md`：按小节追加。
> - **无数据库迁移**。验收证据写入 `EVIDENCE_DIR`（仓库外）。外部动作（沙盒/live 价格创建、PayPal 设置、Stripe 业务描述）单列，需使用者批准，不在 PR 中预先勾选。

## 1. 决策与外部准备（不改代码）

- [x] 1.1 【用户】确认 design Open Questions 1、2、5：价目表数值、zh-Hant 的 PayPal 是否收 TWD、通用部分是否先上交模板。验证：决定记录在 design.md 的 Open Questions 下方；如果第 5 项选择上交模板，组 2 改为同步模板版本
- [ ] 1.2 【用户 / 运营】确认 Open Questions 3、4（税务口径、换汇费），并按 `docs/runbooks/stripe-launch.md` §4 更新 Stripe 业务描述中「只收美元」的表述。验证：运营书面确认；Stripe 后台描述已更新（截图存在仓库外）
- [x] 1.3 ~~作废（决策 2：PayPal 恒为 USD）~~ 【用户】如果 1.1 决定 PayPal 收 TWD，在 PayPal live 与 Sandbox 账户确认 TWD 的收款设置（接收后保留余额，或自动换汇）。验证：账户设置截图存在仓库外

## 2. W1 币种基础（packages/billing）

- [ ] 2.1 【Claude】新增 `packages/billing/src/currency.ts`：启用币种集合、币种指数、平台约束（Stripe 的 TWD 金额为 100 的倍数，PayPal 的 TWD 为整数）、`toMajor`/`toMinor`/`formatMoney`/`currencyFor(locale, provider)`，PayPal 恒为 USD（决策 2）。验证：单测覆盖四种语言 × 两个平台的映射、KRW/TWD/USD 的格式化（`NT$65`、`₩2,800`、`US$1.99`）以及非法 TWD 金额
- [ ] 2.2 【Claude】`events/shared.ts` 的 `money()` 改为接受启用的币种。`events/payments.ts`、`conflictPayment`、`events/refunds.ts`、`events/target.ts` 中「付款币种与价格行币种必须一致」的比对保持不变，不一致时仍抛出不可重试的 `BILLING_CURRENCY_MISMATCH`。验证：billing 单测与 postgres 集成测试覆盖 TWD/KRW 付款入账、关联 TWD 价格但以 USD 付款时被拒、KRW 部分退款按比例回收；已有 USD 录制夹具测试全部通过
- [ ] 2.3 【Claude】`services.ts` 的 `priceFor` 去掉 USD 条件，改为要求币种属于启用集合。`refunds.ts` 的退款金额校验按币种约束执行。验证：服务层测试覆盖 TWD 退款金额不是 100 的倍数时拒绝
- [x] 2.4 ~~作废（决策 2：PayPal 恒为 USD）~~ 【Claude】`paypal/money.ts` 支持 TWD（整数元字符串），KRW 仍抛错。验证：单测断言 TWD 6500 输出为 `"65"`，`"65"` 解析回 6500，KRW 抛错
- [ ] 2.5 【Claude】在 `docs/05-billing.md` §1 中把币种段落改写为多币种规则，并链接到本 change。验证：文档 diff 由评审确认，`pnpm check` 通过

## 3. W2 价目表、种子与价格同步（依赖 W1）

- [ ] 3.1 【Claude】新增 `packages/billing/src/price-table.ts`（项目自有），包含汇率快照、取整规则和价目字面量。积分包两档填入 1.1 确认的数值，订阅档位预留给 B change。验证：单测断言字面量与「快照 × 规则」一致、TWD 金额为 100 的倍数，快照超过 180 天时给出警告
- [ ] 3.2 【Claude】`catalog.ts` 的 `EXAMPLE_CATALOG.prices` 从价目表展开出多币种价格；`tuple()`、`seedCatalog`、`activateCreditPackMappings` 都按币种处理，PayPal 只激活 `currencyFor` 允许的币种。验证：catalog 的 postgres 测试中，重跑种子是幂等的，不会生成重复行；USD 旧行不变；新的 TWD/KRW 行为 `unsynced` 且 inactive
- [ ] 3.3 【Claude】Stripe 同步（`stripe/operations.ts` 中的 `syncCanonicalPrice`、`syncLocalizedPackPrices`，脚本 `sync.ts`、`sync-stripe-live.ts`）：TWD Price 建在 `zh_hant` 本地化 Product 上，KRW Price 建在 `ko` 本地化 Product 上，`metadata` 写入 `planPriceId` 与 `currency`，并把 Price ID 写回对应的 `plan_price` 行；已存在的 Price 只做核对。验证：operations 单测（使用 mock Stripe）覆盖首次创建、重跑幂等、金额不一致时报错；live 演练模式（不设 `BILLING_SYNC_CONFIRM`）只列出将要创建的 TWD/KRW 价格，不调用 Stripe
- [ ] 3.4 【Codex】在 `docs/runbooks/stripe-launch.md` 中补充多币种价格的创建、演练、写入与停用步骤，并更新 §4 中「只收美元」的说明。验证：按文档在本地库运行演练命令，输出与文档一致

## 4. W3 结账选价（依赖 W1；与 W2 并行，联调时需要 W2 的数据）

- [ ] 4.1 【Claude】`createCheckout` 的服务路径中，由 `planPriceId` 推出 (plan, interval)，再按 `presentation.locale` 与 provider 选出价格行（找不到时回退 USD），实际所选行写入 metadata 与 `purchase`。验证：`customer.functions` / services 测试覆盖 zh-Hant 选 TWD、ko 走 Stripe 选 KRW、ko 走 PayPal 选 USD、TWD 行 inactive 时回退 USD、客户端传 USD 价格 ID 时仍选 TWD
- [ ] 4.2 【Claude】`stripe/operations.ts` 的 `checkoutPrice`：TWD/KRW 行直接使用自身的 Price，USD 行保持现有的本地化 lookup 回退。保留 `adaptive_pricing: { enabled: false }`。验证：operations 单测断言 TWD 结账的 `line_items` 使用 TWD Price，并且不调用 `prices.list`
- [ ] 4.3 【Claude】`changePlan` 的目标价格按当前订阅的币种选择，不按界面语言选（design D7）。验证：单测覆盖 TWD 订阅换档时选出 TWD 目标价格；同币种价格缺失时返回明确错误
- [x] 4.4 ~~作废（决策 2：PayPal 恒为 USD）~~ 【Claude】PayPal 一次性订单在开关开启时以 TWD 创建，`amount.breakdown` 一并按整数输出。验证：PayPal operations 单测断言请求体的 `currency_code`=`TWD`、`value`=`"65"`

## 5. W4 展示与下游（依赖 W1；联调需要 W2）

- [ ] 5.1 【Claude】`pricing-read.ts` 的 `available` 去掉 USD 条件；新增 `selectDisplayPrice(prices, locale, provider)`，与 4.1 共用选价逻辑。验证：pricing-data 测试覆盖四种语言的展示币种，以及本地价格缺失时显示 USD
- [ ] 5.2 【Claude】`features/readings/price.ts`：解锁卡与定价页改为显示所选币种的实价，zh-Hans 显示 USD 与固定汇率的 CNY 参考价（「约 ¥13（参考价，以美元结算）」）；删除 `localRates` / `getLocalRates`、Exchange Rate API 调用与 `FxAttribution`。验证：`readings-ui.test.ts`、`pricing-page.test.tsx` 断言 zh-Hant 显示 `NT$65` 且无「≈」、ko 显示 `₩2,800`、zh-Hans 显示参考价；`grep exchangerate` 无结果
- [ ] 5.3 【Codex】zh-Hant 与 ko 用户在支付方式选择处，如果选 PayPal，提示「PayPal 以美元结算」及 USD 金额；四种语言的文案追加到 `messages/<locale>/billing.json`。验证：组件测试覆盖 ko + PayPal 的提示；其他语言不出现该提示
- [ ] 5.4 【Codex】账单页与后台的付款、购买、退款、指标列表用 `formatMoney` 按行的币种格式化；后台退款审批的输入按币种单位换算，TWD/KRW 只接受整数。验证：`admin-display`、`refund-section` 测试覆盖 KRW、TWD 的显示与输入换算
- [ ] 5.5 【Codex】`apps/jobs/src/notifications/analytics.ts` 的收入金额与 `operations.ts` 的运营通知金额改用 `toMajor`。验证：analytics 测试断言 KRW 2800 输出为 `"2800"`、TWD 6500 输出为 `"65.00"`
- [ ] 5.6 【Claude 起草 → 用户确认】在定价页 FAQ 与退款政策中补充「以结账页显示的币种与金额为准、退款按原币种退回」，四种语言。验证：文案经用户确认；`legal-pages.test.ts` 与 `faq.test.tsx` 通过

## 6. Staging 验收（全部 PR 合并后）

- [ ] 6.1 【用户批准 → Codex】在 staging 执行 `billing:seed` 与 `BILLING_SYNC_MODE=test pnpm billing:sync`，在 `xuanxue-staging` 沙盒中创建 TWD/KRW Price 并激活。执行前列出将要创建的对象清单，获批后再执行。验证：在沙盒中核对 Price 的币种与金额；staging 库中的新行为 active
- [ ] 6.2 【Codex】staging 端到端：zh-Hant 用 Stripe 购买（TWD）、ko 用 Stripe 购买（KRW）、ko 用 PayPal 购买（USD，需 staging 配置了 PayPal 凭据，否则记为未验收）、zh-Hans 购买（USD）、en 购买（USD）；对 TWD 付款做部分退款，对 KRW 付款做全额退款。验证：每笔的 Checkout 币种、`payment` 行、积分批次、退款回收、后台显示、对账差额为 0，证据写入 `EVIDENCE_DIR`
- [ ] 6.3 【Codex】停用 TWD 价格后，确认 zh-Hant 的定价页与结账都回到 USD，然后恢复。验证：截图与 Checkout 币种记录

## 7. 生产上线（需使用者逐项批准）

- [ ] 7.1 【用户批准 → 协调者】执行 live 演练，`pnpm billing:sync-stripe-live` 不带确认参数。验证：输出的待创建清单经使用者确认
- [ ] 7.2 【用户批准 → 协调者】带确认参数写入 live 价格并激活，然后在两站各做一笔 TWD、KRW 的真实小额购买并退款。验证：Stripe 后台、生产后台与积分回收一致；主分支的发布流水线成功
- [x] 7.3 ~~作废（决策 2：PayPal 恒为 USD）~~ 【用户批准】如果 1.1 与 1.3 都通过，打开 PayPal 的 TWD 开关，并在 live 环境做一笔真实购买与退款。验证：PayPal 交易币种为 TWD，入账一致
