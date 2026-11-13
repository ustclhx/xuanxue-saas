# Tasks

> **执行约定**
> - **负责人**：【Claude】复杂开发、设计敏感项、评审；【Codex】简单改动、浏览器核对、部署；【用户】决策与批准；【协调者】合并、归档与规格衔接。
> - **波次与 worktree**：组 1 先行；组 2、组 3 为波次 A（两个并行 worktree）；组 4、5、6 为波次 B（三个并行 worktree，均在组 2 合并后开始）；组 7 为集成验收；组 8 在下一次发布时执行。每组一个 worktree、一个 PR。
> - **无数据库迁移**：使用模板已移植的 `ai_conversation.subject_type/subject_id` 与 `ai_message_feedback`；不写 staging / production 数据库。
> - **共享文件**：遵守 `docs/09-parallel-plan.md` §3 与 `docs/10-v1-plan.md` §3。文案只新建按功能拆分的文件（`subject-readings.json`、`chat-cost.json`、`readings-chat.json`），不改 `readings.json`、`ai-chat.json`。本 change 内已知冲突点：`features/ai/chat-page.tsx`（组 3 与组 4，组 4 后合并并 rebase）；与其他 change 的冲突点：`features/readings/report-page.tsx`（阅读器 / PDF / UI 规范清零类 change）、`template.config.ts`、`features/ai/subject-providers.ts` 与 `content/legal/*/privacy.mdx`（`add-birth-profiles-daily-horoscope` 也注册 `daily` 类型并修改隐私政策：`subject-providers.ts` 只放各自一行注册调用，冲突时保留两边；隐私政策各写独立小节）。
> - **模板文件**：`subject-*.ts(x)`、`follow-ups.server.ts`、`packages/ui` 组件不修改；确需改动时复制到项目目录并登记 `docs/design/forks.md`。
> - **证据**：写入 `EVIDENCE_DIR`（仓库外）；部署与生产相关的验收不在 PR 中预先勾选。

## 1. 决策与设计稿

- [ ] 1.1 【用户】答复 design.md Open Questions 1–5（追问计费方式、`followUps.charge` 与 `modelKey`、是否为报告购买者授予报告模型、结果页摘要卡是否 fork、开场问题是否逐条审定）。验证：答复记录在本 change 的 design.md（由协调者更新 Open Questions 为 Decisions）；若 Q1 选择「附赠免费追问」，协调者另开 change，本 change 范围不变
- [ ] 1.2 【Claude】用 `ui-design` 技能产出报告页追问区设计稿（两站、桌面 1440 与手机 390、浅色与深色；含开场推荐问题、对话中、无可用模型空态、余额不足三种状态，以及输入区的预计消耗与余额），经使用者确认后保存离线副本并登记原型索引。验证：`docs/design/prototypes/` 有副本且索引已登记，使用者确认记录在 PR 描述中

## 2. 波次 A-1：对象类型注册与推荐问题（依赖：无）

- [x] 2.1 【Claude】新增 `features/readings/follow-up-questions.ts`：按「详批类型 × 语言」（bazi-full、ziwei-full：zh-Hant / zh-Hans；saju-full、saju-compat：ko；numerology-full：en；tarot-spread：en / zh-Hant / zh-Hans / ko）各提供 3 个开场问题，按 1.1 Q5 的结论交使用者审定。验证：单元测试断言 `catalog` 中每个 `kind × locale` 都有 3 条、长度 ≤ 200，且全部通过 `readings/compliance.ts` 的 `checkCompliance`
- [x] 2.2 【Claude】新增 `features/readings/subjects.ts`，实现 `reading` provider（`resolve` 同时校验 `workspaceId`、`userId` 与 `status = 'ready'`；`title`、`defaultModelKey = reading.modelKey`、按报告语言的 `suggestions`；`context()` 返回 design 决策 3 的 `reading-v1` 上下文，不含出生输入）与 `chart-result` 类型（无 `resolve`）及其上下文构造函数（决策 2，`chart-result-v1`，标题为「类型 · 关键结论」≤ 200 字符）；四种语言的来源标签放 `messages/<locale>/subject-readings.json`。在 `features/ai/subject-providers.ts` 中注册两种类型。验证：集成测试覆盖本人 ready 报告可解析、他人报告 / 他空间 / generating / failed / 不存在一律为 null；`startSubjectConversation` 写入的首条 system 消息以 `[context type=reading version=reading-v1]` 开头且不含出生日期；`subject-context.providers.test.ts` 通过
- [x] 2.3 【Claude】`chart-result` 上下文与旧 `contextSystemText` 的口径对照：说明文字保留合规边界与「用用户语言作答」，JSON 只含 `{ kind, result }`。验证：单元测试对八字、紫微、塔罗三种复算结果断言上下文通过 `subjectSystemContextSchema`、不含姓名与出生字段；`pnpm check`、`pnpm typecheck` 通过

## 3. 波次 A-2：预计消耗改用模板组件（依赖：无）

- [x] 3.1 【Codex】新增 `features/ai/chat-cost.functions.ts` 的 `getChatCostContext({ slug, conversationId? })`：经 `withWorkspace` 鉴权，返回 `availableCredits`（`getCreditBalance`）与首条 system 消息的文本长度 `prefixChars`（只返回长度，他人对话按 404）。验证：集成测试覆盖无对话为 0、旧带盘对话与对象对话返回正确长度、他人对话 404
- [x] 3.2 【Codex】新增 `features/ai/chat-cost.tsx`：用 `typicalMessageEstimate` 计算区间（输入 token 计入 `prefixChars`），渲染 `@xuanxue/ui` 的 `CreditEstimate`（预计 · 余额，预计上限 > 余额时 `insufficient`）；挂载时读取一次，每轮回复结束后刷新一次，不轮询；文案放 `messages/<locale>/chat-cost.json`（四种语言）。验证：组件测试覆盖充足、不足（`data-insufficient` 与图标）、读取失败时只显示预计不显示余额
- [x] 3.3 【Codex】`chat-page.tsx` 把 `ChatCostHint` 换成 `ChatCost`，删除估算中对 `chatContext` 的引用（`chatContext` 属性与摘要显示留给组 4）；`model-picker.tsx` 删除 `ChatCostHint` 与无调用方的 `CreditEstimateText`，同步更新 `model-picker.test.tsx` 与依赖 `chat-cost-*` testid 的 e2e。验证：`pnpm check`（含 `check:ui`）、`pnpm typecheck`、`pnpm test` 通过；本地对话页输入框旁显示「预计 · 余额」
- [ ] 3.4 【Codex】余额不足弹窗验收：在对话页与（组 5 合并后的）嵌入对话中，余额低于最低预扣时发送消息，弹出 `InsufficientCreditsDialog` 并显示预计消耗与余额，「购买积分包」跳到账单页积分包区。验证：本地 e2e 或浏览器截图存入证据目录

## 4. 波次 B-1：结果页入口迁移与过渡兼容（依赖：组 2；chat-page.tsx 在组 3 之后 rebase）

- [x] 4.1 【Claude】`createChatContextLink` 改用 `issueSubjectContext`（`chart-result`、个人空间、标题与开场问题），返回 `/app/<slug>/chat/context?token=`；保留复算、`safeReturnPath`、`login` / `unavailable` 合同与日志事件。验证：单元 / 集成测试断言返回地址格式、令牌绑定用户与空间、KV 中无出生字段；`ask-ai-entry` 的未登录回跳续接用例通过
- [x] 4.2 【Claude】新增 `features/ai/legacy-chat-context.ts`：保留旧令牌验签与旧 KV 读取（只读）、旧 system 片段解析；`routes/app/$slug/chat/index.tsx` 的 `?context=` 分支改为 `upgradeLegacyChatContext`——有效时换发新令牌并重定向到 `/chat/context?token=`，过期 / 无效时渲染模板 `TemporarySubjectChat` 的对应状态。代码与 PR 描述注明「下一次发布删除换发逻辑」（组 8）。验证：集成测试用旧 `issueChatContext` 生成令牌，断言有效时重定向且新令牌可建对话、过期时显示返回原页、他人令牌显示无效
- [x] 4.3 【Claude】旧对话摘要：`ChatContextSummary` 与解析函数移入 `legacy-chat-context.ts` / `chat-context-summary.ts`，由 `routes/app/$slug/chat/$conversationId.tsx` 在 `ChatPage` 之上渲染；删除 `ChatPage` 的 `chatContext` 属性。验证：组件测试用带 `data-chat-context` 的旧 system parts 断言摘要显示；新对象对话不显示旧摘要
- [x] 4.4 【Claude】删除 `chat-context.ts` 的签发与 `contextMessageParts`、`chat-context.functions.ts#getChatContext`、`chat-context-start.tsx`、`createConversation` 的 `context` 参数与 `CHAT_CONTEXT_EXPIRED` 分支，更新 `chat-context.test.ts`、`test/fixtures/ai-chat.suite.ts`。验证：`grep -rn "chat?context=\|issueChatContext\|createConversation({ data: { slug, context" apps/web/src` 只剩兼容入口；`pnpm check`、`pnpm typecheck`、`pnpm check:deps`、`pnpm test` 通过
- [x] 4.5 【Claude】更新 `e2e/ai-chat.spec.ts` 结果页带盘用例：地址为 `/chat/context?token=`、标题区显示「类型 · 关键结论」、点击开场问题后建对话并收到引用命盘的回复、对话列表显示「结果」标签；另加篡改令牌显示无效的用例。验证：本地 `pnpm --filter @xuanxue/web test:e2e -- ai-chat` 通过

## 5. 波次 B-2：报告页内追问（依赖：组 2、1.2 设计稿确认；1.1 Q3）

- [x] 5.1 【Claude】按 1.2 设计稿在 `report-page.tsx` 中于 ready 状态的正文之后懒加载 `<SubjectChat slug subjectType="reading" subjectId={view.id} />`（`print:hidden`，生成中不渲染，轮询转为 ready 后出现）；区块标题等文案放 `messages/<locale>/readings-chat.json`。若 1.1 Q3 选择授予报告模型，按 `generate.ts#readingEntitlements` 写法仅在报告对话中加入 `reading.modelKey`。验证：`report-page.test.tsx` 覆盖 ready 显示、generating / failed 不显示；`pnpm check:ui` 无新增例外；`check-home-bundle` 通过
- [x] 5.2 【Claude】删除报告时清除追问：`deleteReadingWithContent` 同一事务内清空 `subject_type='reading'` 且 `subject_id=<报告 id>` 的对话消息正文与标题、置为归档、删除其 `ai_message_feedback`；对话列表（含已归档）排除报告已不存在的报告对话。验证：集成测试建报告 + 两段追问 + 一条反馈后删除报告，断言消息 `parts` 为空、反馈已删、`listConversations` 两个列表都不含这两段对话、积分流水不变
- [x] 5.3 【Claude】报告追问 e2e（离线模型）：打开 ready 报告 → 追问区显示该类型的开场问题 → 点击后收到回复并扣积分 → 刷新后仍在同一对话 → 另一账号以同一报告 ID 请求对象对话得到 404 → 无可用模型的账号看到空态与购买入口、报告正文正常。验证：本地 e2e 通过，手机 390 与桌面 1440 截图存入证据目录（实施记录：`e2e/reading-chat.spec.ts` 拦截 `POST /api/ai/chat` 返回模拟流，扣积分与上下文写入由 `test/readings-subjects.test.ts`、`test/ai-subject-chat.test.ts` 覆盖；他人 404 在 e2e 中为打开报告页 404，对象对话接口的 404 由 `test/readings-subjects.test.ts` 覆盖）

## 6. 波次 B-3：推荐追问、评分与隐私说明（依赖：1.1 Q2；可与组 4、5 并行）

- [ ] 6.1 【Codex】`template.config.ts` 设置 `ai.text.followUps`（`enabled: true`，`count: 3`，`charge` 与 `modelKey` 按 1.1 Q2）。验证：`pnpm typecheck` 通过；本地对话一轮后显示 3 个推荐问题，点击即发送且刷新后历史中没有推荐问题本身；模型故障注入下回复正常、不显示推荐区
- [ ] 6.2 【Codex】评分与反馈验收（模板已接线，项目不改代码）：在对话页与报告追问中依次点赞、改点踩选原因并勾选共享、撤销，后台 `/admin/feedback` 统计与原因筛选随之变化，共享查看只显示被评回复与之前最多 3 条消息、不含报告上下文，且写审计。验证：浏览器截图与审计记录存入证据目录
- [x] 6.3 【Claude】隐私政策（`content/legal/{east/zh-Hant,east/zh-Hans,east/ko,west/en}/privacy.mdx`）补充：反馈共享（逐条同意、可撤回、保留期随对话删除）；报告追问会把报告内容作为上下文发送给模型服务商；删除报告会一并清除追问内容。措辞经使用者确认（Open Questions 6）。验证：四个语言版本内容一致，`pnpm build` 预渲染通过，使用者确认记录在 PR 描述中

## 7. 集成验收（依赖：组 2–6 全部合并）

- [ ] 7.1 【Codex】staging 验收（合并后 CI 自动发布 staging）：发布前在 staging 生成一个旧 `?context=` 地址，发布后 30 分钟内打开应跳到新地址并可对话；新结果页入口、报告追问、越权 404、推荐追问、评分与共享、预计消耗与余额不足弹窗逐项通过；两站四种语言各抽查一份报告的开场问题语言正确。验证：验收记录与截图存入证据目录，`/api/health` 为本次 SHA
- [ ] 7.2 【用户】批准 production 发布（推 `v*` tag）。发布前只读核对：后台对话模型可用、套餐 `features.models` 覆盖各详批的默认模型（不一致时记录回落行为）。验证：production `/api/health` 为本次 SHA，用真实账号对一份已有报告追问一次并核对扣费；main 的发布流水线成功
- [ ] 7.3 【协调者】规格衔接：确认 `product-improve-ai-content-20261030` 已先归档，再按 design 决策 9 把本 change 中「结果页上下文经临时上下文令牌进入对话」「预计消耗与余额提示」改写为对「从结果页携带命盘上下文」「发送前显示预计消耗」的 MODIFIED（或归档后删除被取代的旧要求），然后归档本 change。验证：`openspec validate --strict` 通过，主规格 `ai-chat` 中无重复要求

## 8. 下一次发布：移除旧链接兼容（依赖：7.2 发布至少 30 分钟后的下一个版本）

- [ ] 8.1 【Codex】删除 `legacy-chat-context.ts` 中的旧令牌验签、旧 KV 读取与 `upgradeLegacyChatContext`，`chat/index.tsx` 去掉 `?context=` 分支；保留旧对话摘要解析。验证：旧链接相关测试改为断言 `?context=` 被忽略（显示对话列表）；`pnpm test` 与 e2e 通过；旧对话摘要用例仍通过
