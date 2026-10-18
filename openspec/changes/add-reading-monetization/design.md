# Design

## Context

模板已具备：积分 hold/capture/release 与超额容忍（`packages/credits`）、文本模型注册表与流式对话结算（`features/ai/text-stream.ts`）、Stripe 积分包 Checkout、newsletter 双重确认（`features/growth`）、邮件队列。L2 实质是「一次性、结构化输入的 AI 生成」，可以复用对话的结算管线，但不需要会话历史。

## Goals / Non-Goals

**Goals:** 从点击解锁到开始生成的路径最短；计费复用现有不变式；提示词可审阅、可版本化。
**Non-Goals:** 不做订阅制会员（保留模板能力，前台不展示）；不做 L3 联盟入口；不做多轮追问。

## Decisions

### 1. 详批注册表
`features/readings/catalog.ts` 定义 `ReadingKind`：`bazi-full`、`saju-full`、`ziwei-full`、`saju-compat`、`numerology-full`、`tarot-spread`。每项包括：引擎复算函数、章节列表、提示词版本、默认积分价格。运行时设置 `readings.<kind>.{enabled, credits, modelKey}` 存在 `packages/db/src/settings.ts`，通过后台运行时设置页编辑。

### 2. 生成管线
`POST /api/readings`（需要会话）请求体为 `{ kind, input, locale, site }`：
1. 校验输入后服务端复算；
2. 以 `(userId, kind, hash(input))` 做 10 分钟幂等，命中则返回已有 reading id；
3. `hold(credits)`，写入 `reading`（status=generating）；
4. 调用文本模型，流式写回（SSE），复用 `text-stream.ts` 的检查点结算；
5. 完成后 `capture`，status=ready，入队报告邮件；没有可见输出的失败执行 `release`。
报告正文以 Markdown 存在 `reading.content`，渲染时做白名单清洗。

### 3. 模型与提示词
默认模型 `claude-opus-5-5`（经 AI Gateway，Anthropic Provider 已在模板中），`effort: low`；单次约 3k 输入 / 2.5k 输出，成本约 $0.06–0.10。是否换成更便宜的模型由运营在后台决定。system prompt 固定（角色、合规约束、章节格式、语言），放在 `features/readings/prompts/<kind>.v1.ts`，用 prompt caching 缓存固定前缀；用户内容只包含结构化结果 JSON 与主题。输出章节以 `## ` 标题分隔，便于校验章节齐全。
合规由三层保证：提示词约束 → 生成后用规则检查（禁止词表：具体日期预言、病名诊断、投资标的）→ 命中时替换该段并记录日志。

### 4. 定价种子
1 次详批 = 100 积分。积分包：Single（100 积分，$0.99）、Five（500 积分，$3.99）。启用 Stripe Adaptive Pricing 显示当地货币（韩元约 ₩1,400 / 新台币约 NT$32）。`signupBonusCredits: 0`，避免注册即白拿详批。价格均为种子值，可在后台修改。

### 5. 意图保留
点击解锁时把 `{kind, input, returnTo}` 签名（复用 growth token 的 HMAC）写入 `unlock` 查询参数，登录与 Checkout 的 returnTo 都带上它；回到结果页时检测到 `unlock` 参数并且已登录、积分足够，就自动 `POST /api/readings`。

### 6. L1 邮件
newsletter 表新增 `source_tool`、`topic`、`site`、`locale`、`last_result`（结构化结果 JSON，用于确认后的那一封邮件，发送后清空）。解读段落来自 `messages/<locale>/readings-email.json` 中按日主/生命灵数/牌名与主题组合的模板，不调用 AI。

## Risks / Trade-offs

- [AI 内容违规] → 三层约束 + 审计日志；上线前人工抽检每种详批 10 份。
- [Adaptive Pricing 在部分地区不可用] → 回退为美元价格，前台估价标注「约」。
- [流式中断] → 复用模板「检查点 + waitUntil」方案，断开后仍能结算，报告可在列表中重新打开。
