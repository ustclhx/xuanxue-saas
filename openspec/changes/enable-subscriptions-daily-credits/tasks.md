# Tasks

> **执行约定**
> - **负责人标注**：
>   - 【Claude】复杂开发、设计敏感项与评审；
>   - 【Codex】简单改动、浏览器核对与部署；
>   - 【用户】决策与批准；
>   - 【协调者】合并顺序与外部动作的执行安排。
> - **Worktree 拆分**：
>   - W1（组 2：目录与价格同步）与 W2（组 3：每日积分）互不依赖，可并行；
>   - W3（组 4：定价页、账单与解锁流程）依赖 1.2 的设计稿确认和 W1 的套餐数据，可以先用种子数据开发；
>   - 法律文案（组 5）可与以上并行。
>   - 每个 worktree 开一个 PR。
> - **与 `localize-checkout-currency`（A）的关系**：
>   - W1 修改 `packages/billing/src/catalog.ts` 与 `price-table.ts`，与 A 的 W2 是同一批文件。建议 A 的 W1/W2 先合并，本 change 的 W1 rebase 后只追加订阅条目；如果 A 尚未开始，W1 先以 USD-only 写入目录，A 再补币种。
>   - W3 的 `pricing-page.tsx` 与 A 的 W4 冲突：A 的 W4 先合并，或者由同一个 worktree 一并完成。
> - **共享文件冲突点**：
>   - `template.config.ts`：W2 只改 `credits.dailyEnabled`；
>   - `apps/web/messages/<locale>/{pricing,billing,daily-credits,billing-coexist}.json`：只追加或补译；
>   - `docs/05-billing.md`：按小节追加。
> - **无数据库迁移**。验收证据写入 `EVIDENCE_DIR`。外部动作单列、需使用者批准，不在 PR 中预先勾选。

## 1. 决策与设计

- [ ] 1.1 【用户】确认 design Open Questions 1–6：套餐名、每日积分有效期、是否结转、额外权益、领取触发点、升级是否补发。验证：决定记录在 design.md；如有变更，同步更新 spec 与本 tasks
- [ ] 1.2 【Claude】用 `ui-design` 技能出定价页改版设计稿（订阅两档 + 积分包 + 每日领取说明 + 可解锁详批 + FAQ；两站主题；四种语言中最长文案的排版），经使用者确认后保存离线副本并登记原型索引。验证：使用者明确确认；原型索引中有该条目
- [ ] 1.3 【用户 / 运营】确认 Open Question 7（续费提醒与自动续费披露），把 Stripe 业务描述从「No subscriptions」改为包含两档月付订阅（参考 `docs/runbooks/stripe-launch.md` §4）。验证：运营书面确认；Stripe 后台描述更新截图存在仓库外

## 2. W1 订阅目录与价格同步

- [ ] 2.1 【Claude】在 `EXAMPLE_CATALOG` 中新增 `plus`（400）与 `premium`（1000）月付订阅（`rollover=false`，sort 30/40），价格只来自价目表的 `month` 条目，只生成 Stripe 价格行，不生成 PayPal 订阅价格行。`pro`/`team` 不动。验证：catalog 的 postgres 测试覆盖：重跑 seed 幂等；新套餐的 Stripe 价格行为 `unsynced` 且 inactive；PayPal 没有订阅价格行；既有积分包行不变
- [ ] 2.2 【Claude】增加「在售订阅套餐的 `features.models` ⊇ free 的 models」检查：激活订阅价格前若不满足即报错，并提供只读诊断输出。验证：单测覆盖缺少模型时拒绝、补齐后通过
- [ ] 2.3 【Claude】`sync-stripe-live.ts` 去掉「只允许积分包」的断言，允许月付订阅价格；`stripe/localized.ts` 的译名表扩展到 `plus`/`premium`（四种语言），本地化订阅 Product 与 Price 的创建复用 A 的同步逻辑（若 A 未合并，则只建规范 Price）。验证：sync 测试覆盖订阅价格的创建与重跑核对；演练模式列出订阅价格且不调用 Stripe
- [ ] 2.4 【Codex】在 `docs/05-billing.md` 的「本站」部分与 `docs/runbooks/stripe-launch.md` §0 中更新「只卖积分包」的边界，补充订阅价格的创建、门户配置与停用步骤。验证：按文档在本地库运行演练命令，输出一致

## 3. W2 每日积分

- [ ] 3.1 【Codex】在 `template.config.ts` 中设置 `credits.dailyEnabled: true`。核对运行时设置默认值（10 / 10 / 有效期按 1.1 的决定 / 要求已验证邮箱）；如果 1.1 修改了有效期，改为在 runbook 中记录后台设置值，不改模板默认值。验证：`pnpm typecheck`；`daily.server.test.ts` 与 credits 测试通过
- [ ] 3.2 【Codex】补齐 `daily-credits.json`、`admin-daily-credits.json` 在 zh-Hant、zh-Hans、ko 中缺失或机翻的文案，内容包括已领取、本月已满、未验证邮箱、跨站共享说明。验证：`pnpm test` 中的文案缺失检查不再列出这些 key；由使用者抽查 ko 文案
- [ ] 3.3 【Claude】为「同一邮箱两站共享额度」补充集成测试：东方站账户领取后，西方站同邮箱账户当日返回已领取，月上限跨站累计。验证：credits 的 postgres 测试新增两个用例并通过
- [ ] 3.4 【Codex】确认 topbar 布局中的 `DailyCreditsNotice` 在两站主题下显示正常（App 区当前使用 topbar）。验证：本地两站截图（四种语言）存在仓库外

## 4. W3 定价页、账单页与解锁流程（依赖 1.2 的设计稿确认）

- [ ] 4.1 【Claude】按确认的设计稿重做 `features/marketing/pricing-page.tsx`：订阅两档（复用 `groupPricingPlans` / `pricingForInterval`，只有月付、无切换）、积分包、每日领取说明（`dailyEnabled` 时显示），保留可解锁详批清单、FAQ、AI 声明、「即将开放」降级与预渲染快照；价格展示调用 A 的 `selectDisplayPrice`（A 未合并时显示 USD）。验证：`pricing-page.test.tsx` 覆盖：订阅未同步时显示「即将开放」无入口；有效时有入口；每日说明随开关显示；预渲染 HTML 不依赖数据库
- [ ] 4.2 【Claude】订阅支付方式按「有有效价格的平台」过滤：定价页、账单页的订阅选择和余额不足弹窗都不显示 PayPal 的订阅选项；直接调用时返回 `BILLING_PRICE_UNAVAILABLE`。验证：`billing-sections` 与 `payment-entrypoints` 测试覆盖只有 Stripe 时的订阅选项，以及积分包仍可选两种平台
- [ ] 4.3 【Claude】解锁卡在积分不足时的购买流程同时提供积分包与订阅档位；订阅首付到账后回到原结果页自动生成（复用现有的 returnTo 与轮询）。验证：`unlock-card.test.tsx` 覆盖积分不足时出现订阅入口；e2e 用例模拟订阅回跳后自动生成
- [ ] 4.4 【Codex】账单页订阅分区的文案补齐四种语言：「新档积分从下个周期开始发放」的升级提示、「本期积分 X 到期」、取消后保留至周期末。结账按钮附近显示「每月自动续费，可随时取消」。验证：组件测试断言四种语言的 key 存在；账单页截图
- [ ] 4.5 【Claude】FAQ 新增问答：订阅积分是否结转、如何取消、取消后怎样、每日领取规则与两站共享额度。验证：`faq.test.tsx` 通过，`/faq` 汇总页包含新问答

## 5. 法律文案（可与组 2–4 并行）

- [ ] 5.1 【Claude 起草 → 用户确认】两站的服务条款与退款政策增加自动续费、随时取消、周期末生效、不按天退款、订阅积分当期有效、退款申请流程等内容（四种语言）。验证：使用者确认文案；`legal-pages.test.ts` 通过

## 6. Staging 验收（组 2–5 合并后）

- [ ] 6.1 【用户批准 → Codex】在 staging 管理后台给 `plus`/`premium` 授予不少于免费档的模型。运行 `billing:seed` 和 `BILLING_SYNC_MODE=test pnpm billing:sync`，在 `xuanxue-staging` 沙盒中创建订阅 Product/Price，包括本地化与本地币种（如 A 已合并）。执行前列出对象清单，获批后再执行。验证：沙盒价格与 staging 库的映射一致且为 active
- [ ] 6.2 【用户批准 → Codex】在沙盒配置 Stripe 客户门户：可修改付款方式、查看发票、在周期末取消，关闭方案切换。验证：从账单页打开门户，截图显示配置生效
- [ ] 6.3 【Codex】订阅端到端：英文订阅 `plus`（USD）→ 首付到账 400 积分 → 解锁一份详批（先扣每日积分再扣订阅积分）→ 用 Stripe Test Clock 推进一个账期，续费到账、上期积分在宽限后过期 → 升级到 `premium`（按比例计费，下期发 1000）→ 账单页取消 → 推进到周期末，订阅终止且不再发放 → 对首付做全额退款，积分被回收。验证：每步的 `payment`、`credit_grant`、余额与对账差额为 0，证据写入 `EVIDENCE_DIR`
- [ ] 6.4 【Codex】A 已合并时：用繁体界面订阅（TWD），确认续费币种为 TWD，切换到英文界面后换档仍选 TWD；取消后在英文界面重新订阅 USD，记录 Stripe 是否接受同一 Customer 换币种。验证：结果记录进 A design D7；若被拒绝，开缺陷跟进
- [ ] 6.5 【Codex】每日积分：已验证账号进入 App 领取 10 积分，再次进入显示已领取；未验证账号显示引导；同邮箱在两站的账户共享当日额度；后台指标显示领取次数。验证：截图与数据库只读快照
- [ ] 6.6 【Codex】PayPal 订阅不可见：账单页与定价页的订阅选项没有 PayPal，PayPal 积分包照常可买。验证：截图

## 7. 生产上线（需使用者逐项批准）

- [ ] 7.1 【用户】完成 1.3 的 Stripe 业务描述更新，并在生产后台给新套餐授权模型。验证：2.2 的诊断输出通过
- [ ] 7.2 【用户批准 → 协调者】合并并发布，每日积分随之开启。确认主分支的发布流水线成功，并核对 `/api/health` 的版本 SHA。验证：两站进入 App 时领取正常
- [ ] 7.3 【用户批准 → 协调者】`pnpm billing:sync-stripe-live`：先演练，获批后写入订阅价格；配置 live 客户门户（同 6.2）。验证：生产定价页的订阅档位变为可购买
- [ ] 7.4 【用户批准】在两站各做一笔真实小额订阅，然后取消并申请全额退款。验证：积分发放与回收一致，后台显示正确，Stripe 不再续费
