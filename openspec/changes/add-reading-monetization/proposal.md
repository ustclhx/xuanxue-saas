# Proposal

## Why

英语词的广告价值极低（life path number 顶部出价约 $0.01–0.05），收益必须来自 L1 邮件名单和 L2 付费详批（`doc/design.md` §5）。韩国 `saju-kid.com` 的 990 韩元一键详批已经证明有市场。v1 先上线 L1 与 L2，L3 真人占卜联盟入口放到 P5。

## What Changes

- **L1 结果后订阅**：免费结果下方显示内联卡片（姓名、邮箱、主题下拉：爱情/事业/财运/复合等），走 newsletter 双重确认；确认后发送一封基于该结果的个性化解读邮件（根据结构化结果模板生成，不调用 AI）。
- **L2 完整分析付费解锁**：结果末尾显示「完整分析」，包含价格（积分 + 当地货币估价）与示例目录。需要登录（邮箱验证码或 Google），积分不足时购买积分包（Stripe Checkout，Adaptive Pricing 显示当地货币），完成后回到原结果页自动生成。
- 服务端根据输入重新计算结构化结果，调用文本模型生成分章节的本语言详批（流式显示）。积分预扣、成功后结算，无可见输出时全额退回；生成的报告保存在用户空间，可在 `/app/<空间>/readings` 查看，并通过邮件发送链接。
- 后台：每种详批的积分价格、所用模型与开关作为运行时设置；提示词在代码中版本化。
- 积分包种子：Single Reading 与 5-Reading Pack（具体价格见 design）；`signupBonusCredits` 调整为 0。

## Capabilities

### New Capabilities
- `paid-readings`: 付费完整分析的解锁、计费、生成、合规约束、保存与查看。
- `reading-optin`: 结果后邮件订阅卡片与确认后的个性化解读邮件。

### Modified Capabilities
- `newsletter`: 订阅记录增加来源工具、主题、站点与语言，并据此发送欢迎邮件。

## Impact

- `packages/db/src/schema/readings.ts`（新领域文件）与 growth 表新增列；`packages/email` 新增两个模板；`apps/web/src/features/readings/`、`/api/readings/*`、`/app/$slug/readings`。
- 复用 `packages/credits` 的 hold/capture/release、`packages/ai` 文本模型调用、`packages/billing` 积分包。
- 依赖 `add-dual-site-foundation`（跨站登录与回跳）以及至少一个引擎包（bazi 优先）。
