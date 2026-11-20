# 日语详批提示词评测套件 `readings-ja`

`pnpm eval:prompts --suite readings-ja`（openspec `add-locales-eu-ja` 决策 7、tasks 4.8）。
日语样本不放进 `readings` 套件：那边的门槛按六个组合整批计算，混入新样本会改变已录制版本的分母。
两个套件共用 `evals/readings/` 的复算、渲染、检查与被评正文转换（`readings/prompts.ts` 的 `JA_SUITE_VERSION`）。

| 文件 | 内容 |
|---|---|
| `prompts.ts` | 唯一版本 `readings-ja@v1`：八字 → `bazi-full.v4`、紫微 → `ziwei-full.v4`、塔罗 → `tarot-spread.v3`（catalog.ts 的 `ja` 语言） |
| `prepare.ts` | `guard.v4-disclaimer.1`：readings 的 `deliveredReadingText` 之后加上线上保存时的首尾合规声明 |
| `checks.ts` | readings 全部检查 + 日语检查：`kana`（假名占比 ≥ 0.3）、`simplifiedGlyphs`（术语表简体字形正则）、`glossary`（术语表禁用写法与合规禁用表述）、`complianceStatement`（首尾声明含「参考」「不预言」表述） |
| `rubric.ts` | `r1-ja.1`：与 `r1` 同五个维度与锚点，说明中加注塔罗与目标语言（日语、です・ます、日本流派用语） |
| `gates.ts` | 门槛，见下 |
| `samples.json` | 24 个虚构样本（3 组合 × 8），`data` 为按样本请求时间复算的结果 |
| `prompts.lock.json` | 版本锁（2026-11-21 回放生成，尚无录制） |

## 门槛

沿用 `readings` 套件全部门槛与阈值：样本量（每组合 ≥ 8，未筛选）、版本、error 级检查 100% 通过、
accuracy 均值 ≥ 4.0、P95 输出 token ≤ 8400、P95 时长 ≤ 240 秒。
评委维度的「≥ 基线 − 0.1」没有日语旧版本可比，改为对照 `readings@v4` 评委录制的整批均值
（accuracy 4.313、specificity 4.979、actionability 4.979、tone 5.000、readability 4.542），容差 0.1。
另输出每个组合的分组结果 `combo-<kind>.ja`（非必需），用于判断能否单独开放某个组合。
D-6 定为只用 AI 审阅，因此没有人工审阅门槛；staging 真实链路（tasks 4.11）为外部证据。

开放方式：门槛通过并记入私有验收记录后，从 `apps/web/src/features/readings/catalog.ts` 的
`READING_EVAL_PENDING` 删掉对应组合（同时更新 `ja-readings.test.ts` 的断言）。

## 样本

虚构人物，姓名只用于说明，不进入提示词（详批输入不含姓名）。

| 样本 | 人物（虚构） | 说明 |
|---|---|---|
| `bazi-ja-01` | 佐藤 健一 | 男，东京，有时辰，年中请求，窗口内换大運且冲太岁，天中殺年在窗口内 |
| `bazi-ja-02` | 中村 美咲 | 女，大阪，不知道时辰，1 月（立春前）请求 |
| `bazi-ja-03` | 高橋 和子 | 女，札幌，1950 年 7 月出生（日本夏令时期间），3 月请求 |
| `bazi-ja-04` | 田中 誠 | 男，福冈，23:30 子时边界，身弱，第四季度请求，值太岁 |
| `bazi-ja-05` | 伊藤 翔太 | 男，东京，不知道时辰，12 月底请求，窗口前两年为天中殺 |
| `bazi-ja-06` | 渡辺 さくら | 女，名古屋，身弱 |
| `bazi-ja-07` | 山本 隆 | 男，大阪，旧暦输入，请求当年换大運且值太岁 |
| `bazi-ja-08` | 小林 由美 | 女，手选 UTC+9 与经度 130.4，真太阳时，2 月请求 |
| `ziwei-ja-01` | 加藤 彩 | 女，东京 |
| `ziwei-ja-02` | 吉田 大輔 | 男，大阪，1 月请求 |
| `ziwei-ja-03` | 山田 正雄 | 男，札幌，1949 年 8 月出生（夏令时期间），无空宫 |
| `ziwei-ja-04` | 松本 恵 | 女，福冈，23 点后晚子时 |
| `ziwei-ja-05` | 井上 葵 | 女，名古屋，0 点早子时，年轻 |
| `ziwei-ja-06` | 木村 浩 | 男，东京，旧暦输入 |
| `ziwei-ja-07` | 林 直美 | 女，大阪，命宫空宫，12 月请求 |
| `ziwei-ja-08` | 清水 拓也 | 男，福冈，四个空宫 |
| `tarot-ja-01` | 斎藤 未来 | スリーカード，新职场适应，含逆位置 |
| `tarot-ja-02` | 山口 隼人 | ケルト十字，同事关系 |
| `tarot-ja-03` | 森 結衣 | スリーカード，没有问题 |
| `tarot-ja-04` | 池田 陽介 | スリーカード，周末安排 |
| `tarot-ja-05` | 橋本 楓 | ケルト十字，升学后是否独居 |
| `tarot-ja-06` | 石川 真司 | スリーカード，睡眠（健康类问题，检验就医提示与不诊断） |
| `tarot-ja-07` | 前田 理沙 | スリーカード，三张全逆位置，求职焦虑 |
| `tarot-ja-08` | 藤田 修 | ケルト十字，副业与金钱（检验不给投资建议） |

## 命令

```sh
pnpm test:evals                                                                       # 离线单测（含本套件）
EVIDENCE_DIR=<私有证据目录> pnpm eval:prompts --suite readings-ja --no-judge          # 回放（需录制）
EVIDENCE_DIR=<私有证据目录> pnpm eval:prompts --suite readings-ja --record --budget-usd 15 --concurrency 4  # 真实调用并录制，需批准
```
