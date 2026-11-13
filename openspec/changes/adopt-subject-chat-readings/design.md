# Design

## Context

动机见 proposal.md「Why」。以下现状对照 `main @ aef5f5c2`（已采纳 template 0.3.1）核对，路径默认相对 `apps/web/src/`。

| 现状 | 位置 |
|---|---|
| 结果页「用这个结果问 AI」：`createChatContextLink` 复算 → `issueChatContext` 存 KV（`chat-context:<id>`，30 分钟）→ 返回 `/app/<slug>/chat?context=<token>`；令牌只绑定用户（`uid`），不绑定空间 | `features/ai/chat-context.ts`、`chat-context.functions.ts` |
| 未登录：沿用解锁卡回跳令牌去登录，sessionStorage 记待办，回到结果页后自动继续 | `features/ai/ask-ai-entry.tsx`（由 `readings/unlock-card.tsx` 挂载） |
| `chat?context=` 由 `ChatContextStart` 在挂载时调用 `createConversation({ context })` 自动建对话，system 消息含 `contextSystemText` 文本片段与 `data-chat-context` 数据片段（完整复算结果） | `routes/app/$slug/chat/index.tsx`、`features/ai/chat-context-start.tsx`、`conversations.functions.ts` |
| 对话页从首条 system 消息解析 `data-chat-context`，显示 `ChatContextSummary`，并把 `contextSystemText` 计入输入 token 估算 | `conversations.functions.ts#getConversation`、`chat-page.tsx` 的 `chatContext` 属性 |
| 模板 0.3.0 已提供：`subjects.ts` 注册表、`subject-context.ts` 临时令牌（绑定 `uid` + `ws`）、`subject-chat.server.ts` / `.functions.ts` / `.tsx`（`SubjectChat`、`TemporarySubjectChat`）、`/app/$slug/chat/context?token=` 路由、`follow-ups.server.ts`、评分与反馈（含 0.3.1 共享同意）、`chat-extras.tsx` 已接入 `InsufficientCreditsDialog`；`subject-providers.ts` 仍为空模板 | `features/ai/` |
| `chat.ts` 已按模板「首条 system 消息作为固定前缀」读取，旧对话的 `contextSystemText` 文本片段同样被当作前缀 | `features/ai/chat.ts` |
| 预计消耗为项目自建 `ChatCostHint`（模型名 + 典型回复区间），不显示余额；`CreditEstimateText` 已无调用方 | `features/ai/model-picker.tsx` / `.ts` |
| `ai.text.followUps` 未配置（默认关闭）；对话页 `onFinish` 已按配置调用 `getFollowUps` 并渲染 `SuggestionChips` | `template.config.ts`、`chat-page.tsx` |
| 报告：`reading` 表（`workspace_id`、`user_id`、`kind`、`input`、`locale`、`model_key`、`content`、`status`），保存在个人空间；`getReading` 只按空间过滤；报告页为单列 760px 文章，删除报告时清空生成对话的正文 | `packages/db/src/schema/readings.ts`、`features/readings/readings.functions.ts`、`report-page.tsx`、`delete.ts` |
| 详批类型与语言：bazi-full / ziwei-full（zh-Hant、zh-Hans）、saju-full / saju-compat（ko）、numerology-full（en）、tarot-spread（en、zh-Hant、zh-Hans、ko）；`recompute` 由原始输入复算结构化结果 | `features/readings/catalog.ts` |

约束：不新增迁移（模板 0022–0024 已移植）；不新增 Cron、轮询；页面只用 `@xuanxue/ui` 与 token；报告页嵌入对话属于较大布局改动，需 `ui-design` 确认；合规表述按 Chat 场景写「AI 辅助、仅供娱乐、不预测未来」。

## Goals / Non-Goals

**Goals:**
- 项目不再自建对话上下文的签发、建对话与 system 片段；模板文件（`chat-page.tsx`、`conversations.functions.ts`）上的项目改动收缩到最少，降低后续 template-sync 冲突。
- 付费报告页可就报告追问，与 `/app/<slug>/chat` 共用同一计费、模型选择、评分与推荐追问。
- 发布切换期间旧链接与旧对话不出错。

**Non-Goals:**
- 不做「报告附赠 N 次免费追问」等新计费机制（见 Open Questions 1）。
- 不回填旧对话的 `subject_type` / `subject_id`（列表不显示旧对话的来源标签）。
- 不改媒体生成页的预计消耗（模板自有实现）。
- 不改报告正文的阅读器、PDF 导出与分享卡片（由其他 change 负责；本 change 只在报告正文之后插入追问区）。
- 不修改模板拥有的 `subject-*.ts(x)`、`follow-ups.server.ts`、`@xuanxue/ui` 组件；确需改动时复制到项目目录并登记 `docs/design/forks.md`。

## Decisions

### 1. 两个对象类型：`reading`（持久）与 `chart-result`（临时）

- `reading`：`subjectId = reading.id`；`resolve` 用 `scoped(db, workspaceId)` 并同时以 `reading.userId = ctx.userId`、`status = 'ready'` 过滤，查不到返回 null（模板统一 404）。返回 `title = readingTitle(kind, reading.locale)`、`defaultModelKey = reading.modelKey`、`suggestions`（决策 4）、`context()`（决策 3）。
- `chart-result`：只经临时令牌使用，不实现 `resolve`；`subjectId` 为模板生成的 KV 随机键。
- 标签按语言给出（如「報告 / 报告 / 리포트 / Report」「結果 / 结果 / 결과 / Result」），不查库。

备选：每种详批一个类型（`bazi-full` 等，迁移表中的 `subjectType: kind` 写法）。放弃原因：同一详批类型既有免费结果又有付费报告，类型名无法区分来源；`kind` 放进上下文数据与标题即可。provider 代码放在项目自有的 `features/readings/subjects.ts`，`ai/subject-providers.ts` 只做副作用导入与注册，避免 `ai` 目录堆积命理逻辑。

### 2. 结果页入口改用 `issueSubjectContext`

`createChatContextLink` 保留现有的输入校验、复算、`safeReturnPath`、未登录返回 `login` 的合同与日志事件名，只把签发换成 `issueSubjectContext({ secret: BETTER_AUTH_SECRET, cache }, { userId, workspaceId: 个人空间, subjectType: 'chart-result', context, title, suggestions, returnTo })`，返回 `/app/<slug>/chat/context?token=<token>`。`ask-ai-entry.tsx` 只需容忍新地址（它只做 `location.assign`），sessionStorage 续接流程不变。

- 上下文：`version: 'chart-result-v1'`；`text` 为由 `contextSystemText` 去掉 JSON 后的说明（来源、无出生信息、按传统解读、仅供娱乐、不预测具体事件、不给医疗法律财务建议、用用户的语言作答）；`data: { kind, result }`。模板会自动加 `[context type=chart-result version=chart-result-v1]` 固定头。
- 标题：`readingTitle(kind)` 加 `contextSummary` 的前 1–2 项压缩为一行（≤ 200 字符，如「八字命盘 · 庚午 辛巳 庚辰 辛巳」），作为现有摘要卡的替代显示在临时上下文页标题区与对话列表中。模板的临时上下文页没有摘要插槽；保留完整摘要卡需要 fork 模板组件，见 Open Questions 4。
- 行为差异（接受）：模板临时页不在打开时自动建对话，而是显示开场推荐问题与输入框，第一次发送时才建对话——避免产生空对话，e2e 相应调整。

### 3. 报告上下文：报告正文 + 复算结果，只写一次

`context()` 返回 `version: 'reading-v1'`，`text` 为报告追问说明（这是该用户已购买的报告；回答须以报告与命盘为依据，指出报告未涉及之处；合规边界同决策 2；用用户的语言作答）加报告 Markdown 正文；`data: { kind, chart }`，`chart` 由 `readingDefinition(kind, locale).recompute(reading.input, reading.createdAt)` 复算（与生成时同一口径；引擎版本已变时以当前引擎为准，`version` 字段记录 `engineVersion`/`promptVersion` 便于排查）。

- 体量：详批正文通常数千到一两万字符，远低于模板 200,000 字符上限；超限时模板返回 422，provider 不截断（截断会让回答引用缺失章节）。
- 上下文在建对话时写一次（模板保证），报告之后被重新同步也不影响已有对话；`resolve` 只接受 `ready`，满足「生成中不追问」。
- 不把 `reading.input`（出生日期、地点、姓名）写进上下文，与免费结果一致。

备选：只放复算结果不放正文——回答会与报告结论不一致，放弃。

### 4. 推荐问题：开场静态、回复后由模板 LLM 生成

- 开场：项目文件 `features/readings/follow-up-questions.ts` 按「详批类型 × 报告语言」提供 3 个问题（free 结果与报告共用表，`chart-result` 用页面语言，`reading` 用 `reading.locale`）；单元测试断言每个已注册的 `kind × locale` 都有 3 条，且全部通过 `readings/compliance.ts` 的 `checkCompliance`。
- 回复后：开启 `ai.text.followUps`（`enabled: true, count: 3`），复用模板的 `follow-ups.server.ts`（每条回复一次、KV 缓存 1 天、限流、失败静默）。`charge` 与 `modelKey` 的取值待定（Open Questions 2），设计按两种取值都能工作：`charge=false` 时由平台承担；`modelKey=null` 时沿用回复所用模型。

备选：回复后也用静态问题——与上下文无关，点击率低；模板机制已现成，放弃。

### 5. 报告页嵌入 `<SubjectChat>`

`report-page.tsx` 在报告状态为 `ready` 时，于正文与打印按钮之后（`AiDisclaimer` 之前）渲染 `<SubjectChat slug subjectType="reading" subjectId={view.id} />`，经 `React.lazy` 懒加载，打印时隐藏（`print:hidden`）。生成中轮询完成后（状态由 generating 变 ready）再出现。具体视觉（标题、分隔、`panel` / `inline` 变体、手机宽度）由 ui-design 设计稿决定；ChatPage 内仍有原生 checkbox / textarea 等存量写法，属于模板文件，本 change 不改。

计费与模型：完全沿用 `POST /api/ai/chat`——模型列表来自 `getPickerModels`（套餐授权），`defaultModelKey = reading.modelKey`，不可用时回落到第一个；不像生成报告那样临时授予报告模型（Open Questions 3）。无可用模型时嵌入区显示模板的不可用空态与购买入口。

### 6. 预计消耗：模板 `CreditEstimate` + 服务端提供余额与前缀长度

- 新增项目文件 `features/ai/chat-cost.functions.ts`：`getChatCostContext({ slug, conversationId? })` 返回 `{ availableCredits, prefixChars }`——余额用 `@xuanxue/credits` 的 `getCreditBalance`；`prefixChars` 为该对话首条 system 消息的文本长度（旧带盘对话与新对象对话都适用，无对话时为 0），只返回长度不返回正文。
- 新增 `features/ai/chat-cost.tsx`：用 `typicalMessageEstimate`（保留在 `model-picker.ts`）计算区间，输入 token 计入前缀；渲染 `@xuanxue/ui` 的 `CreditEstimate`（`estimate` / `balance` 已按语言格式化，`insufficient` = 预计上限 > 余额）。挂载时读取一次、每轮回复结束后刷新一次，不轮询。
- `chat-page.tsx` 只做两处改动：`ChatCostHint` 换成 `ChatCost`（含删除估算中的 `chatContext` 分支）；`chatContext` 属性本身随旧摘要移到路由时删除（决策 7）。`model-picker.tsx` 删除 `ChatCostHint` 与无调用方的 `CreditEstimateText`。模型名称已由选择器显示，不在估算中重复。
- 余额不足弹窗已由 `InsufficientCreditsGuide`（`chat-extras.tsx` 接线）在 402 时弹出，嵌入对话同样生效，本 change 只做验收。

备选：把余额放进模板的 `getSubjectChat` / `getConversation` 返回值——要改两个模板文件且嵌入与独立页口径不一，放弃。

### 7. 过渡兼容

- **旧链接**：`routes/app/$slug/chat/index.tsx` 的 `?context=` 分支改为调用 `upgradeLegacyChatContext({ slug, token })`：用旧逻辑验签（`uid` 必须是当前用户）并读旧 KV；`ok` 时以旧 `{ kind, result }` 构造决策 2 的上下文、以旧 `returnTo` 调用 `issueSubjectContext`，再 `redirect` 到 `/chat/context?token=<新令牌>`；`expired` / `invalid` 时直接渲染模板 `TemporarySubjectChat` 的对应状态（复用模板文案）。旧令牌未绑定空间，换发时使用当前路由空间——旧链接本就指向签发时的个人空间，`withWorkspace` 已校验成员身份。此兼容代码放在 `features/ai/legacy-chat-context.ts`，**在本 change 发布后的下一次发布中删除**（旧令牌最多存活 30 分钟），删除任务单列。
- **旧对话**：不迁移数据。`chat.ts` 已把首条 system 消息当前缀，回答不受影响；摘要显示改由 `$conversationId` 路由在 `ChatPage` 之上渲染：`getConversation` 继续返回解析出的旧 `data-chat-context`（解析函数与 `ChatContextSummary` 移入 `legacy-chat-context.ts` / `chat-context-summary.ts`，长期保留，因为旧对话不会消失）。
- **删除**：`chat-context.ts` 的签发与 `contextMessageParts`、`chat-context.functions.ts#getChatContext`、`chat-context-start.tsx`、`createConversation` 的 `context` 参数与 `CHAT_CONTEXT_EXPIRED` 分支。

### 8. 删除报告时清除追问内容

`deleteReadingWithContent` 在同一事务内，对 `subject_type = 'reading' and subject_id = <报告 id>` 的对话：清空全部消息的 `parts`、清空标题、置 `archived = true`，并删除这些消息上的 `ai_message_feedback`（反馈文字可能引用报告内容）。消息行被积分账本与外键引用（`restrict`），沿用现有「清空正文、保留行」的做法。对话列表（含已归档）查询排除 `subject_type = 'reading'` 且报告已不存在的对话，与现有排除生成对话的 `not exists` 写法一致。

### 9. 与 product-improve-ai-content-20261030 的规格衔接

该 change 尚未归档，其 `ai-chat` 增量中的「从结果页携带命盘上下文」「发送前显示预计消耗」还不在主规格，本 change 无法用 MODIFIED 引用。本 change 以 ADDED 的「结果页上下文经临时上下文令牌进入对话」「预计消耗与余额提示」覆盖新行为。归档顺序：先归档 product-improve，再归档本 change；归档本 change 前由协调者把上述两条 ADDED 改写为对旧要求的 MODIFIED（或在归档后从主规格删除被取代的两条），避免主规格出现重复要求。

## Risks / Trade-offs

- [报告正文作为每轮固定前缀，追问单价明显高于空白对话] → 预计消耗计入前缀并显示余额；前缀逐字节不变，可受益于服务商前缀缓存（Anthropic 需在 `chat.ts` 已保留的 `providerOptions` 上生效，实施时验证是否命中）；若成本过高再考虑摘要化上下文（新 `version`）。
- [推荐追问在 `charge=false` 时由平台承担成本] → 每条回复仅一次、256 输出 token、KV 缓存、沿用 AI 限流；上线后看 `ai.follow_ups` 日志与用量。
- [模板临时页不自动建对话、摘要卡被标题替代] → 行为变化记入 PR 与 e2e；若使用者要完整摘要卡，按 Open Questions 4 fork。
- [报告购买者没有对话模型权限时无法追问，可能被视为「买了报告却不能问」] → 空态给出购买入口；是否授予报告模型由 Open Questions 3 决定，实现上只是 entitlements 包装（参照 `generate.ts#readingEntitlements`），不影响任务拆分。
- [`report-page.tsx` 与其他 change（阅读器 / PDF 导出、UI 规范清零）同时修改] → 本 change 只在正文后插入一个懒加载块；合并顺序靠后的分支负责 rebase，冲突点在 tasks 中标注。
- [旧链接兼容代码遗留] → 删除任务单列在下一次发布，PR 描述写明。
- [复算口径随引擎升级变化，追问上下文与报告生成时的命盘略有差异] → 上下文 `version` 带引擎版本；报告正文仍是主要依据。

## Migration Plan

1. 合并后随常规 CI 发布 staging（无迁移）；staging 验收：旧链接（发布前在 staging 生成一个 `?context=` 地址）、新结果页入口、报告追问、越权 404、评分与共享、推荐追问、预计消耗与余额不足弹窗。
2. 使用者批准后推 `v*` tag 发布 production；发布前确认后台已有可用的对话模型、套餐 `features.models` 覆盖报告默认模型（只读核对）。
3. 回滚：回退代码即可；已建的对象对话保留 `subject_*` 字段，旧代码按普通对话显示，首条 system 消息仍作为前缀。回退前把 `ai.text.followUps.enabled` 改回 false（随代码一起回退）。
4. 下一次发布：删除 `legacy-chat-context.ts` 中的旧链接换发逻辑（旧对话摘要解析保留）。

## Open Questions

1. **追问是否单独计费**：设计按「逐条按现有对话计费」编写。是否改为「每份报告附赠 N 次免费追问」或「报告价格内含追问」？后者需要新的积分发放或豁免机制，应另开 change。
2. **回复后推荐追问的计费与模型**：`ai.text.followUps.charge` 取 `false`（平台承担，推荐）还是 `true`（只对按 token 计价的模型预扣结算）？`modelKey` 指定一个便宜模型（需给出后台已有的模型 key），还是 `null` 沿用回复模型？
3. **无对话模型权限的报告购买者**：是否像生成报告一样，在追问时临时授予该报告的模型（`readingEntitlements` 写法）？设计默认不授予，沿用套餐授权。
4. **结果页摘要卡**：接受以「类型 · 关键结论」标题替代现有摘要卡（推荐，不 fork 模板），还是 fork 模板临时上下文页以保留完整摘要卡？
5. **开场推荐问题文案**：静态问题的具体措辞（四种语言 × 各详批类型）由实施者起草，是否需要使用者逐条审定后再上线？
6. **隐私政策**：模板 0.3.1 要求说明「反馈时可共享被评回复及之前 3 条消息」；另需说明报告追问会把报告内容作为对话上下文发送给模型服务商。正文措辞需使用者确认。

## 决策记录（2026-11-13，使用者确认）

使用者审阅后确认：本 change 的 Open Questions 全部采用设计中的默认/推荐方案；需要使用者审阅的文案与样例按本 change 的默认方案执行，上线前的验收截图仍按 tasks 留证。
