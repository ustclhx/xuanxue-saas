# Tasks

> **执行约定**
> - **负责人**：
>   - 【Claude】复杂开发、设计敏感项、评审；
>   - 【Codex】简单改动、浏览器核对、部署；
>   - 【用户】决策与批准。
> - **worktree 与波次**：
>   - 每个带 `WT-x` 标记的组一个 worktree、一个 PR；
>   - 波次 0（组 1）先行；
>   - 波次 A（组 2、3、4）可并行；
>   - 波次 B（组 5、6、7）分别依赖波次 A 中标注的组，以及组 1 中对应的设计稿；
>   - 组 8 依赖 2、3、7；组 9 是集成验收。
> - **迁移**：worker 用 `drizzle-kit push`，不提交迁移 SQL；迁移在 9.1 由协调者在 main 上生成（并行计划 §3）。schema 只改新文件 `packages/db/src/schema/profiles.ts`。
> - **文案**：新建 `messages/<locale>/profiles.json` 与 `daily.json`，四种语言（en、zh-Hant、zh-Hans、ko）齐全。
> - **共享文件冲突点**（合并时按 §3 处理）：
>   - `packages/db/src/schema/index.ts`：只追加一行导出；
>   - `apps/web/src/server.ts`：7.3 插入缓存函数；
>   - `apps/web/src/features/seo/pages.ts`：7.4；
>   - `apps/web/src/routes/app/$slug/index.tsx`：模板文件，8.1 只插挂载点；
>   - `apps/web/src/features/app-shell/nav.project.ts`：5.1；
>   - `apps/web/src/features/tools/bazi/birth-fields.tsx` 与 numerology 计算器：6.x。可能与同批的 `redesign-home-chart-visuals` 冲突，由协调者安排先后，后合并的一方 rebase；
>   - `scripts/check-ui.allow.local.json`：只追加。
> - **证据**：写入 `EVIDENCE_DIR`（仓库外）。生产与外部凭据相关的验收不在 PR 中预先勾选。

## 1. 波次 0：决策与设计稿（不改代码）

- [ ] 1.1 【用户】确认 design.md 的 OQ1（西方站参考时区）与 OQ9（四个公开地址用词）。其余 OQ 不阻塞本 change。验证：决定记录到 design.md 的 Decisions D8 与 D9，并删去对应的 OQ
- [ ] 1.2 【Claude → 用户确认】用 `ui-design` 技能产出档案相关设计稿：档案管理页（列表、新建或编辑对话框、删除确认、默认与「本人」标记）、工具表单的档案选择器（单人与宫合双人）、「存为档案」对话框，包括东西两站的样式、桌面与 390px 手机。验证：用户确认后，离线副本保存到 `docs/design/prototypes/` 并登记到原型索引
- [ ] 1.3 【Claude → 用户确认】用 `ui-design` 技能产出公开每日运势页设计稿：东方站（今日干支、宜忌与建除、十日主区块、本地个人化入口）、西方站（宇宙日步骤、个人日 1–9 与 11、22、本地计算器），以及合规声明的位置。验证：同 1.2，两站桌面与 390px 各一份
- [ ] 1.4 【Claude → 用户确认】用 `ui-design` 技能产出今日面板设计稿：有默认档案、切换档案、无档案、字段缺失四种状态，含两站版本。验证：同 1.2

## 2. 波次 A · WT-engine：引擎流日与个人日（【Claude】）

- [x] 2.1 在 `packages/bazi/src/daily.ts` 实现 `dayPillarOf(date)`：日柱、农历日，以及宜忌与建除的键，来自 tyme4ts，不带本地化文字。从 `index.ts` 和新的子入口导出，并导出 `DAILY_RULES_VERSION`。验证：单测用 10 个以上已知日期核对日柱，至少包括 2026-11-13 和跨年、闰月附近的日期；民用日界下 23:30 不换日
- [x] 2.2 实现 `dailyRelations(chart, date)`：返回十神，以及日支与本命各支的冲、合、三合、刑、害。复用 `compat.ts` 的函数，补上六害。验证：单测覆盖辰戌冲、子丑合、寅巳申刑、子未害，以及时辰未知时只比较三支
- [x] 2.3 在 `packages/numerology` 增加 `universalDay`、`personalMonth`、`personalDay`，返回值带 steps，11、22 保留为主数。验证：单测覆盖 spec 的「步骤可展示」与「调用方传入本地日期」两个场景，以及结果为主数的情况
- [x] 2.4 更新 `packages/bazi` 与 `packages/numerology` 的 README 或包内说明，补上新函数与版本号约定。验证：`pnpm typecheck`、`pnpm test --filter @xuanxue/bazi --filter @xuanxue/numerology` 通过

## 3. 波次 A · WT-profiles-data：档案数据与服务（【Claude】）

- [x] 3.1 新建 `packages/db/src/schema/profiles.ts`，内容见 design D1：表、check 约束、两个部分唯一索引与查询索引。`schema/index.ts` 追加导出；本地 `drizzle-kit push`。验证：`pnpm typecheck` 通过；本地库中可看到表与索引
- [x] 3.2 新建 `apps/web/src/features/profiles/schema.ts`：从 `readings/catalog.ts` 抽出共用的 `birthInputSchema`，详批改为引用它，行为不变；新增按站点必填的 `birthProfileSchema` 与 `profileFor(tool, profile)`。验证：单测覆盖东方站缺性别时拒绝、西方站只填日期时通过、农历闰月非法时拒绝，以及 `profileFor` 返回的 missing 列表；详批现有测试全部通过
- [x] 3.3 实现 `profiles.functions.ts`：list、get、create、update、delete、setDefault。要求个人空间，`scoped` 加用户过滤；事务内维持 20 份上限与默认档案转移；越权按 NOT_FOUND 处理。验证：集成测试覆盖越权读写、第 21 份被拒、两个并发请求同时新建不会超限、第二份「本人」被拒、删除默认档案后自动转移、第一份档案自动成为默认
- [x] 3.4 在 `features/readings/deletion.server.ts` 的 `workspaceContentDeletionStep` 中加入删除 `birth_profile`。验证：集成测试中删号后该用户档案为 0，另一站同邮箱账户的档案保留（对应 account-deletion 增量 spec）
- [x] 3.5 数据最小化：server function 的日志与审计只记录档案 id，错误上报不带请求体。验证：单测断言创建或更新失败时的日志字段不含 `birth` 与 `full_name`
- [x] 3.6 在 `docs/03-data-model.md` 登记 `birth_profile` 表与隐私约束。验证：文档与 schema 字段一致

## 4. 波次 A · WT-privacy：隐私政策（【Claude 起草 → 用户确认】）

- [x] 4.1 两站四份 `content/legal/*/privacy.mdx` 各新增「出生档案」小节，内容包括存储、用途、保存期限（直到删除档案或账号，备份最多 7 天）、删除方式、不发送给 AI 提供方；并把「免费工具不向服务器发送资料」改为「除非你主动保存档案」。保存期限列表与「如何删除」段同步更新。验证：用户确认文案；`e2e/marketing.spec.ts` 的法律页用例通过；预渲染 HTML 中可搜到该小节

## 5. 波次 B · WT-profiles-ui：档案管理页（【Claude】，依赖 3、1.2）

- [x] 5.1 用 `new-page` 技能新增 `/app/$slug/profiles`，含列表、新建或编辑对话框、删除用的 AlertDialog、设为默认，并在 `nav.project.ts` 用 `registerAppNav` 登记入口。表单复用 `birth-fields.tsx` 的字段组件，按站点显示字段。验证：组件测试覆盖空态、默认与「本人」标记、字段错误提示；`pnpm check`（含 check:ui）通过
- [x] 5.2 新建四种语言的 `messages/*/profiles.json`。验证：`pnpm typecheck` 生成文案无缺项；`pnpm test` 不报告缺失翻译
- [x] 5.3 e2e：登录后新建、编辑、设为默认、删除档案，东西两站各跑一次。验证：`pnpm --filter @xuanxue/web test:e2e profiles.spec.ts` 通过，截图存入 `EVIDENCE_DIR`

## 6. 波次 B · WT-profiles-tools：工具页接入档案（【Claude】，依赖 3、1.2）

- [ ] 6.1 实现 `ProfilePicker` 与「存为档案」对话框。入口只在登录态出现（复用页头的 viewer 状态），档案在用户打开选择器时才请求。验证：组件测试断言未登录时不渲染入口且没有请求；登录后首次打开选择器才发出一次请求
- [ ] 6.2 接入东方站排盘表单：八字首页、命盘查询、紫微、만세력，以及사주궁합的双人 `a_` / `b_`。缺失字段时预填已有值，并提示补全。验证：组件测试覆盖填入与缺性别提示；e2e 中从档案填入后提交，结果与手动填写一致
- [ ] 6.3 接入西方站数字命理计算器：完整版、Life Path、姓名类（全名可选）。验证：组件测试覆盖填入日期与全名；e2e 中断网后用已填入的值提交仍出结果（对应 tool-pages「首屏零等待」）
- [ ] 6.4 回归详批：用档案预填后解锁，`reading.input` 是快照；之后修改档案，报告不变；解锁令牌中没有档案 id。验证：集成或 e2e 用例覆盖 paid-readings 增量 spec 的两个场景
- [ ] 6.5 埋点核对：从档案填入、存为档案的事件不带出生资料。验证：单测断言事件 payload 的键白名单

## 7. 波次 B · WT-daily-public：公开每日运势页（【Claude】，依赖 2、1.1、1.3）

- [ ] 7.1 【Claude 起草 → 用户审定】规则文案表 `features/daily/rules/<locale>.ts`，带 `DAILY_COPY_VERSION`：
  - 东方站三语：十神 × 每类 3 条以上的「主题、建议、留意」，地支关系各类提示，建除 12 项与常见宜忌词条的释义；
  - 西方站英语：宇宙日与个人日 1–9、11、22 的含义。

  同一类事实按日期确定性轮换。验证：合规检查单测断言无「AI」、无医疗、投资、法律的确定性措辞、无吉凶断语黑名单词；用户抽检 20 条通过
- [ ] 7.2 实现 `features/daily/facts.ts`（引擎结果 → `DailyFacts` → 文案键）与四个语言路由。页面包括参考日期计算、H1 与日期、规则区块、合规声明、本地个人化表单（东方站按需 import 引擎；西方站直接计算），以及水合后按本地日期重算。验证：单测断言 loader 不访问 db；组件测试覆盖本地日期不同时替换区块，并核对 spec 的「查看日主提示」「计算个人日」场景
- [ ] 7.3 在 `server.ts` 加入 `dailyPageCache`：不带会话 cookie 的 GET 请求使用 `caches.default`，键为规范 URL 加参考日期，TTL 为到参考日结束的秒数且不超过 3600，带会话的请求直接旁路。验证：单测覆盖带 cookie 不读不写缓存、跨日键变化、TTL 计算；`pnpm build` 后用 wrangler dry-run 验证打包
- [ ] 7.4 SEO：页面加入 `publicPages`（站点地图、hreflang、构建期 OG），不进入预渲染列表；输出 `WebPage` 结构化数据；`llms.txt` 增加该页；营销首页与相关工具页加站内入口（与 `redesign-home-chart-visuals` 协调位置）。验证：`src/features/seo` 单测与 `indexing.test.ts` 通过；繁体子站点地图含该页与 alternate；西方站页面没有东方站的 hreflang
- [ ] 7.5 e2e：禁用 JS 时请求四个语言页，HTML 含 H1、日期与规则内容；在数据库不可达的情况下请求返回 200（对应 spec「数据库不可达」）。验证：`test:e2e daily.spec.ts` 通过

## 8. 波次 B · WT-today-panel：今日面板（【Claude】，依赖 2、3、7.1、7.2、1.4）

- [ ] 8.1 新建 `features/daily/today-panel.tsx` 与服务端 loader：个人空间、一次档案查询、按参考日期计算默认档案的 `DailyFacts`、`?profile=` 切换（越权按不存在处理）、无档案和字段缺失两种状态、水合后按本地日期重算。在模板文件 `routes/app/$slug/index.tsx` 中只插入挂载点，并在 `docs/design/forks.md` 或项目升级跟踪中登记该改动。验证：组件测试覆盖四种状态；集成测试覆盖越权 profile 参数；e2e 登录后首页显示默认档案的今日内容
- [ ] 8.2 面板链接：「用此档案打开工具」使用 `#r=` 片段（不含姓名）；另有「查看公开每日页」。验证：单测断言生成的链接片段不含 `name` 与 `full_name`
- [ ] 8.3 （可选，依赖 1.4 中确认保留此入口）「就今日运势问 AI」：在 `features/ai/subject-providers.ts` 注册 `daily` 类型，用 `issueSubjectContext` 签发只含 `DailyFacts` 的临时上下文，按 Chat 场景显示 AI 声明。验证：单测断言上下文正文不含出生日期与出生地；e2e 能打开对话并看到上下文类型标签

## 9. 集成验收

- [ ] 9.1 【协调者】组 3 合并后，在 main 上运行 `drizzle-kit generate`，生成 `birth_profile` 的扩展型迁移，带 `lock_timeout` 与 `-- rollback-safe:` 注释，并提交 PR。验证：本地空库与已有数据的库都能迁移成功；`pnpm test` 集成测试通过
- [ ] 9.2 【Codex】staging 验收（需用户批准合并以触发 staging 部署）：
  - 两站登录后完成档案增删改与默认切换；
  - 工具页填入并出结果；
  - 用档案预填解锁一份详批；
  - 删号后档案为 0（用测试账号）；
  - 四个语言的公开每日页、禁用 JS 抓取，以及第二次请求命中缓存（看响应头 `cf-cache-status` 或自定义命中头）；
  - 今日面板四种状态；
  - 390px 无横向滚动，浅色与深色主题。

  验证：状态表与截图存入 `EVIDENCE_DIR`
- [ ] 9.3 【用户批准 → Codex】发布 production（推送 `v*` tag），并检查 `/api/health` 的 SHA 与部署流水线成功。一周内查看 Neon Usage，确认运行时长没有因每日页明显上升。验证：发布记录与 Neon Usage 截图存入 `EVIDENCE_DIR`
- [ ] 9.4 【协调者】全部任务合并并验收后，按并行计划同步 specs 并归档本 change。验证：`openspec validate --strict` 通过；`openspec list --json` 中不再有本 change
