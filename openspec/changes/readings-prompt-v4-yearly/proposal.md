# Proposal

## Why

付费详批目前只给模型「本命盘 + 十个大运 + 当前一年流年干支」，没有逐年数据，报告只能泛谈「未来十年大运」；竞品对比（docs/ux-review/2026-10-30）显示「未来几年逐年怎么走」是用户最看重、我们最缺的部分。模板已交付对话、推荐追问与阅读器，但 R6 提示词评测尚未发版，提示词改动仍只能靠人工抽检，这次 v4 大改需要先补数据、再用可重复的评测把关后上线。

## What Changes

- **引擎数据补充**（服务端复算后进入提示词的结构化数据，客户端仍不能提交计算结果）：
  - 八字 / 사주：新增流年窗口（默认当年起 5 年，见 Open Questions）的逐年数据：流年干支与五行、天干十神与地支藏干十神、所在大运、与本命四柱及当步大运的天干合 / 地支六合 / 冲 / 刑 / 三合关系、值太岁 / 冲太岁、流年五行是否为喜用；大运补地支（本气）十神、五行喜忌与窗口内换运年份；神煞补所在柱。
  - 紫微：新增十二宫大限年龄区间、当前与下一步大限、窗口内逐年流年命宫位置与流年四化，补六吉六煞辅星。
  - 数字命理：新增窗口内逐年个人年数，以及四个巅峰数（Pinnacle）与挑战数（Challenge）及其年龄区间。
- **提示词 v4**（八字 zh-Hant / zh-Hans、사주 ko、紫微 zh-Hant / zh-Hans、数字命理 en）：新增「流年逐年」章节（每年一个三级标题），其余章节按 5.1 抽检与竞品差距优化（引用数据更具体、减少重复、建议可执行）；各语言统一为 `*.v4`，旧版本文件保留不改。塔罗与궁합不在本次范围（궁합见 Open Questions）。
- **版本切换与回滚**：每种详批的提示词版本改为运行时设置 `readings.<kind>.promptVersion`（取值限于代码中注册的版本，默认仍为当前版本），后台切换即上线、切回即回滚，无需重新部署；已生成的报告保存正文与 `promptVersion`，不受切换影响，生成中报告的收尾按其记录的版本校验章节。
- **项目内最小评测脚本**：模板 R6 未发版，本项目先提供 `pnpm eval:readings`（不进 CI 默认测试）：固定虚构样本、确定性检查（章节、长度、合规、字形、数据一致性）、可选 LLM 评委、v3 与 v4 基线对比，报告写入 `EVIDENCE_DIR`；真实模型调用需显式开启并有预算上限。模板 R6 发版后迁移到模板工具。
- **上线门槛**：评测确定性检查全过、评委分数不低于 v3 基线、长度与时长在限制内，并由使用者审阅每种详批每种语言的样例后，才在 staging 与生产切换版本。
- 长文生成维持单次流式调用（Workers 流式响应不受墙钟限制，CPU 时间很少）；输出上限与模型行 `maxOutputTokens` 按评测实测调整。分章节生成留给模板的通用报告模块，本变更只记录触发条件。

## Capabilities

### New Capabilities
- `reading-prompt-eval`：详批提示词的离线评测：样本套件、确定性检查、LLM 评委、基线对比、证据输出与预算保护，以及版本上线门槛。

### Modified Capabilities
- `paid-readings`：报告固定章节加入流年逐年章节；新增提示词版本的运行时切换、回滚与已生成报告不受影响的要求。
- `bazi-chart`：新增八字流年窗口逐年关系数据与紫微大限 / 流年数据的计算契约。
- `numerology`：新增逐年个人年数序列与巅峰数、挑战数的计算规则。

## Impact

- 代码：`packages/bazi`（新增流年关系与紫微运限函数，`index.ts` / `ziwei.ts` 导出）、`packages/numerology/src/numbers.ts`、`apps/web/src/features/readings/`（catalog 摘要与版本注册、`prompts/*.v4.ts`、generate / readings.functions 按记录版本收尾、config 读取版本设置）、`packages/db/src/settings.ts`（新增 `readings.<kind>.promptVersion` 默认值，无迁移）、后台运行时设置页的取值校验、新评测脚本 `apps/web/scripts/eval-readings/` 与根 `package.json` 脚本。
- 数据：不新增表、不改列；`reading.engine_version` 对 v4 记录组合版本（如 `1.0.0+annual.1`）。
- 外部：评测与 staging 实测调用模型产生费用（需使用者批准预算）；如决定加价，只改运行时设置 `readings.<kind>.credits`，不涉及 Stripe 价格。
- 依赖：不新增 npm 依赖（iztro 已有 `horoscope`）；与「每日运势引擎」类变更可能同时修改 `packages/bazi` 的导出文件。
