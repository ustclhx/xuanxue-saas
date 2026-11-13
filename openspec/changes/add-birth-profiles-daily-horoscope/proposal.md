# Proposal

## Why

现在用户每次使用工具或下单详批都要重新填写出生资料，为家人、伴侣排盘时尤其麻烦；站点也缺少让用户每天回访的理由。
竞品都有「每日运势」与「命主档案」（docs/ux-review/2026-10-30），模板 0.3.x 也已提供每日积分、对话绑定对象与工作台组件。
因此本轮由项目侧补上命理领域的两块内容：出生档案，以及基于现有引擎、规则驱动的每日运势（路线来源：2026-11-10 foundation 文档「衍生项目侧」）。

## What Changes

- **出生档案**：
  - 用户可在个人空间保存多份出生资料（本人或他人）。字段与现有工具表单一致：显示名（可选）、关系、历法、出生日期、时间或「不知道时辰」、性别、出生地或 UTC 偏移与经度、真太阳时偏好；西方站另有可选的出生全名，用于姓名数字。
  - 每人最多一份「本人」档案和一份默认档案，档案数量有上限。
  - 新增档案管理页 `/app/$slug/profiles`，并在导航中登记入口。
- **工具页与报告下单可选用档案**：
  - 已登录用户在东方站排盘表单（含宫合双人）与西方站数字命理表单中，可点击「从档案填入」；也可把当前输入「存为档案」。
  - 计算仍在浏览器本地完成；只有用户主动操作时才读取档案。
  - 详批解锁沿用表单输入。报告保存输入快照，不引用档案，删除档案不影响已有报告。
- **隐私**：
  - 档案属于敏感个人信息，不进入分享链接、埋点、日志、审计正文或 AI 提示词（提示词只含推导结果）。
  - 删除单份档案时立即硬删除；删除账号时一并删除全部档案。
  - 两站四种语言的隐私政策同步说明档案的收集、用途、保存期限与删除方式。
- **引擎**：
  - `@xuanxue/bazi` 新增流日计算：给定公历日期，返回当日干支，日干对日主的十神，日支与本命四支的冲、合、刑、害，以及黄历的宜忌和建除十二值星。
  - `@xuanxue/numerology` 新增宇宙日数、个人月数与个人日数。
- **公开每日运势页**（四种语言各一个规范地址）：
  - 东方站显示今日干支、宜忌与建除，并按十种日主分别给出提示；
  - 西方站显示宇宙日数与个人日数 1–9（含 11、22）的含义，并提供浏览器本地的个人日计算；
  - 规则引擎生成内容，页面加载不查库，HTML 按站点参考时区缓存到当日结束；
  - 收录站点地图与 hreflang，带合规声明。
- **今日面板**：登录后的工作台首页 `/app/$slug` 顶部按默认档案显示个人化的今日运势，可切换档案；没有档案时引导创建。可选「就今日运势问 AI」入口，复用模板的临时上下文对话。
- **不做**：
  - AI 润色每日文案（只预留结构化事实接口，是否启用见 design Open Questions）；
  - 每日运势邮件订阅（Open Question）；
  - 按日期的历史存档页；
  - 星座运势（引擎当前没有星座能力，见 Open Questions）。

## Capabilities

### New Capabilities
- `birth-profiles`：用户在个人空间保存、管理和选用出生资料，并承担对应的隐私义务。
- `daily-horoscope`：基于规则引擎的每日运势，包括公开每日运势页与登录后的今日面板。

### Modified Capabilities
- `bazi-chart`：新增流日关系计算（当日干支对本命的十神与地支关系、宜忌与建除）。
- `numerology`：新增宇宙日数、个人月数与个人日数。
- `tool-pages`：已登录用户可在工具表单中从档案填入，也可把当前输入存为档案，且不影响首屏零等待和离线计算。
- `paid-readings`：解锁可使用档案预填的输入，报告保存输入快照，与档案的后续修改或删除无关。
- `account-deletion`：删除账号时清除出生档案。

## Impact

- **数据库**：新表 `birth_profile`（扩展型迁移，由协调者在 main 上生成）；schema 新文件 `packages/db/src/schema/profiles.ts` 与汇总导出。
- **引擎包**：
  - `packages/bazi` 新增 `daily.ts`，依赖已有的 `tyme4ts` 黄历能力，不新增依赖；
  - `packages/numerology` 在 `numbers.ts` 增加函数。
- **apps/web**：
  - 新增 `features/profiles/`、`features/daily/`、档案管理页路由、四种语言的每日运势公开路由；
  - 改动工具表单组件（`features/tools/bazi/birth-fields.tsx`、`features/tools/numerology/*`）；
  - 改动工作台首页 `routes/app/$slug/index.tsx`（模板文件）、`features/readings/deletion.server.ts`、`server.ts`（公开每日页的边缘缓存）、`features/seo/pages.ts`（站点地图）与 `features/app-shell/nav.project.ts`；
  - 新增文案文件 `messages/<locale>/profiles.json`、`daily.json`。
- **内容**：
  - 每日规则文案表（十神 × 语言、建除、个人日 1–9 等），由 Claude 起草、用户审定；
  - `content/legal/*/privacy.mdx` 四份。
- **运维**：不新增 Cron、轮询、secret 或外部服务。公开每日页走 Workers Cache API，遵守 Neon 成本基线。上线需在 staging 执行迁移并验收，再按授权发布 production。
- **协调**：可能与同批的 `redesign-home-chart-visuals` 在工具表单、首页与工作台首页上冲突，见 tasks 中的冲突点说明。
