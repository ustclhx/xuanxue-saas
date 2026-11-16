# 详批提示词版本发布与回滚

新提示词版本（如 v4「流年逐年」）先离线评测、过上线门槛、经使用者审阅，再分别在 staging 与生产通过运行时设置切换；回滚只改设置，不需要重新部署。设计依据见 [readings-prompt-v4-yearly design](../../openspec/changes/readings-prompt-v4-yearly/design.md) 决策 4–7；上一轮人工抽检记录见 [2026-10 staging 抽检](evidence/readings/2026-10-staging-sampling.md)、[复检 r1](evidence/readings/2026-10-staging-sampling-r1.md) 与 [抽检报告正文](evidence/readings/reports/)。

评测已迁移到模板提示词评测（template 0.5.3，readings-prompt-v4-yearly tasks 4.7）。


## 1. 版本与设置

- 提示词版本是代码常量：`apps/web/src/features/readings/prompts/<kind>.vN.ts`，在 `catalog.ts` 注册表登记（kind → version → locale）。已上线或已录制评测的版本文件不再修改，改动新建下一个版本号。
- 运行时设置 `readings.<kind>.promptVersion`：空字符串表示代码默认版本（今天线上的版本）；后台「详批设置」的「提示词版本」选择只列出注册表中的版本，保存时拒绝未注册的值。
- 数据库中残留非法值时，生成使用代码默认版本并记录 `readings.prompt_version_invalid`；所选版本不支持某语言时该语言用默认版本并记录 `readings.prompt_version_fallback`。
- 设置经 KV 缓存，后台保存后清除缓存，最迟 60 秒对新请求生效。已生成的报告保留正文、`prompt_version` 与 `engine_version`，切换不会修改或重新生成；生成中的报告按其记录的版本收尾。
- v4 使用扩展数据档，`reading.engine_version` 记录组合版本（如 `1.0.0+annual.1`、`numerology@2+years.1`）。


## 2. 离线评测

评测套件在 `evals/readings/`，用模板命令 `pnpm eval:prompts`（`packages/evals`，契约见 [AI 文档](../06-ai.md)「提示词版本与评测」）运行，不进入 `pnpm test`；套件单测与类型检查为 `pnpm test:evals`。报告写入 `$EVIDENCE_DIR/prompt-evals/readings/<时间戳>-<版本>-<模式>/`（未设置时为已忽略的 `test-results/evidence/`），含 `report.json`、`report.md` 与 `outputs/`。证据只提交到项目私有验收记录，PR 只引用。

```sh
# 回放（默认，零费用）：候选 readings@v4 对同次回放的基线 readings@pre-v4，输出逐项门槛
pnpm eval:prompts --suite readings --baseline readings@pre-v4

# 录制（需使用者先批准预算）：先录基线，再录候选并同次回放基线；--record 会同时重新生成正文与评委
pnpm eval:prompts --suite readings --prompt readings@pre-v4 --record --budget-usd <美元> --concurrency 4
pnpm eval:prompts --suite readings --prompt readings@v4 --baseline readings@pre-v4 --record --budget-usd <美元> --concurrency 4
```

- 套件版本按样本的 kind / locale 分派到 `catalog.ts` 的真实版本（基线 `readings@pre-v4`：八字 / 紫微 zh-Hant v2、zh-Hans v3，사주 v2，数字命理 v3）；新版本在 `evals/readings/prompts.ts` 增加 `readings@v5` 等，不改已有版本。
- 消息组装与线上完全相同（`readingDefinition` → `recompute` → `readingMessages`）；检查与评委都评线上保存的正文（`deliveredReadingText`，`prepareOutput` 版本 `guard.v4`）。
- 真实调用经 `@xuanxue/ai` 的文本模型工厂，密钥取自根目录 `.env.local`（或环境变量），不打印；模型单价（美元 / 百万 token）写在 `evals/readings/suite.ts`。
- 评委 `deepseek-v4-pro`，评分标准 `evals/readings/rubric.ts`：数据准确、个性化与具体程度、可执行性、语气与合规、可读性，各 1–5 分。复算数据放在样本 input 中供评委核对，基线与候选共用同一份。
- 确定性检查（`evals/readings/checks.ts`）：硬性为章节齐全且有序、流年小节年份与窗口一致、年份干支 / 个人年数与数据一致、合规命中 0、繁简字形、就医提示；长度区间与夹杂拉丁字母只作提示（warn）。
- 第 3 节中可自动判定的门槛由套件 `evaluateRun`（`evals/readings/gates.ts`）整批判定，任一样本缺值即 incomplete；人工与 staging 两项只列为外部证据。


## 3. 上线门槛

| 门槛 | 标准 |
|---|---|
| 样本量 | 每种详批 × 每种语言至少 8 个样本（八字 zh-Hant / zh-Hans、사주 ko、紫微 zh-Hant / zh-Hans、数字命理 en），基线与候选各跑一次 |
| 确定性检查 | 候选硬性检查 100% 通过 |
| 评委 | 各维度均值 ≥ 基线 − 0.1（2026-11-15 使用者决定放宽，容许评委运行间波动）；「数据准确」均值 ≥ 4.0 |
| 长度 / 时长 | P95 输出 token ≤ 生效输出上限的 70%；P95 时长 ≤ 240 秒 |
| 人工 | 使用者审阅每个组合至少 2 份候选样例（含 1 份不知道时辰或大师数边界），书面确认 |
| staging | 真实链路每个组合至少 1 份生成成功、扣费正确、报告页目录含逐年小节 |

未达门槛时修订提示词：尚未进生产的版本可直接修改后重跑；已进生产的版本新建下一个版本号。按评测 P95 输出 token 的 1.5 倍复核 `READING_MAX_OUTPUT_TOKENS`，所选模型行的 `maxOutputTokens` 不得低于该值。


## 4. staging 切换（需使用者批准）

1. 确认 staging 模型行 `maxOutputTokens` 不低于输出上限，不足时先调整（外部动作，需批准）。
2. 后台「设置 → 详批设置」把对应详批的「提示词版本」改为候选版本并保存，等待 60 秒。
3. 每个组合用测试账号真实生成 1 份：报告 ready、扣费等于设置的积分、报告页目录含逐年小节、`reading.prompt_version` 为候选版本。
4. 改回「默认」，确认新报告恢复原版本、已生成的候选版本报告不变。
5. 结果与截图写入项目私有验收记录。


## 5. 生产切换与观察（需使用者批准）

1. 逐个详批切换，建议先八字 zh-Hant；每次切换记录时间、操作人与版本。
2. 观察两周：日志 `readings.sections_incomplete`（章节不全被拒收）、`readings.compliance_replaced`、`readings.prompt_version_*` 告警，以及该详批的失败率（`reading.status = 'failed'` 占比）与生成时长。
3. 若候选版本失败率比原版本高 3 个百分点以上，或评测 / 线上 P95 时长超过 240 秒：先回滚，再向模板提出通用报告模块（分章节 + Workflow 持久生成）的需求，不在项目内自建分段生成。
4. 观察数据与结论写入项目私有验收记录。


## 6. 回滚

后台把该详批的「提示词版本」改回「默认」（空字符串）或原版本号并保存，60 秒内新请求恢复；代码无需回退，已生成报告保持不变。回滚后在私有验收记录中写明原因与时间。
