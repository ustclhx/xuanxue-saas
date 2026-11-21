# 东方站英文详批评测套件 `readings-east-en`

`pnpm eval:prompts --suite readings-east-en`：东方站根路径英文（ganjiday.com，`en`）的八字与紫微详批
（OpenSpec `add-locales-eu-ja` design 决策 7、tasks 5b.3）。契约见 `docs/06-ai.md`「提示词版本与评测」。

## 为什么是独立套件

design 决策 7 写的是「`evals/readings` 新增套件版本」。模板的版本锁对**每个套件版本 × 每个样本**渲染，
`readings@pre-v4` / `readings@v4` 无法渲染东方站英文样本（英文没有 v4 之前的版本），`readings` 的门槛又按
48 个样本整批与基线比较；把新组合放进同一套件会改变已有版本的样本集、版本锁与门槛结论。
因此另起同级套件：`readings` 的版本、样本、录制与锁一字不动，检查（`createReadingChecks`）、
被评正文转换（`createPrepareOutput`，同为 `guard.v4`）、评分维度与模型单价复用 `readings`。

| 文件 | 内容 |
|---|---|
| `prompts.ts` | 套件版本 `readings-east-en@v2`（v1 未发布即作废） → catalog 中登记为 `<kind>.v4` 的英文提示词（`prompts/*.en.v4.ts`），消息与线上 `readingMessages` 逐字相同 |
| `checks.ts` | `readings` 的全部检查 + `script`（汉字 ≤ 2%、无假名谚文与中文标点）、`hanRuns`（warn）、`wording`（声明三类表述、禁 entertainment / guaranteed / always accurate）、`terminology`（Day Master / Life Palace） |
| `rubric.ts` | `r1-east-en.1`：五个维度同 `readings` r1，instructions 写明英文读者、术语与汉字注释规则 |
| `gates.ts` | 逐组合门槛（解锁入口按组合开放） |
| `samples.json` | 16 个虚构样本（2 个组合 × 8），出生地为纽约、伦敦、多伦多、悉尼、新加坡、洛杉矶与手选时区 |
| `prompts.lock.json` | 版本锁 |
| `east-en.test.ts` | 离线单测（`pnpm test:evals`） |

## 门槛（`gates.ts`，逐组合）

| 门槛 ID（`<组合>.` 前缀） | 标准 |
|---|---|
| `coverage` | 未筛选运行，该组合 ≥ 8 个样本 |
| `hard-checks` | 全部 error 级检查 100% 通过 |
| `judge-<维度>` | 均值 ≥ 同类型中文 v4 录制（readings@v4，16 个样本）均值 − 0.25 |
| `judge-accuracy-min` | accuracy 均值 ≥ 4.0 |
| `p95-output-tokens` | P95 输出 token ≤ 12000 × 70% = 8400 |
| `p95-duration` | P95 生成时长 ≤ 240 秒 |

另有全局 `versions`（候选为 `readings-east-en@v2`），`human-review`、`staging-acceptance` 为外部证据（非必需）。
英文没有同样本的旧版本可作基线，因此与中文 v4 的评委均值比较；样本与语言不同、评委波动约 ±0.2，
容差取 0.25（`readings` 同样本对比为 0.1）；该口径与 accuracy ≥ 4.0 已由协调者确认为新语言的统一门槛。

某组合全部必需门槛 passed 后，从 `apps/web/src/features/readings/catalog.ts` 的
`READING_EVAL_PENDING` 删除该组合即开放解锁卡与 `POST /api/readings`。

## 命令

```sh
# 首次真实运行：录制生成与评委（需使用者批准预算；密钥取自根目录 .env.local，不打印）
EVIDENCE_DIR=<私有证据目录> pnpm eval:prompts --suite readings-east-en --record --budget-usd 3 --concurrency 4
# 之后日常回放（零费用）
EVIDENCE_DIR=<私有证据目录> pnpm eval:prompts --suite readings-east-en
pnpm test:evals
```

录制前回放必然以退出码 1 结束（`no-recording`），门槛为 incomplete。

## 费用估算（2026-11-21，未实测）

单价取套件声明（DeepSeek 高峰价）：deepseek-flash 输入 $0.30 / 输出 $1.20，deepseek-v4-pro 输入 $1.32 / 输出 $3.96（每百万 token）。

| 项 | 每样本 token（估） | 依据 |
|---|---|---|
| 生成输入 | ≈ 5.5k | 英文 system 10.9–12.2k 字符 ≈ 2.9k + 命盘 JSON 5.6–6.5k 字符 ≈ 2.2k（中文 v4 实测 4.2–4.6k） |
| 生成输出 | ≈ 4.5k（上限 12k） | 九章 + 五年，约 16–20k 字符；英文数字命理 v4 实测 11.5k 字符 ≈ 2.4k |
| 评委输入 | ≈ 8k | 评分说明 + 样本输入 + 被评正文（中文 v4 实测 7.1k） |
| 评委输出 | ≈ 5.5k（上限 16k） | 含思考（中文 v4 实测 5.35k） |

- 预期：生成 ≈ $0.007 + 评委 ≈ $0.032 = **≈ $0.04 / 样本，16 个样本 ≈ $0.65**（readings@v4 实录 48 个 $1.71，每样本 $0.036）。
- 最坏（每次都用满输出上限）：≈ $0.09 / 样本，16 个 ≈ $1.45；`--budget-usd 3` 覆盖并发预留。
- 若需按评测修订提示词再录 2 轮，合计 ≈ $2–4.5，低于每语言 US$15 上限。

## 样本说明

| 样本 | 组合 | 说明 |
|---|---|---|
| `bazi-en-01` | bazi-full.en | fictional: female, New York, hour known, mid-year request（值太岁） |
| `bazi-en-02` | bazi-full.en | fictional: male, London, hour unknown, born and requested before Li Chun（冲太岁） |
| `bazi-en-03` | bazi-full.en | fictional: female, Toronto, 23:30 Zi-hour boundary, weak Day Master |
| `bazi-en-04` | bazi-full.en | fictional: male, Sydney, request just after Li Chun, Luck Pillar change in window |
| `bazi-en-05` | bazi-full.en | fictional: female, Singapore, hour unknown, fourth-quarter request |
| `bazi-en-06` | bazi-full.en | fictional: male, Los Angeles, young, late-December request |
| `bazi-en-07` | bazi-full.en | fictional: female, manual UTC-5 with longitude (Chicago area), true solar time |
| `bazi-en-08` | bazi-full.en | fictional: male, New York, older, hour unknown |
| `ziwei-en-01` | ziwei-full.en | fictional: female, London (British Summer Time), no empty palace |
| `ziwei-en-02` | ziwei-full.en | fictional: male, New York, January request, Major Period change |
| `ziwei-en-03` | ziwei-full.en | fictional: female, Sydney, young, Major Period change |
| `ziwei-en-04` | ziwei-full.en | fictional: male, Toronto, Major Period change |
| `ziwei-en-05` | ziwei-full.en | fictional: female, Singapore, 00:30 early Zi hour, December request |
| `ziwei-en-06` | ziwei-full.en | fictional: male, Los Angeles, 23:20 late Zi hour |
| `ziwei-en-07` | ziwei-full.en | fictional: female, manual UTC-6 with longitude (Mexico City area), older, empty Life Palace, Major Period change |
| `ziwei-en-08` | ziwei-full.en | fictional: male, London, request one day before Li Chun, empty Life Palace |
