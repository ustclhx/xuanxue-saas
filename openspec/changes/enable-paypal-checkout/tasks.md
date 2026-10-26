# Tasks

> 并行分组：A（Claude，PayPal 后端）、B（Claude，回跳页与账单页 UI）、C（Codex，配置、脚本与 e2e）、D（Claude，法律与文档）四组可同时在各自的 worktree 开发。
> B 按 design D2 的错误契约（`BILLING_PAYMENT_DECLINED` + `retryUrl`）编码，联调在 A 合并后完成。
> E、F 是验收与上线，依赖 A–D 合并和用户提供的外部账号，不提前勾选。
>
> **全局复用约束**：模板的 PayPal 实现是唯一实现，只能扩展，MUST NOT 另写一份。
> - 禁止新建第二个 PayPal HTTP 客户端、OAuth 获取逻辑、capture 调用或 webhook 验签。PayPal 请求一律经 `createPayPalTransport`（`paypal/transport.ts`）与 `createPaymentRuntime`（`runtime.ts`）构造的 provider 发出。
> - 回调入账、去重、退款、对账（`events.ts`、`pipeline.ts`、`refunds.ts`、`paypal/webhooks.ts`、`paypal/snapshots.ts` 的映射规则）不改语义。
> - 改动需要新的公共函数时，从现有模块导出，不复制代码。

## 1. A：PayPal 后端（`packages/billing`、`apps/web/src/features/billing/customer.functions.ts`、`apps/jobs/src/billing.ts`）

> 复用约束：
> - 1.1 在 `paypal/operations.ts` 现有 `createCheckout` 的 Orders v2 请求体上增加字段。站点解析复用 `apps/web/src/features/site/site.ts` 的 `resolveSite` / `requestSiteOrigin`，回跳语言复用 `safeReturnPath`。
> - 1.2 扩展现有 `PayPalHttpError` 与 `confirmCheckout`（operations），不另建错误通道。
> - 1.3 的 capture 必须走 provider 现有的 `confirmCheckout` 和幂等键 `capture:${purchase.id}`。订单状态用 provider 现有的 `getOrder`（`paypal/snapshots.ts`）读取。它目前把 APPROVED 合并为 `pending`，需要区分时在 `OrderSnapshot` 上扩展字段，不另发 GET 请求。定时入口加到 `apps/jobs/src/billing.ts` 现有 `BILLING_RETRY_CRON` 的 jobs 列表，与 `runPendingCompensations` 并列。
> - `paypal:credit_pack:` 前缀的收敛由 C 组 3.2 负责，本组不改动这部分，避免冲突。

- [ ] 1.1 `CheckoutInput` 增加可选 `presentation`（品牌、语言、商品说明），PayPal 订单写入 `brand_name`、`locale`（en-US/zh-TW/zh-CN/ko-KR）、`description` 和一项 `DIGITAL_GOODS` items（含 `item_total` breakdown）；`customer.functions.ts` 按请求站点和 `returnTo` 语言在服务端生成 presentation，不使用客户端文本。验证：operations 单测断言两站和四种语言的请求体，并断言超长截断；Stripe 请求体不变
- [ ] 1.2 capture 拒付恢复：`PayPalHttpError` 只解析 issue 名称（不携带响应正文）；`INSTRUMENT_DECLINED` 转为带 `retryUrl`（按环境拼接 checkoutnow 链接）的 `BILLING_PAYMENT_DECLINED`；`safe()` 只对该错误码返回 `retryUrl`。验证：单测覆盖 422 拒付、其他 4xx/5xx 仍为 `BILLING_UNAVAILABLE`，日志与返回值都不含 PayPal 响应正文
- [ ] 1.3 拆出不依赖用户身份的 `capturePurchase`，新增 `runPendingCaptures` 并挂到 jobs 的 `BILLING_RETRY_CRON`：处理 72h 内、超过 10 分钟的 pending PayPal 购买，每轮上限 50；APPROVED 用同一幂等键 capture，COMPLETED 跳过，VOIDED/404/超时则条件更新为 failed。验证：隔离 PostgreSQL 集成测试覆盖 APPROVED capture、与返回页并发时只有一个幂等键、已 paid 不被覆盖、超时标记 failed、上限分批；jobs 单测断言注册到 retry cron

## 2. B：回跳页与账单页 UI（`apps/web/src/routes/app/$slug/billing-return.tsx`、`billing.tsx`、`apps/web/messages/*/billing.json`）

> 复用约束：保留回跳页现有的 `needsConfirm`、`returnHref` 与 `safeReturnPath` 逻辑，只把按钮触发改为挂载后自动触发。capture 仍调用现有 Server Function `confirmCustomerCheckout`，不新增接口。成功后交给解锁卡现有的 `checkout=success` 轮询与自动生成（`unlock-card.tsx`），不在回跳页重复实现生成或轮询。文案使用现有 paraglide `m.*` 机制。

- [ ] 2.1 回跳页挂载后自动 capture，用 ref 防重复调用；成功后 `location.replace` 回到 `returnTo?checkout=success`（无 `returnTo` 时进入账单页）；收到 `BILLING_PAYMENT_DECLINED` 时跳转 `retryUrl`；其他错误显示重试按钮；取消路径保持直接重定向。验证：`billing-pages.spec.ts` 改为断言无确认按钮、自动调用一次、成功跳转、拒付跳转、错误可重试、订阅回跳不触发 capture
- [ ] 2.2 回跳页文案新增 `messages/<locale>/billing.json`（en、zh-Hant、zh-Hans、ko），语言优先取 `returnTo` 的语言前缀。验证：e2e 以 `/ko/...` 的 `returnTo` 打开回跳页，显示韩语；`pnpm typecheck` 生成文案无缺项
- [ ] 2.3 账单页只有一个可用 provider 时不渲染支付方式下拉，直接用该 provider 结账。验证：组件或 e2e 覆盖单一 provider 与多个 provider 两种情况
- [ ] 2.4 （A 合并后）rebase 并联调：解锁卡 → 回跳页 → 自动生成的本地完整流程（使用本地 PayPal 模拟）。验证：本地 e2e 解锁流程通过

## 3. C：配置、脚本与 e2e（Codex）

> 复用约束：
> - 3.2 的映射值必须调用 PayPal 模块导出的积分包映射函数，不手写 `paypal:credit_pack:` 字符串。由本组把 `operations.ts` 的 `creditPackId` 移到 `paypal/metadata.ts` 并导出，`operations.ts` 与 `snapshots.ts` 两处改为调用它。目录元组的查询复用 `catalog.ts` 现有的 `EXAMPLE_CATALOG` 与 `tuple()`。CLI 的数据库连接写法沿用 `packages/billing/scripts/seed.ts`。
> - 3.3 生产 secret 检查复用 `scripts/staging/check-secrets.mjs` 的 `getSecretRequirements()`，不另写一份 provider→变量名的映射。
> - 3.1 的 e2e 沿用 `apps/web/e2e/billing-actions-helper.ts` 现有的序列化与 actor 工具，以及 `billing-pages.spec.ts` 的 PayPal 回跳用例写法。

- [x] 3.1 `template.config.ts` 改为 `providers: ['paypal']`；`smoke.spec.ts`、`billing-actions-helper.ts` 及其他写死 Stripe 的本地 e2e 改为不绑定 provider，或改用 PayPal 模拟。验证：`pnpm test` 与本地 e2e（smoke、billing-pages）通过
- [x] 3.2 `catalog.ts` 新增 `activateCreditPackMappings`（只处理 credit_pack，复用 `creditPackId`，旧元组设为 inactive，不构造 transport），并新增 `billing:activate-packs` CLI（显式注入库 URL，`BILLING_ACTIVATE_CONFIRM` 必须与库名一致，不输出连接串）。验证：隔离 PostgreSQL 测试覆盖首次激活、重复执行 0 变更、订阅价格不受影响、调价后旧价格变为 inactive；CLI 测试断言确认不匹配时拒绝执行、全程无网络调用；`billing:sync` 仍拒绝非 test
- [x] 3.3 web 与 jobs 的 production `vars` 设置 `PAYMENT_MODE: "live"` 并更新注释；`check-wrangler-envs.mjs` 断言生产为 live；生产 secret 检查复用按 provider 派生的规则，要求 web 和 jobs 都有 `PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID`，只输出名称。验证：`scripts/production/production.test.mjs` 与 check-secrets 测试覆盖缺项失败、只启用 PayPal 时不要求 Stripe；`wrangler deploy --dry-run --env production` 通过

## 4. D：法律与文档（Claude）

> 复用约束：在 `apps/web/content/legal/en/` 现有页面上修改，保持现有结构与 Basecamp 改写来源说明。文档更新现有 `docs/05-billing.md` 的 PayPal 章节，不另起一份 PayPal 设计文档；新 runbook 只写本站上线步骤，引用 05-billing 的实现说明。

- [ ] 4.1 `terms.mdx`、`privacy.mdx`（付款段落、第三方表格、更新日期）、`refund.mdx` 改为 PayPal 表述，PR 中注明需人工审阅。验证：`pnpm check`（含 content 检查）通过，全站 grep 法律页不再出现 Stripe
- [ ] 4.2 更新 `docs/05-billing.md`（本站启用 PayPal、自动 capture、补 capture、activate-packs）、`docs/v1-decisions.md` D6、`docs/runbooks/production-xuanxue.md`，新增 `docs/runbooks/paypal-launch.md`：Sandbox/Live App 与 webhook 事件清单、secrets 写入顺序、activate-packs、回滚 SQL、验收清单。验证：文档中的命令与脚本名和代码一致，不含任何密钥值

## 5. E：staging Sandbox 验收（依赖 1–4 合并；用户创建 Sandbox App 与 webhook）

- [ ] 5.1 写入 staging web 和 jobs 的 `PAYPAL_*` secrets，执行 `billing:seed` 与 `BILLING_SYNC_MODE=test billing:sync`，发布 staging。验证：check-secrets 通过；定价页与解锁卡显示可购买的 PayPal 积分包
- [ ] 5.2 两站各选一种语言（如 en、ko），用 Sandbox 买家完成解锁 → 付款 → 自动 capture → 回调入账 → 自动生成；另测取消、批准后关闭页面（等待补 capture 入账）、重复回调幂等。验证：证据记录 webhook_event processed、purchase paid、积分只发放一次，以及 PayPal 页面的品牌与语言
- [ ] 5.3 退款申请 → 后台审批 → PayPal 退款 → 积分回收；在启用 PayPal 的配置下删号。验证：对账差额为 0，删号后原密码登录被拒；同时记录未批准订单实际过期行为，必要时回调 D4 阈值

## 6. F：生产上线（依赖 E；用户完成 PayPal Business 认证、Live App 与 webhook、积分包定价决定）

- [ ] 6.1 （decision gate）用户确认积分包价格档位；如有变化，修改目录与定价文案，并在 staging 复验 5.2。验证：定价页、解锁卡与目录一致
- [ ] 6.2 写入生产 web 和 jobs 的 `PAYPAL_*` secrets，通过生产 secret 检查；打 tag 经审批发布；执行 `billing:activate-packs`；同一窗口完成 D1 模型、`DEEPSEEK_API_KEY` 与后台详批开关（launch-v1-production 2.2）。验证：两站 `/api/health` 返回完整 SHA，定价页显示可购买
- [ ] 6.3 两站各完成一笔真实小额购买，并生成一份详批，随后后台退款。验证：webhook processed、积分入账后被回收、PayPal 后台交易显示正确品牌；证据存入 `docs/runbooks/evidence/`，再按条件补跑 `e2e-live`
