# 付费详批提示词评测套件 `readings`

`pnpm eval:prompts --suite readings`（模板 0.5.3 `packages/evals`，契约见 `docs/06-ai.md`「提示词版本与评测」
与「被评正文转换与评测后门槛」）。由 `apps/web/scripts/eval-readings/` 迁移（OpenSpec
`readings-prompt-v4-yearly` tasks 4.7）；旧脚本在新套件以重录后的录制回放全部通过之前保留。

| 文件 | 内容 |
|---|---|
| `prompts.ts` | 两个套件版本，按样本 `kind` / `locale` 分派到 catalog.ts 的真实版本，消息与线上 `readingMessages` 逐字相同 |
| `prepare.ts` | `prepareOutput`（`guard.v4`）：调用线上共用的 `deliveredReadingText`（繁中字形补正 → v4 兜底） |
| `checks.ts` | 确定性检查，自旧脚本迁移、判定不变；`length`、`latin` 保持 warn |
| `rubric.ts` | 评分标准 `r1`：五个维度（accuracy / specificity / actionability / tone / readability），1–5 分 |
| `gates.ts` | `evaluateRun`：design 决策 7 中可自动判定的门槛 |
| `samples.json` | 48 个虚构样本（6 个组合 × 8），不含真实用户数据 |
| `prompts.lock.json` | 版本锁，运行时自动追加 |
| `recordings/` | 生成录制（与评委录制，重录后） |
| `readings.test.ts` | 离线单测：`pnpm test:evals`（含 `evals/tsconfig.json` 类型检查） |

## 版本

| 套件版本 | 八字 zh-Hant | 八字 zh-Hans | 사주 ko | 紫微 zh-Hant | 紫微 zh-Hans | 数字命理 en |
|---|---|---|---|---|---|---|
| `readings@pre-v4`（基线） | bazi-full.v2 | bazi-full.v3 | saju-full.v2 | ziwei-full.v2 | ziwei-full.v3 | numerology-full.v3 |
| `readings@v4`（候选） | bazi-full.v4 | bazi-full.v4 | saju-full.v4 | ziwei-full.v4 | ziwei-full.v4 | numerology-full.v4 |

基线是 v4 之前的代码默认版本，保留真实版本号；报告中每个样本的真实版本见 `prepared.annotations.promptVersion`。
新增 v5 时在 `prompts.ts` 加一个套件版本（`readings@v5`），不要修改已有版本。

## 样本输入

`{ kind, locale, requestDate, request, data, preV4Fields? }`：`request` 是与前台提交相同的原始输入，
`requestDate` 固定流年窗口起点（取其 UTC 年，不读当前时间）。生成时按所评版本的数据档现场复算（与线上一致）。
`data` 是 v4 数据档的复算结果、`preV4Fields` 是旧数据档中不同的顶层字段（八字 / 사주的 `shensha`），
只为评委核对「数据准确」而放入样本：模板评委只看得到样本输入，看不到提示词里的数据。
单测断言二者与复算结果一致；引擎输出一变，版本锁会报输入或渲染变化，需要新增样本 ID 或新版本。

## 门槛（`gates.ts`）

整批（48 个样本合并）口径，与旧脚本 `summarize` 相同；逐组合判定需使用者另行确认，未采用。
任一样本缺值（评委未评分、录制缺失、缺 `durationMs`）即 `incomplete`，不在缩小的分母上求均值。

| 门槛 ID | 标准 |
|---|---|
| `coverage` | 未筛选运行，6 个组合各 ≥ 8 个样本 |
| `versions` | 候选 `readings@v4`、基线 `readings@pre-v4` |
| `hard-checks` | 候选全部 error 级检查 100% 通过 |
| `judge-<维度>-vs-baseline` | 候选各维度均值 ≥ 基线 − 0.1（浮点余量 1e-9） |
| `judge-accuracy-min` | 候选 accuracy 均值 ≥ 4.0 |
| `p95-output-tokens` | 候选 P95 输出 token ≤ 12000 × 70% = 8400 |
| `p95-duration` | 候选 P95 生成时长 ≤ 240 秒 |
| `human-review`、`staging-acceptance` | 外部证据（tasks 4.4、4.5），评测命令不判定，始终 incomplete 且非必需 |

## 命令

```sh
EVIDENCE_DIR=<私有证据目录> pnpm eval:prompts --suite readings --baseline readings@pre-v4             # 回放 + 门槛
EVIDENCE_DIR=<私有证据目录> pnpm eval:prompts --suite readings --baseline readings@pre-v4 --no-judge  # 无评委录制时
pnpm test:evals                                                                                      # 离线单测
```

`--baseline` 的基线以回放运行，生成与评委录制都必须齐全，否则以配置错误（退出码 2）退出。
模板的 `--record` 会同时重新生成正文与评委，没有「只重录评委」的模式。

## 录制来源

| 日期 | 录制 | 来源 | 生成 / 评委模型 | 说明 |
|---|---|---|---|---|
| 2026-11-16 | `recordings/readings@v4/deepseek-flash/*.json`（48，生成） | 私有证据 `readings-prompt-v4/rev4/eval-readings/recordings/<kind>.v4/<id>.md` 与 `.meta.json`（tasks 4.3 rev4，提示词提交 e85da73d，与当前 v4 渲染相同） | deepseek-flash（thinking 关闭）/ — | 迁移 |
| 2026-11-16 | `recordings/readings@pre-v4/deepseek-flash/*.json`（48，生成） | 私有证据 `readings-prompt-v4/thinking-off/eval-readings/recordings/<真实版本>/<id>.md` 与 `.meta.json`（tasks 4.2 B 轮，提交 f24cb21f；v1–v3 提示词与数据档之后未改） | deepseek-flash（thinking 关闭）/ — | 迁移 |

迁移规则：`output` 为旧录制的模型原文；`usage`、`durationMs` 取自旧 `.meta.json`（旧脚本在真实调用中实测，
并与同次运行目录的 `.check.json` 逐项核对一致）；`recordedAt` 为该样本所在运行目录名的时间（进程开始时间，UTC）；
`renderedHash` 为当前渲染摘要；旧录制没有保存结束原因，`finishReason` 记为 `unknown`（回放归为 `other`）。
旧评委分数来自旧评分标准与旧评委提示词，**未迁移**为评委录制；评委需用 `--record` 重录。

## 样本说明

| 样本 | 组合 | 说明 |
|---|---|---|
| `bazi-hant-01` | bazi-full.zh-Hant | 虚构：男，有时辰，年中请求 |
| `bazi-hant-02` | bazi-full.zh-Hant | 虚构：女，不知道时辰，1 月请求（立春前） |
| `bazi-hant-03` | bazi-full.zh-Hant | 虚构：女，身弱，23 点子时边界，窗口内换大运且冲太岁 |
| `bazi-hant-04` | bazi-full.zh-Hant | 虚构：男，身弱，窗口内换大运且值太岁，2 月立春后请求 |
| `bazi-hant-05` | bazi-full.zh-Hant | 虚构：男，不知道时辰，第四季度请求 |
| `bazi-hant-06` | bazi-full.zh-Hant | 虚构：男，农历输入，3 月请求 |
| `bazi-hant-07` | bazi-full.zh-Hant | 虚构：女，不知道时辰，12 月底请求 |
| `bazi-hant-08` | bazi-full.zh-Hant | 虚构：男，手选 UTC+8 与经度，真太阳时 |
| `bazi-hans-01` | bazi-full.zh-Hans | 虚构：女，有时辰 |
| `bazi-hans-02` | bazi-full.zh-Hans | 虚构：男，不知道时辰，2 月请求 |
| `bazi-hans-03` | bazi-full.zh-Hans | 虚构：男，身强，冲太岁 |
| `bazi-hans-04` | bazi-full.zh-Hans | 虚构：女，身弱，窗口内换大运且冲太岁，1 月请求 |
| `bazi-hans-05` | bazi-full.zh-Hans | 虚构：女，不知道时辰，第四季度请求 |
| `bazi-hans-06` | bazi-full.zh-Hans | 虚构：男，身强，窗口内换大运且值太岁 |
| `bazi-hans-07` | bazi-full.zh-Hans | 虚构：女，农历闰月输入 |
| `bazi-hans-08` | bazi-full.zh-Hans | 虚构：男，年长，不知道时辰，12 月请求 |
| `saju-ko-01` | saju-full.ko | 虚构：女，有时辰 |
| `saju-ko-02` | saju-full.ko | 虚构：男，不知道时辰，1 月请求 |
| `saju-ko-03` | saju-full.ko | 虚构：女，身弱，窗口内换大运且冲太岁 |
| `saju-ko-04` | saju-full.ko | 虚构：男，身强，窗口内换大运且值太岁，2 月请求 |
| `saju-ko-05` | saju-full.ko | 虚构：女，不知道时辰，第四季度请求 |
| `saju-ko-06` | saju-full.ko | 虚构：男，음력 输入 |
| `saju-ko-07` | saju-full.ko | 虚构：女，海外出生（洛杉矶，夏令时） |
| `saju-ko-08` | saju-full.ko | 虚构：男，23 点 30 分子时边界，冲太岁 |
| `ziwei-hant-01` | ziwei-full.zh-Hant | 虚构：男 |
| `ziwei-hant-02` | ziwei-full.zh-Hant | 虚构：女，1 月请求 |
| `ziwei-hant-03` | ziwei-full.zh-Hant | 虚构：男，命宫无主星（空宫），窗口内换大限 |
| `ziwei-hant-04` | ziwei-full.zh-Hant | 虚构：女，四个空宫，窗口内换大限 |
| `ziwei-hant-05` | ziwei-full.zh-Hant | 虚构：男，无空宫 |
| `ziwei-hant-06` | ziwei-full.zh-Hant | 虚构：女，农历输入，命宫空宫 |
| `ziwei-hant-07` | ziwei-full.zh-Hant | 虚构：男，23 点后晚子时 |
| `ziwei-hant-08` | ziwei-full.zh-Hant | 虚构：女，年轻，窗口内换大限 |
| `ziwei-hans-01` | ziwei-full.zh-Hans | 虚构：女 |
| `ziwei-hans-02` | ziwei-full.zh-Hans | 虚构：男 |
| `ziwei-hans-03` | ziwei-full.zh-Hans | 虚构：女，命宫空宫，窗口内换大限 |
| `ziwei-hans-04` | ziwei-full.zh-Hans | 虚构：男，四个空宫，1 月请求 |
| `ziwei-hans-05` | ziwei-full.zh-Hans | 虚构：男，无空宫，窗口内换大限 |
| `ziwei-hans-06` | ziwei-full.zh-Hans | 虚构：女，农历闰月输入 |
| `ziwei-hans-07` | ziwei-full.zh-Hans | 虚构：男，命宫空宫，2 月请求 |
| `ziwei-hans-08` | ziwei-full.zh-Hans | 虚构：女，0 点早子时，12 月请求 |
| `numerology-en-01` | numerology-full.en | fictional: life path master number 11 |
| `numerology-en-02` | numerology-full.en | fictional: no name, January request |
| `numerology-en-03` | numerology-full.en | fictional: life path master 22, no name |
| `numerology-en-04` | numerology-full.en | fictional: life path 22 with master personal year and master pinnacle |
| `numerology-en-05` | numerology-full.en | fictional: leap-day birthday, December request |
| `numerology-en-06` | numerology-full.en | fictional: hyphen and apostrophe in name, master pinnacle |
| `numerology-en-07` | numerology-full.en | fictional: older user, challenge 0, no master numbers |
| `numerology-en-08` | numerology-full.en | fictional: life path 11, master personal year, January request |
