# Design

## Context

动机见 proposal.md。与本设计相关的现状如下。

**工具表单**
- 东方站：表单状态是 `features/tools/bazi/birth-form-state.ts` 的 `BirthFormValues`，用 `toBirthInput` 换算为引擎的 `BirthInput`，即历法、年月日、闰月、时间或 null、性别、城市或 UTC 偏移与经度、真太阳时。
- 西方站：数字命理只需要出生日期与可选的出生全名。
- 表单值存放在 sessionStorage，切换页面时保留。分享链接用 `#r=` 片段，并经 `shareableInput` 丢弃 name、mail 等字段。

**详批**
- 解锁时把 `{kind, share, returnTo}` 签名放进 `?unlock=`。服务端用 `catalog.ts` 的 zod schema 复算，`reading.input` 保存规范化输入，不引用其他对象。
- 报告保存在个人空间。`features/readings/deletion.server.ts` 的 `workspaceContentDeletionStep` 在删号或删空间时删除 `reading`，由 `packages/auth` 的 deletion 流程按注册顺序执行。

**引擎**
- `@xuanxue/bazi` 基于 `tyme4ts@1.5.3`。该版本已提供 `SixtyCycleDay`、宜忌 `getRecommends` / `getAvoids`、建除 `getDuty` 与九星。`compat.ts` 已有六冲、六合、三合、刑与天干合的判断函数。
- `@xuanxue/numerology` 有 `lifePath` 与 `personalYear`（调用方传入本地年份），还没有个人月、个人日与宇宙日。
- 塔罗已有「每日一张」工具页。

**公开页与成本**
- 营销页与工具页在构建期预渲染。根布局 loader 会读公告设置（KV 缓存）和会话装饰。
- Neon 成本基线要求：无人访问时数据库能缩容到零，不新增按用户的 Cron 或轮询。
- Worker 返回的 HTML 默认不进 CDN 缓存。

**账户与布局**
- `multiTenant=false`，只有个人空间；`ui.appLayout='topbar'`。
- 两站账户按站点拆分（迁移 0018），同一邮箱在两站是两个用户。
- 工作台首页 `routes/app/$slug/index.tsx` 是模板文件。导航条目通过项目自有的 `nav.project.ts` 登记。

**合规**：免费结果只能写「依传统规则计算、仅供娱乐、不预测未来」，不得声称 AI 生成或 AI 辅助（openspec/config.yaml）。

## Goals / Non-Goals

**Goals：**
- 档案一处维护，工具、详批与今日面板都能使用。档案数据只在用户主动操作时离开浏览器。
- 每日运势完全由确定性的规则引擎生成，引擎与文案表都有版本号，可测试、可复现。
- 公开每日页对搜索引擎完整可见，同时不为匿名流量唤醒数据库。

**Non-Goals：**
- AI 润色、每日邮件、日期存档页、星座运势（见 Open Questions）。
- 团队空间共享档案。
- 用户数据导出。
- 应用层字段加密（见 Open Questions）。
- 修改模板的 subject 对话、每日积分等机制。

## Decisions

### D1 档案数据模型：单表 + jsonb 出生资料

新表 `birth_profile`，放在 schema 新文件 `packages/db/src/schema/profiles.ts`，在 schema `index.ts` 汇总导出。字段如下：

| 字段 | 类型与说明 |
|---|---|
| `id` | uuid v7 |
| `workspace_id` | FK organization，restrict |
| `user_id` | FK user，restrict |
| `label` | text，可空，≤ 40 |
| `relation` | text，取值 self / partner / family / friend / other，带 check 约束 |
| `is_default` | boolean，默认 false |
| `birth` | jsonb，见下文 |
| `full_name` | text，可空，≤ 120，仅西方站姓名数字使用 |
| `created_at` / `updated_at` | timestamptz |

`birth` 的结构与 `BirthInput` 对齐，但 `gender` 与 `location` 可以为 null，以容纳西方站只填日期的档案。

索引与约束：
- `(workspace_id, user_id, updated_at desc)`；
- 部分唯一索引 `(user_id) where is_default`：每人最多一份默认档案；
- 部分唯一索引 `(user_id) where relation = 'self'`：每人最多一份「本人」档案。

**理由**：
- 出生资料的结构由引擎定义，jsonb 让档案、详批 `reading.input` 与表单共用同一份 zod schema；
- 后续引擎字段增加（例如出生地精度）时不需要改列；
- 唯一约束放在数据库层，并发请求下也成立。

**备选**：
- 每个字段一列：查询无优势，还要维护两套映射，放弃；
- 档案存 KV 或浏览器：不能跨设备，删号也无法保证清除，放弃。

### D2 校验：一份 schema，按站点给出必填字段

`features/profiles/schema.ts` 定义 `birthProfileSchema`，从 `readings/catalog.ts` 的 `birthInputSchema` 抽出共用部分，日期、闰月、经度的语义检查仍调用引擎的 `validateInput`。
- 东方站：创建时要求性别和出生地；
- 西方站：只要求日期。

另提供纯函数 `profileFor(tool, profile)`，按工具声明的所需字段返回 `{ values, missing[] }`。表单据此预填，并在缺失字段旁提示补全，对应 spec「档案按站点补全字段」。

### D3 只在个人空间，服务端按用户 + 空间双重过滤

server functions 放在 `features/profiles/profiles.functions.ts`，包括 list、get、create、update、delete、setDefault。
- 统一走 `withSession → withWorkspace`，并要求当前空间是个人空间；
- 查询使用 `scoped(db, workspaceId)`，并加 `user_id = 当前用户` 条件；
- 越权时返回 `NOT_FOUND`。

上限 20 份与「默认档案自动转移」在同一事务内完成：
- 计数时先锁住该用户的档案行；
- 删除默认档案时，把最近更新的另一份设为默认。

**理由**：详批与每日积分都只在个人空间。团队档案涉及成员可见性，本轮不做。

### D4 工具页：按需读取，水合后才出现入口

- 「从档案填入」按钮只在页头已识别为登录态时出现，复用 `getViewerSpaces` 的结果，不另发请求。
- 档案列表在用户点开选择器时才请求，一个会话内缓存在内存中。页面加载不会因档案多出数据库查询，预渲染 HTML 与离线计算都不变。
- 档案选择器组件 `ProfilePicker` 用 `@xuanxue/ui` 的 Combobox 或 Dialog。
- 「存为档案」把当前表单值经 D2 校验后提交。未登录时跳转登录，返回后依靠 sessionStorage 中已保留的表单值，由用户再点一次保存，不保留自动保存意图。
- 宫合双人表单的 `a_` / `b_` 各配一个选择器。
- 西方站数字命理计算器（完整版、Life Path、姓名类）按所需字段接入。塔罗不涉及档案。

### D5 详批：不改解锁协议

档案只负责预填表单，解锁仍签名原有的分享输入。`reading.input` 是快照，不加 `profile_id` 列，这满足 paid-readings 增量 spec，也不扩大解锁令牌中的个人信息。

**备选**：在报告上记录 `profile_id`，以便「从档案查看历史报告」。删除档案时还要处理外键，收益小，放弃，留作以后再评估。

### D6 引擎：流日与个人日放进各自的引擎包

**`packages/bazi/src/daily.ts`**
- `dayPillarOf(date: {year, month, day})`：返回日柱、农历日、宜忌与建除。宜忌和建除以 tyme4ts 的索引或键返回，不带本地化文字，文字由 web 的文案表按语言提供。
- `dailyRelations(chart, date)`：返回十神，以及地支关系列表 `{ natal: 'year'|'month'|'day'|'hour', kind: 'clash'|'combine'|'triad'|'punish'|'harm' }`。
- 复用 `compat.ts` 的判断函数，补上六害。
- 导出 `DAILY_RULES_VERSION`。

**`packages/numerology`**
- 新增 `universalDay(date)`、`personalMonth(birth, local)`、`personalDay(birth, local)`，返回 `NumberResult` 与 steps，与现有 `personalYear` 风格一致。

**web 侧**：`features/daily/` 只做两件事：「规则结果 → 文案键」的映射，以及组装 `DailyFacts`。`DailyFacts` 是结构化事实，后续如果加 AI 润色，只用它作为输入。

**不打分**：v1 不给星级或分数，每项内容是「主题 + 建议 + 留意」三段规则文案，减少「预测」的观感（见 OQ7）。

**理由**：引擎包已有确定性测试与版本号惯例，web 只负责展示，各层边界清楚。

### D7 公开每日页：SSR + Workers Cache API，不预渲染

- **路由**：四个语言路由（见 spec）。page loader 只做纯计算，入参是参考日期。
- **不进预渲染**：不登记到 `TOOL_ROUTES`，也不放进 `PRERENDERED_PREFIXES`；改为加入 `features/seo/pages.ts` 的 `publicPages`，供站点地图、hreflang 与构建期 OG 图使用。
- **缓存流程**：在 `server.ts` 的站点守卫之后，用一个小函数 `dailyPageCache` 处理每日页的 GET 请求：
  1. 请求带会话 cookie 时，直接 SSR，不读缓存也不写缓存；
  2. 否则以「规范 URL + 参考日期」为键查 `caches.default`；
  3. 未命中时 SSR，写入缓存，`Cache-Control: public, max-age=300, s-maxage=<距参考日结束的秒数，上限 3600>`；
  4. 响应带 `Vary: Cookie` 保护。
- **效果**：每个机房、每种语言每小时最多一次 SSR。根 loader 中公告设置的读取原本就走 KV 缓存，不会因每日页额外唤醒数据库。
- **验收**：单测断言该路由的 loader 不调用 db；e2e 在数据库不可达的情况下请求该页，返回 200。

**备选**：
- 构建期预渲染：每天的内容需要每天重新发版，放弃；
- 纯客户端计算：HTML 中没有当日内容，SEO 价值低，放弃；
- 每天用 Cron 把 HTML 写进 KV：新增定时任务和部署面，没有必要，放弃。

### D8 参考时区与本地校正

- **参考时区**：
  - zh-Hant、zh-Hans：`Asia/Taipei`（UTC+8）；
  - ko：`Asia/Seoul`（UTC+9）；
  - en：暂定 `America/New_York`（主要受众为北美；OQ1 确认）。
- **本地校正**：水合后，客户端用 `Intl` 得到本地日期，与参考日期不同时：
  - 西方站：本地重算，numerology 代码很小，直接打包；
  - 东方站：动态 import `@xuanxue/bazi` 的 daily 子入口，tyme4ts 较大，不进首屏包，复用 `features/tools/bazi/engine.ts` 的按需加载模式。
- 今日面板采用同一套机制。
- **日界**：民用 00:00。页面说明中注明「子时换日」流派之间的差异，只做说明，不提供选项。

### D9 地址与 SEO

- **地址**：
  - `/zh-hant/每日運勢`
  - `/zh-hans/每日运势`
  - `/ko/오늘의-운세`
  - `/daily-numerology`

  西方站用 numerology 命名，避免与星座 horoscope 的搜索意图混淆（OQ4）。
- **页面信息**：
  - title 与 H1 含日期；
  - 结构化数据为 `WebPage` 加 `dateModified`；
  - OG 图使用构建期生成的通用图，不按日生成。
- **收录**：不生成日期存档地址（OQ5）。`llms.txt` 的本站工具列表加入该页。
- **站内入口**：营销首页、工具页互链与页头导航的入口放在 tasks 7.x，并与 `redesign-home-chart-visuals` 协调。

### D10 今日面板

- **组件位置**：面板放在项目文件 `features/daily/today-panel.tsx`。模板文件 `routes/app/$slug/index.tsx` 只增加一处挂载点和 loader 调用，把同步冲突面降到最小。改动登记到升级跟踪（`docs/design/forks.md` 或项目说明）。
- **loader**：
  - 只在个人空间执行；
  - 一次索引查询取出用户的档案列表（≤ 20 行），服务端用参考日期计算默认档案的 `DailyFacts`；
  - `?profile=<id>` 切换档案，越权按不存在处理。
- **面板内容**：
  - 今日主题与提示；
  - 「用此档案打开工具」链接，用 `#r=` 分享片段预填，片段不含姓名；
  - 「查看公开每日页」链接。
- **可选：就今日运势问 AI**（任务 8.3）：
  - 用模板的 `issueSubjectContext` 签发临时上下文，subjectType 为 `daily`，在 `features/ai/subject-providers.ts` 注册；
  - 上下文只包含 `DailyFacts`，不含出生日期，计费按普通对话；
  - 文案属于 Chat 场景，使用 AI 声明。

### D11 删除与隐私

- **删除**：在 `workspaceContentDeletionStep` 中加入 `delete from birth_profile where workspace_id in (...)`。个人空间的 id 等于用户 id，因此删号时会覆盖到。`server.ts` 与 `deletion.functions.ts` 已经注册该 step，无需再改，`packages/auth` 的 deletion 代码也不需要改。用集成测试验证删号后档案为 0、另一站不受影响。
- **数据最小化落实**：
  - 埋点与日志只记录档案 id；
  - 审计不写 `birth`；
  - 错误上报中去掉请求体；
  - 加一条单测，断言新增的 server function 的日志字段白名单。
- **隐私政策**：两站四份 `privacy.mdx` 各新增「出生档案」小节，并修正「免费工具不向服务器发送资料」的表述，补上「除非你保存档案」。由 Claude 起草，用户确认。

### D12 设计稿与页面

以下新页面与较大布局改动先经 `ui-design` 技能产出设计稿，并由用户确认：
- 档案管理页，含新建与编辑对话框；
- 工具表单中的档案选择器与「存为档案」；
- 东方站与西方站的公开每日页（桌面与 390px 手机）；
- 今日面板。

设计稿遵循 `docs/design/visual-system.md`，其中区块编号只在东方站使用。

## Risks / Trade-offs

- [规则文案量大：十神 10 × 语言 3、建除 12、宜忌词条、个人日 11 × 英语，可能显得模板化或重复] → 每类事实取多条文案，按日期确定性轮换；文案表带版本号；由用户抽检审定后上线。
- [「每日运势」本身带有预测意味，与「不预测未来」的声明有张力] → 文案以「主题、建议、反思提示」措辞，禁止确定性吉凶断语和健康、投资建议，并加入 `readings/compliance.ts` 风格的文案检查单测。
- [缓存把会话内容带给其他用户] → 只缓存不带会话 cookie 的请求；page loader 不读会话；测试断言带 cookie 的请求不读也不写缓存。
- [模板文件 `routes/app/$slug/index.tsx` 的同步冲突] → 只插一行挂载点，主体放在项目文件，并在 template-sync 的冲突说明中登记。
- [出生资料集中存储会扩大泄露面] → 双重过滤加越权测试，日志和埋点最小化，删除为硬删除；应用层加密作为 OQ6 评估。
- [tyme4ts 的宜忌与民间黄历存在差异] → 页面注明依据的流派与规则版本，不承诺与某本黄历一致。
- [今日面板让每次进入 `/app` 多一次查询] → 只在已登录的真实用户访问时发生，不违反成本基线；查询走索引并限 20 行。

## Migration Plan

1. 并行开发期间，worker 用 `drizzle-kit push` 同步本地库，不提交迁移（并行计划 §3）。全部 schema 分支合并后，由协调者在 main 上 `drizzle-kit generate` 生成扩展型迁移：新建空表与部分唯一索引，`lock_timeout=5s`，可安全回滚。
2. 合并后由 CI 发布 staging，顺序为构建 → 迁移 → jobs → web，然后按 tasks 第 9 组验收。
3. production 发布需要用户授权，推送项目 `v*` tag。发布后一周内查看 Neon Usage，确认公开每日页没有带来常驻唤醒。
4. **回滚**：只回退代码，保留 `birth_profile` 表与数据，旧代码不读写它；需要时下线公开每日路由，站点地图随代码回退。

## Open Questions

- **OQ1 西方站参考时区**：暂定 `America/New_York`，也可以用 UTC。只影响首屏 SSR 的日期，客户端会校正为本地日期。
- **OQ2 AI 润色**：
  - 是否在规则文案之上用模型润色？
  - 若启用：免费页面使用 AI 文本会与「不得声称 AI 生成」的合规口径冲突，需要先确定披露方式；
  - 润色单位为「日期 × 语言 × 日主」，缓存在 KV，不入库；
  - 个人化面板的润色是否消耗积分。

  v1 不实现，只保留 `DailyFacts` 作为输入接口。
- **OQ3 每日运势邮件订阅**：
  - 是否做、发送时区、退订；
  - 需要一个每天运行的批量任务，要评估它对 Neon 缩容的影响；
  - 文案是否复用 newsletter 的同意机制。
- **OQ4 星座**：西方站是否增加太阳星座的每日内容？引擎目前没有星座能力，新增需要另开 change。地址 `/daily-numerology` 也为此预留了区分。
- **OQ5 日期存档页**：是否为最近 N 天生成可索引的日期页，用于长尾 SEO？要权衡内容单薄与重复内容的风险。
- **OQ6 档案应用层加密与数量上限**：v1 依赖数据库静态加密，上限 20 份；是否需要字段级加密或调整上限？
- **OQ7 评分**：是否在规则提示之外显示星级或分数？v1 不显示。
- **OQ8 今日面板加入塔罗每日一张**：是否按「档案 + 日期」确定性地抽一张牌展示在面板？
- **OQ9 地址用词**：韩语用 `오늘의-운세` 还是 `오늘의운세`，西方站用 `/daily-numerology` 还是 `/numerology/today`。需在 ui-design 阶段与 SEO 关键词一并确认，上线后不再改动。

## 决策记录（2026-11-13，使用者确认）

使用者审阅后确认：本 change 的 Open Questions 全部采用设计中的默认/推荐方案；需要使用者审阅的文案与样例按本 change 的默认方案执行，上线前的验收截图仍按 tasks 留证。
