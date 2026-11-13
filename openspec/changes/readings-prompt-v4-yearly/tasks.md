# Tasks

> **执行约定**
> - **负责人标注**：【Claude】复杂开发、提示词撰写、评审；【Codex】简单改动、浏览器核对、部署；【用户】决策与批准。
> - **波次**：组 2 为波次 A（2.1–2.4 与 2.6 可并行，2.5 依赖 2.4 的接口），组 3 为波次 B（依赖 A 全部合并；3.1 先合并，3.2–3.4 再按详批分 3 个 worktree 并行），组 4 为评测与上线（顺序执行）。每个 worktree 一个 PR。
> - **无数据库迁移**；新增运行时设置只有代码默认值。不新增 npm 依赖。
> - **共享文件冲突点**：`apps/web/src/features/readings/catalog.ts`（2.4 改结构，3.1 加数据档，3.2–3.4 各自只追加本详批的版本注册行，按合并顺序 rebase）；`packages/bazi/src/index.ts`（2.1 只追加导出行，可能与每日运势类变更同时修改）；`packages/db/src/settings.ts`（模板文件中的项目区段，只改 `ReadingSettingValues` 与其默认值）；根 `package.json`（2.5 只加 `eval:readings` 一行）。
> - **证据**：评测输出与样例写入 `EVIDENCE_DIR`，存在仓库外；PR 只引用。staging / 生产切换、模型行调整、真实模型费用为外部动作，须使用者批准，不在 PR 中预先勾选。
> - **不改**：塔罗与궁합提示词、解锁卡样例段落、报告页布局。

## 1. 决策与批准（不改代码）

- [ ] 1.1 【用户】回答 design.md Open Questions 1–3（流年年数、第四季度是否顺延、是否加价）。验证：协调者把结论写回 design.md 决策 2 与 Open Questions，若年数不是 5 则同步更新 3.x 与评测样本的窗口
- [ ] 1.2 【用户】批准评测预算与评委模型（Open Questions 5–6，建议首轮真实调用 ≤ 10 USD）。验证：预算与模型 key 记录在本 change 的 design.md

## 2. 波次 A：引擎数据、版本注册与评测骨架（并行 worktree）

- [x] 2.1 【Claude】`packages/bazi` 新增流年窗口函数（独立文件，`index.ts` 只加导出）：逐年干支与五行、天干十神与地支藏干十神、所属大运、与本命四柱及当步大运的天干五合 / 六合 / 冲 / 刑 / 三合、值太岁 / 冲太岁、喜忌标记；大运地支本气十神与喜忌；神煞所在柱。复用 `compat.ts` 与 `shensha.ts` 判定，不改 `computeChart` 输出与 `ENGINE_VERSION`。验证：vitest 覆盖 spec 场景（冲太岁、窗口内换运、无时辰不含时柱、大运喜忌），并与 `lunar-javascript`（devDependency）抽样比对流年干支；`pnpm --filter @xuanxue/bazi test`、`pnpm check:deps` 通过
- [x] 2.2 【Claude】`packages/bazi/src/ziwei.ts` 新增紫微运限函数：十二宫大限年龄区间、当前与下一步大限、窗口内逐年流年命宫与流年四化（iztro `horoscope`，取年中日期）、六吉六煞落宫；不改 `computeZiwei` 现有输出。验证：vitest 用固定虚构命盘断言大限区间连续覆盖、流年四化星曜与该年天干一致、无时辰仍返回 `requiresHour`；`apps/web/scripts/check-bazi-build.mjs` 与首页包检查不因此失败
- [x] 2.3 【Codex】`packages/numerology` 新增 `personalYears`、`pinnacles`、`challenges`（大师数规则与生命灵数一致）。验证：`numerology.test.ts` 覆盖连续五年序列与单年个人年一致、第一巅峰止于 36 减生命灵数单数、大师数巅峰保留 11 / 22、挑战数为 0–8
- [x] 2.4 【Claude】提示词版本注册与运行时切换：
  - `catalog.ts` 改为 `kind → version → locale` 注册表，`readingDefinition(kind, locale, { promptVersion })`，未指定时为当前默认版本（行为与今天一致）；
  - `packages/db/src/settings.ts` 新增 `readings.<kind>.promptVersion`（默认空字符串 = 代码默认版本）；`readingConfig` 读取该值，非法值回退默认并 `log.warn`；
  - `generate.ts` 按设置选版本；`finalizeReading` 与 `readings.functions.ts` 读取时的收尾、`chat-context.functions.ts` 按报告记录的 `promptVersion` 取定义；
  - 解锁卡章节目录与定价页按当前设置的版本取 `sections`；
  - 后台详批设置表新增「提示词版本」选择（选项来自注册表，含「默认」），保存时校验；四语言后台文案。

  验证：单测覆盖「设置 v3 → 生成记录 v3」「非法值回退默认并告警」「生成中切换版本后收尾按记录版本、报告 ready」「幂等窗口内切换仍返回已有报告」「后台拒绝未注册版本」；现有 `catalog.test.ts`、`readings-ui.test.ts` 不改断言即通过（默认版本未变）
- [x] 2.5 【Claude】评测骨架 `apps/web/scripts/eval-readings/`（依赖 2.4 的 `readingDefinition` 接口，可先按约定签名开发、2.4 合并后 rebase）：
  - 运行器：读取套件 → `recompute` + `readingMessages` 组装与线上一致的消息 → 录制 / 真实调用；
  - 真实调用经 `@xuanxue/ai` 按模型 key，`--live` 必须同时给 `--max-calls` 与 `--max-usd`，超限即停；
  - 检查器：章节、流年年份集合、长度区间、`checkCompliance` 命中、繁简字形、夹杂拉丁字母、就医提示、年份干支 / 个人年数一致；
  - 评委：`--judge <modelKey>`，`rubric.<locale>.md` 五个维度；
  - 汇总：基线 vs 候选的通过率、维度均值与差值、P50 / P95 输出 token 与时长，输出到 `EVIDENCE_DIR/eval-readings/<时间戳>/`；
  - 根 `package.json` 增加 `eval:readings`，不进入 `pnpm test`。

  验证：检查器与汇总的单测（用仓库内少量虚构录制文本）进入 `pnpm test`；无 `--live` 时断言不发起网络请求；`--live` 缺预算参数时退出非零；`git status` 确认运行后仓库内无新文件
- [x] 2.6 【Codex】新增项目运行手册 `docs/runbooks/readings-prompt-release.md`：评测命令、上线门槛（design 决策 7）、staging / 生产切换与回滚步骤、观测指标（`readings.sections_incomplete`、失败率阈值）。验证：文档链接到本 change 的 design.md 与 `docs/runbooks/evidence/readings/` 旧抽检记录；`pnpm check` 通过

## 3. 波次 B：v4 数据档与提示词（3.1 先合并，3.2–3.4 并行）

- [x] 3.1 【Claude】`catalog.ts` 的 recompute 支持数据档：v1–v3 版本沿用现有 `chartSummary` / `ziweiSummary` / 数字摘要（逐字段不变），v4 使用扩展摘要（`annual`、大运补充、`horoscope`、六吉六煞、`personalYears`、`pinnacles`、`challenges`）；窗口常量 `READING_ANNUAL_YEARS`；`engine_version` 记录组合版本。验证：快照测试断言旧版本摘要与改动前一致；v4 摘要含窗口内全部年份、不含出生日期与城市；同一输入两次复算结果一致
- [ ] 3.2 【Claude】八字 / 사주 v4：`prompts/bazi-full.v4.ts`（zh-Hant、zh-Hans）与 `prompts/saju-full.v4.ts`（ko），整理 v1–v3 约束为完整 system，新增「流年逐年 / 연도별 세운」章节（`### <年份> <干支>` 小节、上下半年表述、禁止月日），按 design 决策 3 优化其余章节；在注册表登记 v4（不改默认版本）。验证：`catalog.test.ts` 新增断言 v4 章节表、system 不含用户内容、样例段落仍通过合规；评测录制模式下 2 个样本通过全部确定性检查
- [ ] 3.3 【Claude】紫微 v4：`prompts/ziwei-full.v4.ts`（zh-Hant、zh-Hans），新增「大限與流年 / 大限与流年」章节，引用大限宫位、流年命宫与流年四化，补辅星解读规则。验证：同 3.2
- [ ] 3.4 【Claude】数字命理 v4：`prompts/numerology-full.v4.ts`（en），「Personal Year」扩为「Year by Year」（窗口内每年一个小节），Core Numbers 加入巅峰数与挑战数。验证：同 3.2，并断言个人年数值与 JSON 一致的检查器通过

## 4. 评测、审阅与上线（顺序执行）

- [ ] 4.1 【Claude】编写样本套件：6 个「详批 × 语言」组合各 ≥ 8 个虚构样本（身强 / 身弱、不知道时辰、窗口内换大运、冲太岁、紫微空宫、大师数个人年与巅峰数、1–2 月请求日期）。验证：套件文件进仓库（只含虚构输入）；离线模式运行器能加载全部样本
- [ ] 4.2 【Claude，需 1.2 批准】在本地以 `--live --record` 跑 v3 基线与 v4 候选，开启评委，生成对比汇总。验证：`EVIDENCE_DIR/eval-readings/<时间戳>/summary.md` 存在，实际费用不超过批准预算；对照 design 决策 7 列出每项门槛是否达成
- [ ] 4.3 【Claude】按评测结果修订提示词：未达门槛时新建 `*.v5` 而不是改已录制评测的 v4 文件（v4 尚未上线时可直接改 v4 并重跑，以未进生产为准）；按 P95 输出 token 调整 `READING_MAX_OUTPUT_TOKENS`。验证：重跑 4.2 达到门槛
- [ ] 4.4 【用户】审阅每个组合至少 2 份 v4 样例（含边界样本），书面确认或提出修改。验证：确认记录在项目私有验收记录
- [ ] 4.5 【Codex，需用户批准】staging：如模型行 `maxOutputTokens` 低于 4.3 的上限则调高；后台把 4 种详批（八字、사주、紫微、数字命理；按语言共 6 个组合）的提示词版本切到 v4；每个组合用测试账号真实生成 1 份。验证：报告 ready、扣费等于设置积分、报告页目录含逐年小节、`reading.prompt_version` 为 v4；再切回默认并确认新报告恢复 v3、已生成 v4 报告不变
- [ ] 4.6 【用户批准 → Codex】生产逐个详批切换到 v4（建议先八字 zh-Hant），观察两周 `readings.sections_incomplete` 与失败率；超过 design 决策 5 阈值时切回并向模板提出通用报告模块需求。验证：切换记录、观测数据与（如有）回滚记录写入私有验收记录
- [ ] 4.7 【协调者】模板发布 R6 提示词评测后，按其升级说明迁移套件与评分标准并删除 `apps/web/scripts/eval-readings/`。验证：`pnpm eval:prompts`（或模板实际命令）能跑通本项目套件
