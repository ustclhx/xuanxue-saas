# Design

## Context

### 现状：模型实际拿到的数据（`apps/web/src/features/readings/catalog.ts`）

用户消息只有 `JSON.stringify({ kind, chart: recomputed.result })`，system 为固定前缀（Anthropic 缓存标记）。各详批的 `result`：

| 详批（语言 / 当前版本） | 进入提示词的数据 | 缺口 |
|---|---|---|
| bazi-full（zh-Hant v2、zh-Hans v3）、saju-full（ko v2） | `chartSummary`：四柱干支 + 天干十神 + 藏干十神、日主、身强弱与五行比例、喜忌五行、十步大运（干支、天干十神、起止年、起运岁数）、`currentYear`（当年干支 + 天干十神 + 所在大运序号）、神煞 key | 无逐年流年（引擎 `fortune.decades[].years` 已有干支与天干十神，被摘要丢弃）；流年地支藏干十神、流年与本命 / 大运的合冲刑、值太岁 / 冲太岁、流年与大运五行喜忌均未计算；大运缺地支十神与喜忌；神煞无所在柱 |
| ziwei-full（zh-Hant v2、zh-Hans v3） | `ziweiSummary`：五行局、命宫 / 身宫地支、十二宫（干支、主星、亮度、生年四化）、生年四化（含辅星） | 无大限年龄区间与当前大限、无流年命宫与流年四化；辅星（六吉六煞）未输出；章节中也没有运限章 |
| numerology-full（en v3） | lifePath、birthday、personalYear（仅当年）、currentYear、姓名三数 | 无未来逐年个人年、无巅峰数 / 挑战数 |
| saju-compat（ko v2） | 双方 `chartSummary` + 合盘分项 | 本次不改（见 Open Questions） |
| tarot-spread（四语言 v2/v3） | 牌阵、牌位、牌义 | 与流年无关，本次不改 |

引擎可复用的能力：`packages/bazi` 的 `yearFortune`、`tenGodOf`、`hiddenStemsOf`、`compat.ts` 的 `isSixCombine / isClash / isPunish / isStemCombine / isTriad`、`shensha.ts` 的 `triadOf`；iztro 2.6.3 的 `astrolabe.horoscope(date)` 提供大限 / 流年宫位与四化，palace 的 `decadal.range` 提供大限年龄；`packages/numerology` 的 `reduceNumber`、`personalYear`。

### 其他约束

- 提示词版本是代码常量：`entries[kind].variants[locale].prompt`，各语言版本号不齐（八字繁中 v2、简中 v3）；`reading.prompt_version` 已记录版本。生成中报告的收尾（`readings.functions.ts` 读取时调用 `finalizeReading`）用的是 `readingDefinition(row.kind, row.locale)`，即「当前」定义而非生成时的版本——切换版本后会用错章节表。
- 生成走 `startWorkspaceChat` 单次流式调用，按次计费、`chargeOn: 'success'`、`acceptOutput` 检查章节齐全；`READING_MAX_OUTPUT_TOKENS = 12000`，实际取模型行 `maxOutputTokens` 的较小值（staging `deepseek-flash` 行记录为 6000，生产上线模型待定）。
- Workers：流式响应在客户端连接期间没有墙钟上限，等待模型的 I/O 不计 CPU；客户端断开后只有约 30 秒继续读取（specs/ai-chat「客户端断开不影响结算」），10 分钟未结算由 jobs 兜底按失败处理。
- 合规检查（`compliance.ts`）会整段替换「具体到月 / 日 + 断言语气」的段落；年份区间不算预言。流年章节必须避开月份级表述。
- 模板 R6（提示词评测）未发版：0.3.0 / 0.3.1 升级说明无相关内容，模板仓库 `add-ui-design-system` 明确把 R6 排除，0.4.0 草稿为分享卡片。路线约定通用能力模板优先，「通用 AI 报告模块（含分章节生成）」也已约定进模板、稍后规划。

## Goals / Non-Goals

**Goals:**
- 在不改数据库结构的前提下，为四种个人详批补齐逐年数据并上线 v4 提示词。
- 版本切换可在 60 秒内生效与回滚，已有报告与生成中报告都不受影响。
- 有一份可重复的离线评测与明确的上线门槛，模板 R6 发版后可平滑替换。

**Non-Goals:**
- 不做分章节 / 多次调用生成、不把详批移入 jobs Workflow（留给模板通用报告模块）。
- 不改塔罗与궁합提示词、不改解锁卡样例段落与报告页布局。
- 不做流月、流日（每日运势属于另一变更）。
- 不调整价格（只列为 Open Question；如需加价只改运行时设置）。

## Decisions

### 1. 逐年数据由引擎纯函数计算，详批摘要按「数据档」组装

- `packages/bazi` 新增 `annualOutlook(chart, { startYear, years })`（新文件如 `annual.ts`，从 `index.ts` 导出），复用现有合冲刑判定，返回逐年 `{ year, stem, branch, elements, stemTenGod, branchTenGods, decadeIndex, relations: [{ with: 'year'|'month'|'day'|'hour'|'decade', type: 'stemCombine'|'sixCombine'|'clash'|'punish'|'triad' }], taiSui: 'zhi'|'chong'|null, favorable: { stem, branch } }`。不改 `BaziChart` 结构与免费结果页，因此 `ENGINE_VERSION` 不变；大运地支十神、喜忌与神煞所在柱同样在新函数或摘要层计算。
- 紫微在 `ziwei.ts` 新增 `ziweiHoroscope(input, { startYear, years })`：同一 iztro 星盘取大限区间、各年 `horoscope('<year>-07-01')` 的流年命宫与流年四化（取年中日期避开农历年初边界，提示词注明流年以农历年 / 立春为界的大致对应），并补六吉六煞落宫。
- `packages/numerology` 新增 `personalYears(date, startYear, years)`、`pinnacles(date)`、`challenges(date)`。
- `catalog.ts` 的 recompute 接收「数据档」：v2/v3 定义沿用现有摘要（保证基线评测与回滚时模型看到的数据与今天完全一致），v4 定义使用扩展摘要（原摘要 + `annual` / `horoscope` / `personalYears` / `pinnacles` 字段）。`reading.engine_version` 对扩展摘要记录组合版本（如 `1.0.0+annual.1`、`numerology@2+years.1`），算法变化时递增后缀，不需迁移。
- 隐私：摘要仍不含出生日期与城市；逐年数据只含年份、干支与关系。大运起止年与岁数已在 v3 中出现，不新增可识别信息。
- 备选：把逐年关系写进 `computeChart` 输出——会改变免费结果页结构和引擎版本、增加首页包体积，否决。

### 2. 流年窗口：默认「当年起 5 年」，参数集中在一处

窗口起点取请求时的 UTC 年（与现有 `currentYear` 一致），年数为代码常量 `READING_ANNUAL_YEARS = 5`，写入 v4 提示词的「流年逐年」规则与评测样本。年数与第四季度是否顺延到下一年列为 Open Questions，改动只影响该常量、提示词与样本，不改结构。

### 3. v4 提示词：统一版本号、按语言独立文件、全文重写而非叠加

- 每种详批一个 `prompts/<kind>.v4.ts`，导出按语言的记录（同 `TAROT_SPREAD_V2` 形态），`version` 统一为 `<kind>.v4`。v1–v3 文件不改，供回滚、追溯与基线评测。
- v4 不再「在旧 system 末尾追加约束」，而是把 v1 + v2/v3 的约束整理为一份完整 system（输入字典、章节、写作要求、合规、用字与数据一致），减少重复与冲突；简中由繁中改写后人工校对，而非 OpenCC 直转。
- 章节：八字 / 사주在「未来十年大运」后加「流年逐年」（zh-Hant「流年逐年」、zh-Hans「流年逐年」、ko「연도별 세운」）；紫微加「大限與流年」（含当前大限概述 + 逐年小节）；数字命理把「Personal Year」扩为「Year by Year」（当年 + 后续四年，各一小节）。逐年小节用 `### <年份> <干支或个人年数>`，便于确定性检查与报告页目录（`markdown.tsx` 已支持三级标题）。
- 其余章节优化方向：每章要求引用至少一项具体数据（某柱十神、某宫主星、某数字）；「建议」改为 3–5 条可执行条目；「未来十年大运」聚焦大运本身，逐年内容只出现在流年章，避免重复；流年小节要求写「上半年 / 下半年」或季节，禁止具体月日（与合规检查一致）。
- 篇幅：总输出目标比 v3 增加不超过 40%，每个流年小节 1–2 段；评测量化后再定上限。

### 4. 版本选择：运行时设置 `readings.<kind>.promptVersion`

- `packages/db/src/settings.ts` 新增 `readings.<kind>.promptVersion: string`，默认值为空字符串表示「代码默认版本」（即今天线上的版本），避免设置默认值与代码注册表重复维护。
- `catalog.ts` 改为注册表：`entries[kind].versions[version][locale]`，`readingDefinition(kind, locale, { promptVersion })`；`readingConfig` 增加 `promptVersion`，生成时按设置选版本，设置值未注册或该版本不支持该语言时用默认版本并 `log.warn`。
- 后台运行时设置的详批表新增「提示词版本」选择（选项来自注册表，含「默认」），保存时校验；这是现有后台表格加一列，按约定属于小改动，不需要 ui-design 设计稿。
- 解锁卡章节目录、定价页、chat-context 等读取 `definition.prompt.sections` 的地方随所选版本变化：解锁卡与定价页需读取设置后再取定义（它们已加载 `readingConfig` / availability）。
- 收尾按记录版本：`finalizeReading` 与 `readings.functions.ts` 读取时的收尾改为 `readingDefinition(row.kind, row.locale, { promptVersion: row.promptVersion })`；找不到该版本时（理论上不会，旧版本文件永久保留）按 ready 保存原文并告警，不误判失败。
- 备选：代码常量切换——回滚需要重新部署（约 10 分钟以上并需授权），且无法在生产先由管理员预览；否决。按用户分流灰度——当前流量小、样本不足以统计，不做。

### 5. 长文生成：维持单次流式，设定观测阈值

- 估算：v3 中文报告约 4–6k 输出 token，v4 增加 5 个流年小节约 1.5–2.5k token，韩语更高；以 30–60 token/s 计约 2–4 分钟。流式期间 Workers 无墙钟限制，CPU 时间很少，单次调用可行。
- `READING_MAX_OUTPUT_TOKENS` 由评测 P95 输出 token 的 1.5 倍决定（预计 12000 足够）；同时要求所选模型行 `maxOutputTokens` 不低于该值（staging 现为 6000，需调高或换模型，列为需批准的外部动作）。
- 已知风险是用户在生成中关闭页面（只剩约 30 秒）——这是 v3 已有问题，v4 时长增加会放大。本变更不改该行为，只记录观测指标：`readings.sections_incomplete` 与失败率。若上线后两周内 v4 失败率比 v3 高 3 个百分点以上，或评测 P95 时长超过 240 秒，则向模板提出通用报告模块（分章节 + Workflow 持久生成）的需求，而不是在项目内自建。
- 备选：项目内拆成「主体 + 流年」两次调用——要改计费（一次预扣两次调用）、续写与章节检查，与模板将来的报告模块冲突，否决。

### 6. 评测：项目内最小脚本，接口按 R6 设计以便替换

- 位置：`apps/web/scripts/eval-readings/`（项目自有目录），根 `package.json` 增加 `eval:readings`；不在 `pnpm test` 中运行。脚本内的纯函数（检查器、汇总）有单元测试并进入 `pnpm test`，用录制样本离线验证。
- 结构：`suites/<kind>.<locale>.json`（虚构输入 + 期望约束：窗口年份、长度区间），运行器调用 `readingDefinition(...).recompute` 与 `readingMessages` 组装与线上完全相同的消息，再经 `@xuanxue/ai` 的文本模型工厂按模型 key 调用（读取本地 `.dev.vars` 的服务商密钥）。
- 模式：`--recorded`（默认，读 `EVIDENCE_DIR/eval-readings/recordings/`，不存在则跳过并提示先录制）与 `--live --max-calls N --max-usd X`（按模型行定价估算，超过即停）。`--record` 把真实输出保存为录制，供后续离线复跑检查器与评委。
- 检查器：章节（复用 `missingSections`）、流年小节年份集合、字符数区间、`checkCompliance` 命中数、繁简字形（复用 `hant-chars` 表，zh-Hans 反向检查）、夹杂拉丁字母、健康就医提示、年份干支 / 个人年数与 JSON 一致（正则抽取后比对）。
- 评委：`--judge <modelKey>`，评分标准 `rubric.<locale>.md`（数据准确、个性化与具体程度、可执行性、语气与合规、可读性，各 1–5 分），输出 JSON 分数与理由；评委模型应与生成模型不同。
- 输出：`EVIDENCE_DIR/eval-readings/<时间戳>/`，含每份正文、检查结果、评委打分、`summary.md`（基线 vs 候选的通过率、维度均值与差值、P50/P95 输出 token 与时长）。
- 模板 R6 发版后：按其升级说明把套件与评分标准迁过去，删除项目脚本（tasks 中留一项跟进）。

### 7. 上线门槛

| 门槛 | 标准 |
|---|---|
| 样本量 | 每种详批 × 每种语言至少 8 个样本（6 种组合：八字 Hant / Hans、사주 ko、紫微 Hant / Hans、数字 en），v3 与 v4 各跑一次 |
| 确定性检查 | v4 硬性检查 100% 通过（章节、流年年份、就医提示、合规命中 0、字形） |
| 评委 | 各维度均值 ≥ v3；「数据准确」均值 ≥ 4.0 |
| 长度 / 时长 | P95 输出 token ≤ 生效上限的 70%；P95 时长 ≤ 240 秒 |
| 人工 | 使用者审阅每个组合至少 2 份 v4 样例（含 1 份不知道时辰或大师数边界），书面确认 |
| staging | 真实链路每个组合至少 1 份生成成功、扣费正确、报告页目录含逐年小节 |

## Risks / Trade-offs

- [流年年份边界：干支以立春换年，个人年以公历换年] → 提示词说明以立春 / 农历年为界的大致对应；评测样本包含 1–2 月请求日期。
- [逐年数据让模型「断言」某年发生某事] → 提示词限定只写倾向与可把握方向，合规检查兜底；评测把合规命中计为硬性失败。
- [输出变长导致截断或关闭页面失败] → 输出上限按 P95 设定、章节不全全额退款（现有规则）；按决策 5 的阈值观测。
- [运行时设置与注册表不一致] → 后台保存校验 + 运行时回退默认版本并告警。
- [评测费用] → 默认离线；真实调用需开关与预算上限，并先由使用者批准预算。
- [与每日运势变更同时改 `packages/bazi/src/index.ts`] → 新功能放独立文件，`index.ts` 只增加导出行，合并冲突易解。

## Migration Plan

1. 合入引擎与摘要（不影响线上：默认版本未变，v2/v3 仍用旧摘要）。
2. 合入 v4 提示词与版本设置（默认空 = 旧版本，线上无变化）。
3. 本地 / staging 跑评测并录制，使用者审阅样例，确认门槛。
4. 需批准：调整 staging 模型行 `maxOutputTokens`（如需要），staging 切换 `readings.<kind>.promptVersion = <kind>.v4` 做真实链路验收。
5. 需批准：生产同样切换（逐个详批切换，可先切八字）。
6. 回滚：把对应设置改回空字符串，60 秒内生效；代码无需回退。

## Open Questions

1. 流年覆盖年数：3 / 5 / 10 年？默认按 5 年设计（当年起）。
2. 第四季度生成时窗口是否从下一年开始（例如 11 月起改为「明年起 5 年」，当年只在概述中提及）？
3. v4 是否加价（如 100 → 150 积分），还是作为现有价格的内容升级？加价只改运行时设置，但定价页 / 解锁卡的估价会随之变化。
4. 궁합（saju-compat）是否在下一轮加入「两人未来几年关系流年」？本次不做。
5. 生产上线模型尚未选定（docs/v1-decisions D1）：评测基线与门槛以哪个模型为准？默认用 staging 当前模型并在换模型时重跑评测。
6. 评委模型选哪一个、单次评测预算上限多少（建议首轮 ≤ 10 USD）？
