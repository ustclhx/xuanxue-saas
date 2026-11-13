# 详批提示词版本发布与回滚

新提示词版本（如 v4「流年逐年」）先离线评测、过上线门槛、经使用者审阅，再分别在 staging 与生产通过运行时设置切换；回滚只改设置，不需要重新部署。设计依据见 [readings-prompt-v4-yearly design](../../openspec/changes/readings-prompt-v4-yearly/design.md) 决策 4–7；上一轮人工抽检记录见 [2026-10 staging 抽检](evidence/readings/2026-10-staging-sampling.md)、[复检 r1](evidence/readings/2026-10-staging-sampling-r1.md) 与 [抽检报告正文](evidence/readings/reports/)。

模板发布 R6 提示词评测后，按其升级说明迁移套件与评分标准，本文的评测命令随之替换。


## 1. 版本与设置

- 提示词版本是代码常量：`apps/web/src/features/readings/prompts/<kind>.vN.ts`，在 `catalog.ts` 注册表登记（kind → version → locale）。已上线或已录制评测的版本文件不再修改，改动新建下一个版本号。
- 运行时设置 `readings.<kind>.promptVersion`：空字符串表示代码默认版本（今天线上的版本）；后台「详批设置」的「提示词版本」选择只列出注册表中的版本，保存时拒绝未注册的值。
- 数据库中残留非法值时，生成使用代码默认版本并记录 `readings.prompt_version_invalid`；所选版本不支持某语言时该语言用默认版本并记录 `readings.prompt_version_fallback`。
- 设置经 KV 缓存，后台保存后清除缓存，最迟 60 秒对新请求生效。已生成的报告保留正文、`prompt_version` 与 `engine_version`，切换不会修改或重新生成；生成中的报告按其记录的版本收尾。
- v4 使用扩展数据档，`reading.engine_version` 记录组合版本（如 `1.0.0+annual.1`、`numerology@2+years.1`）。


## 2. 离线评测

评测脚本在 `apps/web/scripts/eval-readings/`，不进入 `pnpm test`；检查器与汇总的单测在 `pnpm test` 中运行。输出写入 `EVIDENCE_DIR/eval-readings/<时间戳>/`（未设置时为仓库根目录已忽略的 `test-results/evidence/`），含每份正文、`*.check.json`、`summary.md` 与 `summary.json`。证据只提交到项目私有验收记录，PR 只引用。

```sh
# 离线（默认）：读取 EVIDENCE_DIR/eval-readings/recordings/<版本>/<样本 id>.md，缺录制的样本跳过
pnpm eval:readings --candidate v4
pnpm eval:readings --kind bazi-full --locale zh-Hant --baseline default --candidate bazi-full.v4

# 真实调用（需使用者先批准预算）：必须同时给出次数与费用上限，超限即停，未运行的样本在汇总中标明
pnpm eval:readings --live --record --candidate v4 \
  --model <provider:providerModelId> --judge <provider:providerModelId> \
  --max-calls 120 --max-usd 10 --price-in <美元/1k 输入> --price-out <美元/1k 输出>
```

- 样本套件 `suites/<kind>.<locale>.json` 只含虚构输入；`requestDate` 固定流年窗口起点，覆盖 1–2 月请求、不知道时辰、窗口内换运、大师数等边界。
- 消息组装与线上完全相同（`readingDefinition` → `recompute` → `readingMessages`）。真实调用经 `@xuanxue/ai` 的文本模型工厂，服务商密钥与 Gateway 配置读取 `apps/web/.dev.vars`，不打印密钥。
- `ai_model.pricing` 以积分计价，估算费用的美元单价由 `--price-in` / `--price-out` 按服务商价目表给出；预算按「输入 token + 输出上限」最坏情况估算下一次调用。
- 评委模型应与生成模型不同，评分标准为同目录 `rubric.<locale>.md`：数据准确、个性化与具体程度、可执行性、语气与合规、可读性，各 1–5 分。
- 确定性检查：硬性为章节齐全且有序、流年小节年份与窗口一致、年份干支 / 个人年数与数据一致、合规命中 0、繁简字形、就医提示；长度区间与夹杂拉丁字母只作提示。


## 3. 上线门槛

| 门槛 | 标准 |
|---|---|
| 样本量 | 每种详批 × 每种语言至少 8 个样本（八字 zh-Hant / zh-Hans、사주 ko、紫微 zh-Hant / zh-Hans、数字命理 en），基线与候选各跑一次 |
| 确定性检查 | 候选硬性检查 100% 通过 |
| 评委 | 各维度均值不低于基线；「数据准确」均值 ≥ 4.0 |
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
