# Design

## Context

动机见 proposal.md。模板 0.3.0 / 0.3.1 已在本项目落地以下能力：

**模板已提供的能力**
- **订阅 + 积分包并存**：`groupPricingPlans` / `pricingForInterval`、账单页「订阅 / 积分余额 / 积分包」分区、`getCustomerBilling().summary`、余额不足 HTTP 402 合同及其弹窗。
- **订阅全流程**：Stripe 与 PayPal 的结账、续费、取消、恢复、客户门户、换档前置检查、一个空间一个续费订阅、重叠期，以及按付款发放与回收积分（`docs/05-billing.md` §2–§6）。
- **每日积分**：
  - 发放：`packages/credits/src/daily.ts`；
  - 检查入口：`apps/web/src/features/credits/daily.server.ts`，由 `workspace.functions.ts` 在进入 App 区时调用，带 KV 按日缓存，模拟登录时跳过；
  - 提示组件：`DailyCreditsNotice`，已接入 topbar 与 sidebar 布局；
  - 运行时设置默认值：`dailyAmount=10`、`dailyMaxDaysPerMonth=10`、`dailyExpiryDays=7`、`dailyRequireVerifiedEmail=true`；
  - 唯一性：`credit_daily_claim` 对「用户 + 日期」「邮箱散列 + 日期」各自唯一；
  - 开关：`template.config.ts` 中 `credits.dailyEnabled=false`。

**本项目现状**
- `EXAMPLE_CATALOG` 中 `pro` / `team` 停售且无价格，在售的只有两个积分包。
- `sync-stripe-live.ts` 明确拒绝任何非积分包价格。
- 定价页 `features/marketing/pricing-page.tsx` 是项目定制版，只展示积分包，文案写着「一次性」。
- Stripe 账户的业务描述写着「No subscriptions」（`docs/runbooks/stripe-launch.md` §4）。
- staging 的 `xuanxue-staging` 沙盒只有积分包价格；webhook 已订阅全部 10 项事件，包括订阅事件。
- PayPal 订阅：模板已在沙盒验证首付、取消与恢复。但本项目没有 live 的 PayPal 订阅 Plan 创建脚本（`billing:sync` 只允许 test 模式，`activate-credit-packs` 只处理积分包），PayPal 的自然续费也从未在本项目验收。

## Goals / Non-Goals

**Goals:**
- 以最少的新代码启用两档月付订阅和每日积分，最大限度复用模板。
- 订阅后用户可用的功能与积分不少于订阅前，消耗顺序符合直觉。
- staging 能完整验收订阅的首付、续费、取消、换档与退款。

**Non-Goals:**
- 年付、试用期、优惠码、会员专属内容或折扣。
- PayPal 订阅（见 D3）。
- 合并两站的每日领取额度，或改为按站点区分（见 D6，维持模板行为）。
- 订阅内升级时立即补发积分差额（模板未提供，见 Open Questions）。

## Decisions

### D1 新增两个订阅套餐，不复用 `pro` / `team`

在 `EXAMPLE_CATALOG` 中新增 `plus`（400 积分）和 `premium`（1000 积分）：
- `type='subscription'`，`rollover=false`，`creditExpiryDays=null`，周期末过期；
- sort 分别为 30、40，介于 free 与 staff(1000) 之间；
- 价格只有 `interval='month'`，数值来自价目表。

`pro` / `team` 保持停售，不改。原因：
- 它们的名字和积分（1000/5000）是模板示例；
- staging 与生产库中可能有历史引用；
- 用新键可以避免 seed 改写语义带来的歧义。

键名与展示名（如「月卡 / 进阶」）待使用者确认（Open Questions），确认后只需替换字面量。

### D2 订阅套餐的权益

`features` 沿用 `DEFAULT_FREE_FEATURES`。权益取「最高生效套餐」的 features（entitlements spec），而 `features.models` 由后台按套餐单独授权，seed 默认为空列表。如果直接上线，订阅用户会因为套餐的 models 为空而失去免费档已授权的 Chat 模型。

处理：上线前由管理员在 `/admin/billing/plans` 中给两个新套餐授予不少于免费档的模型。另外加一项自动检查：激活脚本或单元测试断言在售订阅套餐的 models ⊇ free 的 models，不满足时拒绝激活。是否给订阅用户额外权益（更好的模型、`capabilities` 功能键）留作 Open Question，不影响本次结构。

### D3 订阅首发只经 Stripe

PayPal 订阅不在本次范围，原因有四：
- 需要新写 live Plan 创建脚本；
- 本项目没有验收过 PayPal 的自然续费；
- PayPal 不支持订阅内换档；
- ko 的 PayPal 只收 USD，与 A change 的本地币种不一致。

实现方式：不为 PayPal 生成订阅价格行，或生成后保持 inactive。`priceFor` 已经拒绝 inactive 价格，返回 `BILLING_PRICE_UNAVAILABLE`。需要确认的是，定价页、账单页、余额不足弹窗在「某平台没有该套餐价格」时隐藏该平台，由 payments spec 的新要求覆盖。以后如果开放 PayPal 订阅，另开 change。

### D4 订阅积分的周期、过期与消耗顺序

全部沿用模板逻辑：
- 积分由 `invoice.paid`（subscription_create / subscription_cycle）发放；
- 过期时间为周期末加 `subscriptionCreditGraceHours`（24 小时）；
- 不结转。

结果是消耗顺序天然为：每日积分（7 天）→ 订阅积分（≤ 一个月）→ 积分包（365 天）。用户先用掉最快过期的积分，积分包作为长期储备。这与「订阅积分不结转」的价值主张一致。账单页的余额分区已经能显示各来源的余额和到期时间（`summary.credits`），并补充「本期积分将于 X 到期」的说明（已有 `subscriptionCreditsNote`）。

### D5 订阅币种与 A change 的关系

订阅价格写入 A change 的 `price-table.ts`：

| 档位 | USD | TWD | KRW |
|---|---|---|---|
| 400 积分 | 499 | 16200 | 7000 |
| 1000 积分 | 999 | 32500 | 14000 |

数值待使用者在 A change 的 1.1 中一并确认。

合并顺序：A 的 W1（币种基础）与 W2（价目表）建议先合并，B 的目录改动 rebase 到其上。如果 B 先上线，订阅价格只有 USD 行（与现有积分包一致），A 上线后再补 TWD/KRW 行并同步。

续费币种由 Stripe 订阅所绑定的 Price 决定，切换语言不会改变。换档使用当前订阅的币种（A design D7）。

Stripe Customer 不能同时持有不同币种的有效订阅。用户先以 TWD 订阅、后在英文界面换档时，按 D7 换到同币种价格。取消后在另一币种重新订阅的情况，在 staging 验收中实测（tasks 6.4）。

### D6 每日积分直接启用模板实现

- `template.config.ts` 中设 `credits.dailyEnabled: true`。
- 运行时设置保持默认 `dailyAmount=10`、`dailyMaxDaysPerMonth=10`，即使用者拍板的数值。
- `dailyRequireVerifiedEmail=true`，与注册赠送一样防刷；OAuth 邮箱视为已验证。
- `dailyExpiryDays` 见 Open Questions。

领取时机沿用模板：进入 App 区（`/app/...`）时检查。本站用户多从公开工具页进入，只有在解锁、查看报告、进入账单时才会进 App 区。是否在登录完成或公开页头也触发检查，作为 Open Question，默认不加，以免公开页访问增加数据库查询。

**跨站共享额度**：`credit_daily_claim` 的「邮箱散列 + 日期」全局唯一，同一邮箱的两站账户共享每日与每月额度（模板升级说明已披露）。之前已评估可以接受。本 change 将其写入 daily-credits spec，并在 FAQ 中说明，不改代码。

### D7 定价页改版走设计稿

定价页从「只有积分包」改为「订阅 + 积分包 + 每日领取说明」，属于较大的布局改动。按项目约定，先用 `ui-design` 技能出设计稿并经使用者确认，再实现。

实现时复用模板的 `groupPricingPlans` / `pricingForInterval` / `pricingFeatures` 与 `@xuanxue/ui` 组件，并保留项目定制页面的这些内容：可解锁的详批清单、FAQ、AI 声明、「即将开放」降级、预渲染与快照。只有月付，不显示月/年切换。

账单页与余额不足弹窗直接使用模板的订阅分区，只补齐文案、核对 ko/zh-Hans 的翻译，不需要设计稿。

### D8 取消、门户与退款

- **取消**：账单页的「取消」按钮调用 `cancelSubscription(atPeriodEnd)`。Stripe 客户门户用于修改付款方式和查看发票。门户中关闭「切换方案」，避免绕过 D5 的币种约束与模板的换档逻辑；保留「取消」，并设为周期末生效。门户配置属于外部动作。
- **换档**：Stripe 升级立即生效，按比例计费，积分在下次续费时按新档发放；降级在周期末生效。均沿用模板。
- **退款**：沿用人工审核的退款申请（30 天内）。全额退款回收剩余积分，部分退款按比例回收（订阅 spec 新要求是对模板行为的显式化）。重复订阅的竞态由模板的「自动取消并全额退款」处理。
- **法律与文案**：
  - 服务条款和退款政策补充自动续费、随时取消、周期末生效、不按天退款、积分当期有效；
  - 结账前在按钮附近显示「每月自动续费，可随时取消」。

  是否需要续费前提醒邮件（例如美国部分州的自动续费法规、韩国电商法相关规定）作为 Open Question，由运营或法务确认。

### D9 Stripe 产品与价格的创建

- **沙盒（staging）**：用 `BILLING_SYNC_MODE=test pnpm billing:sync` 从目录同步，订阅价格会建在规范 Product 上。是否为订阅建本地化 Product（东方站 Checkout 显示「月卡」等本地名）：A change 的 TWD/KRW 价格本身就要建在本地化 Product 上，因此订阅需要按语言的本地化 Product。`localized.ts` 的译名表扩展到订阅套餐，同步逻辑由 A 的 3.3 统一处理。
- **live**：`sync-stripe-live.ts` 去掉「只允许积分包」的断言，改为允许 `interval='month'` 的订阅价格，沿用演练 → 批准 → 写入的流程。

## Risks / Trade-offs

- **[每日积分与详批价格]** 一份详批通常为 100 积分。每月最多领取 100 积分，但默认 7 天过期，每日积分最多同时累积约 70 积分，不足以单独解锁一份详批，实际起到「降低首单门槛」的作用。如果把有效期改为 ≥ 30 天，每月可以免费解锁约一份，这与 `signupBonusCredits=0`（避免白拿详批）的旧决策相冲突。→ 列入 Open Questions，由使用者确认。
- **[订阅权益空集]** 见 D2。→ 自动检查 + 上线清单。
- **[Stripe 复审]** 更新业务描述（增加订阅）可能触发 Stripe 复审或限制。→ 先更新描述再激活 live 价格；激活前保持 inactive，不影响积分包销售。
- **[升级积分空窗]** 月中升级后立即付了差价，但本期积分不增加，可能引起投诉。→ 升级前提示「新档积分从下个周期开始发放」；是否立即补发留作 Open Question。
- **[跨站共享额度投诉]** 同一邮箱的两站用户可能困惑。→ FAQ 中说明；后台可按邮箱散列查询领取记录。
- **[共享文件冲突]** `catalog.ts`、`pricing-page.tsx` 与 A change 冲突，按 tasks 中的顺序合并。

## Migration Plan

1. 合并组 2–4。staging 自动发布后，新套餐的价格为 `unsynced` 且 inactive，订阅档位显示「即将开放」，每日积分在 staging 生效。
2. 经使用者批准后，在 staging 沙盒同步订阅价格、配置客户门户，完成端到端验收（组 6）。
3. 生产环境：
   1. 更新 Stripe 业务描述；
   2. 管理员给新套餐授权模型；
   3. 合并代码（每日积分随之开启）；
   4. 运行 live 演练，批准后写入订阅价格；
   5. 配置 live 门户；
   6. 做一笔真实小额订阅、取消与退款。
4. 回滚：
   - 订阅：停用订阅价格行，定价页回到「即将开放」，已存在的订阅照常续费，也可以由用户取消；
   - 每日积分：把 `dailyEnabled` 设为 false 后重新部署，已发放的积分保留。

## Open Questions

1. 套餐键名与展示名（四种语言），例如「月卡 / 进阶月卡」「Plus / Premium」。
2. `credits.dailyExpiryDays` 保持 7 天（每日积分最多累积约 70，不能单独解锁详批），还是延长到 30 天（约每月一份免费详批）？
3. 订阅积分是否允许结转（例如结转一期）？默认不结转。
4. 订阅用户是否获得积分以外的权益，例如更好的 Chat 模型？默认没有。
5. 是否在登录完成或公开页头也触发每日领取检查？默认只在 App 区触发。
6. 月中升级是否立即补发积分差额？需要扩展模板，默认不补发。
7. 是否需要续费前提醒邮件，以及自动续费的披露要求（运营/法务）。
8. 以后是否开放 PayPal 订阅（另开 change）。

## 决策记录（2026-11-13，使用者确认）

使用者审阅后确认：本 change 的 Open Questions 全部采用设计中的默认/推荐方案；需要使用者审阅的文案与样例按本 change 的默认方案执行，上线前的验收截图仍按 tasks 留证。

## 原型索引（2026-11-14）

设计稿经使用者确认，见 `docs/design/prototypes/README.md` 中所属 change 为本 change 的各行（副本在 `docs/design/prototypes/roadmap/`）。确认时同时变更品牌 token：东方站浅色 `--bg`、`--surface` 改为 `#ffffff`，`--surface-2` 改为 `#f5f2ec`（已写入 `apps/web/src/styles/brand.css` 与 `docs/design/visual-system.md`）。
