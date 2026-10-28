# PayPal 上线 runbook（staging Sandbox → 生产 live）

对应 change `enable-paypal-checkout` 的 tasks 5.x（staging）与 6.x（生产）。本文只写本站上线步骤；实现说明见
[05-billing](../05-billing.md) §2「本站启用 PayPal 一次性积分包」，
设计取舍见 change 的 design.md D1–D8。

> 命令名按 design 书写。`billing:activate-packs` 与生产 secret 检查由 C 组（tasks 3.2、3.3）实现，**以 C 组 PR
> 合并后的实际脚本名与参数为准**；执行前先看根 `package.json` 的 scripts 与 `scripts/production/`。

## 0. 边界与前提

- 只启用 PayPal 一次性积分包（`billing.providers: ['paypal']`），订阅 `pro` / `team` 保持停用，Stripe 不启用。
- 仓库公开：Client ID / Secret、Webhook ID、数据库 URL、账号邮箱都不写入本文、证据、PR 或日志。secret 只经
  stdin 写入 Wrangler；证据只记录名称、ID 前缀以外的非敏感字段和退出码。
- 合并到 main 不等于上线。生产仍由版本 tag 加 GitHub production 审批触发，审批由用户点击。
- 生产开放付款必须与 D1 上线模型、生产 `DEEPSEEK_API_KEY`、后台详批开关在**同一窗口**完成
  （launch-v1-production 2.2），否则用户买到的积分无法使用。
- 积分包价格沿用种子值（Single 100 积分 $0.99、Five 500 积分 $3.99），由用户核实 PayPal 费率后在 6.1 决定。
- 上线前由用户确认：PayPal Business 账号可收款（税务居住地 CN 的商家账号不支持高级信用卡 ACDC，买家只在
  PayPal 托管页付款，可用账户或按 PayPal 规则以访客身份刷卡），业务类目无审查问题。
- 法律页（terms / privacy / refund）已改为 PayPal，但需人工审阅后再开放生产付款。

## 1. PayPal App 与 webhook

Sandbox 与 Live 各建一个独立的 REST App，ID、密钥、webhook 互不复用。一个 web Worker 同时服务两站，所以
生产只登记一个 webhook（`arcanumber.com`），Ganjiday 的订单也由它接收。

| 环境 | App | Webhook URL | 写入的 Worker 环境 |
| --- | --- | --- | --- |
| staging | Sandbox REST App | `https://xuanxue-web-staging.saas-jobs.workers.dev/api/billing/webhooks/paypal` | web / jobs `--env staging` |
| 生产 | Live REST App | `https://arcanumber.com/api/billing/webhooks/paypal` | web / jobs `--env production` |

订阅事件逐一取自 `packages/billing/src/paypal/webhooks.ts` 的 `supported` 集合（共 12 项，两个环境相同）：

| 事件 | 本站用途 |
| --- | --- |
| `CHECKOUT.ORDER.APPROVED` | 关联订单（`checkout.completed`），不入账、不 capture |
| `PAYMENT.CAPTURE.COMPLETED` | 一次性积分包最终入账依据 |
| `PAYMENT.CAPTURE.REFUNDED` | 退款入账与积分回收 |
| `CUSTOMER.DISPUTE.CREATED` | 争议记录 |
| `BILLING.SUBSCRIPTION.ACTIVATED` | 订阅（本站停用，保持订阅以便与代码一致） |
| `BILLING.SUBSCRIPTION.UPDATED` | 同上 |
| `BILLING.SUBSCRIPTION.CANCELLED` | 同上 |
| `BILLING.SUBSCRIPTION.EXPIRED` | 同上 |
| `BILLING.SUBSCRIPTION.SUSPENDED` | 同上 |
| `BILLING.SUBSCRIPTION.PAYMENT.FAILED` | 同上 |
| `PAYMENT.SALE.COMPLETED` | 同上（订阅付款） |
| `PAYMENT.SALE.REFUNDED` | 同上（订阅退款） |

其他事件到达时返回已忽略，不影响账务。PayPal 模拟器事件不支持回传验签，不能代替真实 Sandbox 交易验收
（见 [支付联通 runbook](p2-payment-integration.md)）。

## 2. secrets 写入顺序

web 与 jobs **各三项**：`PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_WEBHOOK_ID`（同一 App、同一 URL 的
webhook ID，不是事件 ID）。值经 stdin 写入，不放入 argv：

```bash
# <env> 为 staging 或 production；每条命令按提示从 stdin 输入值
pnpm --filter @xuanxue/web exec wrangler secret put PAYPAL_CLIENT_ID --env <env>
pnpm --filter @xuanxue/web exec wrangler secret put PAYPAL_CLIENT_SECRET --env <env>
pnpm --filter @xuanxue/web exec wrangler secret put PAYPAL_WEBHOOK_ID --env <env>
pnpm --filter @xuanxue/jobs exec wrangler secret put PAYPAL_CLIENT_ID --env <env>
pnpm --filter @xuanxue/jobs exec wrangler secret put PAYPAL_CLIENT_SECRET --env <env>
pnpm --filter @xuanxue/jobs exec wrangler secret put PAYPAL_WEBHOOK_ID --env <env>
```

- staging：写入后执行 `pnpm staging:check-secrets`，只输出名称。staging 已有的 Stripe Sandbox secrets 不删除，
  启用 PayPal 后检查器不再要求它们。
- 生产：**先写 secrets 并通过生产 secret 检查，再发布带 `PAYMENT_MODE=live` 的版本。** 生产检查复用
  `getSecretRequirements()`，要求 web 与 jobs 都有上述三项、不要求 Stripe（C 组 3.3，命令以合并后为准）。
  如果先发布 live 而缺凭据，provider 不可用，定价页降级为「即将开放」，不会出错，但不应依赖这个窗口。
- `node scripts/production/check-wrangler-envs.mjs`（`pnpm check` 已包含）断言生产 `PAYMENT_MODE` 为 `live`。

## 3. staging（tasks 5.x）

前提：A–D 组 PR 已合并并自动发布到 staging；用户已创建 Sandbox App、webhook 与 Sandbox 买家账号。

1. 按 §2 写入 staging secrets，`pnpm staging:check-secrets` 退出 0。
2. 通过进程环境显式注入 staging 库 URL（`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`），依次执行：
   - `pnpm billing:seed`（已存在的价格元组跳过，可重复执行）；
   - `BILLING_SYNC_MODE=test pnpm billing:sync`：Sandbox 的 `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` 从进程
     环境或 gitignored 的根 `.env.local` 读取，不写在命令行里；只同步启用的 provider，PayPal 积分包映射为本地
     `paypal:credit_pack:{priceId}` 并激活，不在 PayPal 创建积分包 Plan。
   - 本地没有 Sandbox 凭据时（凭据只在 Wrangler secrets 中），可改用
     `BILLING_ACTIVATE_CONFIRM=xuanxue_staging pnpm billing:activate-packs`：本站只启用积分包，两者效果相同，
     且不需要凭据、不调用 PayPal。2026-10-28 staging 按此执行，激活 2 处。
3. 发布 staging（main 自动发布或手动 jobs → web），`/api/health` 返回完整 SHA 与 `db.up`。
4. 验收（5.2、5.3），逐项保存脱敏证据到 `docs/runbooks/evidence/`：
   - 两站各选一种语言（如 Arcanumber en、Ganjiday ko）：解锁卡 → PayPal 付款 → 回跳页自动 capture → 回到发起页 →
     积分到账 → 自动生成。记录 PayPal 页面显示的品牌与语言，`webhook_event` processed、`purchase` paid、积分只发一次。
   - 取消：在 PayPal 页取消后直接回到发起页，无扣款。
   - 批准后关闭页面：等待后台补 capture 入账。staging Cron 为 reduced 档（`*/30 * * * *`），再加 10 分钟最小
     等待，最长约 40 分钟。
   - 重复回调：在 Sandbox App 的 Webhook Events 重投已处理事件，账务不变。
   - 退款：用户在账单页申请 → 后台审批 → PayPal 退款 → `PAYMENT.CAPTURE.REFUNDED` 入账、积分回收，对账差额为 0。
   - 删号：在启用 PayPal 的配置下删除测试账号，删除后原密码登录被拒。
   - 记录未批准订单的实际过期行为；与 design D4 阈值（3h / 72h）不符时回报协调者调整。

## 4. 生产（tasks 6.x）

前提：staging 验收通过；用户完成 PayPal Business 认证、Live App 与 webhook，并在 6.1 确认积分包价格。

1. **价格（6.1）**：如价格有变，先改 `EXAMPLE_CATALOG` 与定价文案，在 staging 复验 5.2，再继续。
2. **secrets**：按 §2 写入生产 web 与 jobs 的三项 PayPal secrets，通过生产 secret 检查。同时确认 D1 所需的
   生产 `DEEPSEEK_API_KEY` 已写入 web。
3. **发布**：确认 CI 与 staging 发布成功后打 annotated tag（`v*`），用户在 GitHub 审批 production；workflow 完成
   迁移、jobs、web、两站健康与只读冒烟。两站 `/api/health` 返回完整 SHA。
4. **激活积分包**：通过进程环境显式注入生产库 URL，执行
   `BILLING_ACTIVATE_CONFIRM=xuanxue_production pnpm billing:activate-packs`。确认值必须与目标库名一致，否则拒绝
   执行；命令只在数据库内把当前积分包的 PayPal 价格设为 active，不调用 PayPal，输出变更条数。价格未变且已执行过
   时应报告 0 处变更。如 6.1 改了价格，先 `pnpm billing:seed` 再执行本步，旧价格自动变为 inactive。
5. **后台配置（同一窗口）**：后台 → AI 模型新增 D1 上线模型；运行时设置填六个 `readings.<kind>.modelKey` 并开启
   详批。见 [v1-decisions D1](../v1-decisions.md)。
6. **验收（6.2、6.3）**：两站定价页与解锁卡显示可购买；两站各完成一笔真实小额购买并生成一份详批，随后在后台
   退款。记录 webhook processed、积分入账后被回收、PayPal 后台交易显示正确品牌。证据存入
   `docs/runbooks/evidence/`，再按条件补跑 `e2e-live`。

## 5. 回滚

- **暂停售卖**（首选，不需发布）：以有权限的数据库角色执行下列运维 SQL，定价页与解锁卡自动显示「即将开放」：

  ```sql
  UPDATE plan_price SET active = false WHERE provider = 'paypal';
  ```

  恢复售卖时重新执行 `billing:activate-packs`。
- **断开 PayPal**：删除 web 与 jobs 的 `PAYPAL_*` secrets，provider 不可用后同样降级为「即将开放」。注意 jobs
  同时失去补 capture 与回调处理能力，已批准未 capture 的订单需恢复后补处理。
- **代码回滚**：回滚到上一个已验证的 tag。已有 live 账务的数据库不能切回 test。
- 已入账的付款和积分不回滚，按退款流程处理。

## 6. 验收清单

staging（5.x）：

- [ ] 5.1 staging web / jobs 三项 `PAYPAL_*` 写入，`pnpm staging:check-secrets` 通过；`billing:seed` 与
  `BILLING_SYNC_MODE=test billing:sync` 退出 0；定价页与解锁卡显示可购买的 PayPal 积分包
- [ ] 5.2 两站各一种语言完成解锁 → 付款 → 自动 capture → 回调入账 → 自动生成；取消；批准后关页等待补 capture；
  重复回调幂等；PayPal 页面品牌与语言正确
- [ ] 5.3 退款申请 → 后台审批 → PayPal 退款 → 积分回收，对账差额 0；启用 PayPal 下删号，原密码登录被拒；记录
  未批准订单过期行为

生产（6.x）：

- [ ] 6.1 用户确认积分包价格；如有变化，目录、定价页、解锁卡一致并已在 staging 复验
- [ ] 6.2 生产 web / jobs 三项 `PAYPAL_*` 写入并通过生产检查；tag 审批发布；`billing:activate-packs` 完成；D1 模型、
  `DEEPSEEK_API_KEY` 与详批开关同窗口完成；两站 `/api/health` 完整 SHA，定价页可购买
- [ ] 6.3 两站各一笔真实小额购买 + 一份详批 + 后台退款；webhook processed、积分入账后回收、PayPal 后台品牌正确；
  证据入 `docs/runbooks/evidence/`，按条件补跑 `e2e-live`
