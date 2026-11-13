# Proposal

## Why

模板 0.3.0 已交付「对话绑定对象」注册表、临时上下文令牌、推荐追问、回复评分与余额不足/预计消耗组件，而 xuanxue 仍在用自建的 `chat-context*` 与 `?context=` 链接，付费报告页也没有任何追问入口——竞品（OpenFate、FateMaster）的共同点正是「报告内可追问并带推荐问题」。现在迁到模板机制，既能减少与模板的长期分叉（`chat-page.tsx`、`conversations.functions.ts` 仍带项目改动），又能在付费报告上直接补齐追问能力。

## What Changes

- **结果页「用这个结果问 AI」改走模板临时上下文**：`createChatContextLink` 改用 `issueSubjectContext` 签发令牌，跳转地址由 `/app/<slug>/chat?context=<token>` 改为 `/app/<slug>/chat/context?token=<token>`；服务端复算、`safeReturnPath`、未登录回跳与 sessionStorage 续接保持不变。
- **注册两个对象类型**（`apps/web/src/features/ai/subject-providers.ts`）：`reading`（付费报告，持久对象，`resolve` 同时校验空间与用户）与 `chart-result`（免费结果，只经临时令牌使用，无 `resolve`）。对话列表显示来源标签。
- **付费报告页内追问**：报告就绪后，报告页嵌入 `<SubjectChat subjectType="reading" subjectId={report.id}>`；上下文为报告正文与服务端复算的结构化结果，只在新建对话时写入一次；开场推荐问题按详批类型 × 语言（zh-Hant / zh-Hans / ko / en）静态提供。
- **启用模板推荐追问与评分**：`template.config.ts` 开启 `ai.text.followUps`（回复后生成后续问题）；消息评分与反馈（含 0.3.1 的共享同意）已在对话页与嵌入对话中接线，本次作为正式功能验收并在隐私政策中补充说明。
- **预计消耗换用模板组件**：对话输入区的自建 `ChatCostHint` 改为 `@xuanxue/ui` 的 `CreditEstimate`（显示预计消耗与当前余额，不足时以危险色与图标提示），估算口径计入对象上下文前缀；余额不足仍走已接入的 `InsufficientCreditsDialog`。
- **过渡期兼容**：
  - 发布前签发的旧 `?context=` 链接（30 分钟有效）在新版本中仍可打开：服务端验旧令牌、读旧 KV，换发新令牌并跳到新地址；下一次发布删除该兼容入口。
  - 已有带 `data-chat-context` 的旧对话继续按首条 system 消息作为前缀参与回答；对话页仍显示其命盘摘要（只读解析旧片段），不做数据迁移。
- **删除**（兼容入口之外）：`chat-context.ts` 的签发与 `createConversation` 的 `context` 参数、`chat-context-start.tsx`、`ChatPage` 的 `chatContext` 属性与项目自建的 `ChatCostHint`。**BREAKING（内部）**：`createConversation` 不再接受 `context`。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `ai-chat`：新增「命理对象对话」「结果页上下文改用临时上下文令牌及旧链接兼容」「回复后推荐追问」「回复评分与反馈」「预计消耗与余额提示」等要求（product-improve-ai-content-20261030 的「从结果页携带命盘上下文」「发送前显示预计消耗」在归档时由本 change 的对应要求取代，见 design 决策 9）。
- `paid-readings`：新增「报告页内追问」要求。

## Impact

- 代码：`apps/web/src/features/ai/`（`subject-providers.ts`、`chat-context*.ts`、`chat-context-start.tsx`、`ask-ai-entry.tsx`、`conversations.functions.ts`、`chat-page.tsx`、`model-picker.tsx`）、`apps/web/src/routes/app/$slug/chat/index.tsx`、`apps/web/src/features/readings/`（`report-page.tsx`、新增报告追问的 provider 与推荐问题）、`template.config.ts`、`apps/web/messages/<locale>/` 新增文案文件、隐私政策正文。
- 数据：不新增迁移；使用模板已迁移的 `ai_conversation.subject_type/subject_id` 与 `ai_message_feedback`。不写生产库、不回填旧对话。
- 计费：追问沿用现有对话计费（按模型定价预扣与结算）；`followUps.charge` 是否开启见 Open Questions。
- 运行成本：推荐追问每条回复多一次小模型调用（KV 缓存 1 天）；不新增 Cron 或轮询，符合 Neon 成本基线。
- UI：报告页嵌入对话属于较大布局改动，实施前需经 `ui-design` 设计稿确认。
- 测试：`apps/web/e2e/ai-chat.spec.ts` 的结果页带盘用例改为新地址；新增报告追问与越权 404 的集成/e2e 用例。
