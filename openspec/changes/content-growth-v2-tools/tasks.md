# Tasks

> 并行与共享文件说明（遵守 docs/09-parallel-plan.md §3、§6）：
> - **波次与依赖**（★ = 12 月中关键路径，目标 12-15 上生产，见 design 决策 1）：
>   - 基础（立即开始，互不依赖）：★第 1 组（测量、审计、归属）、★第 2 组（路由与注册表字段）、★第 3 组（东方引擎）、★第 4 组（`@xuanxue/astro` 与月相引擎）、★第 5 组（设计稿登记，设计稿另行产出）。
>   - 波次 A 内容与 UI（文案立即开写；代码等依赖组合并；UI 实现等第 5 组登记对应画板的使用者确认）：
>     - ★第 6 组 ← 1、2、5
>     - ★第 7 组 ← 2、3、5
>     - ★第 8、9、10、11 组 ← 1、2、3、5（第 9、10、11 组复用第 8 组建的 `yearly` 集合与组件，代码在第 8 组合并后 rebase）
>     - ★第 12 组 ← 2、5；★第 13 组 ← 12；第 14 组 ← 12（非关键路径）
>     - ★第 15 组 ← 2、3、5
>     - ★第 16 组 ← 1、2、3、5；第 17 组 ← 16（2027-01-22 前，非关键路径）
>     - ★第 18 组 ← 1、2、3、5
>     - ★第 19 组 ← 1、2、4、5（es 子任务非关键路径）
>     - ★第 20 组 ← 1、2、5
>   - ★第 21 组：波次 A 集成验收与发版（协调者），在 ★ 组全部合并后执行。
>   - 波次 B：第 22 组 ← 4；第 23 组 ← 22、5（第二批画板）；第 24 组 ← 23；第 25 组 ← 22、23。
>   - 并入的 v1 第 3 阶段：第 26、27、28 组 ← 1、2、5（第二批画板），波次 A 之后开始，可与波次 B 并行。
>   - 第 29 组：最终集成验收（协调者），全部合并后执行。
> - **共享文件**：
>   - `apps/web/src/routes/$slug.tsx`、`apps/web/src/routes/$section/$item.tsx`：只由第 2 组修改。其他组只在 `features/east-content/routes.ts`、`features/east-en/paths.ts`、`features/west-content/routes.ts` 追加映射，冲突时合并两边的条目。
>   - `apps/web/content-collections.ts`：各组只改自己的集合块（`yearly` 归第 8 组建 schema，第 9、10、11 组只加内容；`compat` 归第 13 组；`zodiacPair` 归第 16 组，第 17 组只加内容；`tojeong` 归第 15 组；`almanac` 的 zh-Hant 字段归第 18 组；`moon` 归第 19 组；`westernZodiac` 归第 20 组；`angelNumbers`、`personalYear`、`tarotSpreads` 各归第 26、27、28 组）。
>   - `apps/web/src/features/tools/registry.ts`：第 2 组加字段类型（`directoryGroup`、`freeLabel`、`badge`），第 6 组定取值规则；其他组各自追加条目并填写这三个字段。冲突时合并两边。
>   - `apps/web/src/features/marketing/home-hub/data.ts`：只由第 6 组修改；其他组的工具 id 由第 6 组按决策 5 的表引用，未上线的 id 自动过滤。
>   - `packages/bazi/package.json`（`exports`）与 `packages/bazi/src/index.ts`：只由第 3 组修改。
>   - `packages/astro/**`、`pnpm-lock.yaml`、`scripts/check-deps.mjs`：波次 A 只由第 4 组修改，波次 B 只由第 22 组修改。lockfile 冲突按 §3 规则 4 处理。
>   - `apps/web/scripts/locale-similarity.mjs`、`measure-locale-similarity.mjs`、判定词审计脚本：只由第 1 组修改。
>   - `apps/web/src/features/tools/bazi/gunghap-page.tsx`、`birth-form-state.ts` 的对方资料部分：只由第 12 组修改。
>   - `apps/web/src/features/readings/catalog.ts` 与 `prompts/`：第 14 组（`saju-compat`）与第 23 组（`natal-full`）各改各的条目。
>   - `apps/web/src/features/east-content/almanac/*`：第 18 组可以加 `locale` 参数与胎神行，保持 zh-Hans 现有单测通过。
>   - `apps/web/messages/<locale>/<feature>.json`：按功能新建（如 `yearly.json`、`compat.json`、`zodiac-pair.json`、`tojeong.json`、`moon.json`、`western-zodiac.json`、`tools-hub.json`）。
>   - `apps/web/i18n/glossary/*.json`：各组追加条目，冲突时合并两边。
>   - `scripts/check-content-<集合>.mjs`：各组新建自己的文件。
>   - `docs/design/prototypes/README.md` 与 `docs/design/prototypes/content-growth-v2-tools/`：只由第 5 组登记。
>   - 私有证据目录 `content-growth/keyword-ownership.md`：各组把补登写在 `content-growth/v2/<组号>/keyword-ownership-add.md`，由协调者并入。
> - **约束**：不给关系决策判定（design 决策 14）；对方出生资料默认不保存（决策 7）；公开页不查数据库；不涉及 schema 与迁移；只勾选分配给自己的编号；不改第 2 阶段第二波（第 7–10 组）。
> - **建议执行者**：
>   - 第 1、2、3、4、22 组交给 Codex（工具、路由与纯函数，有单测把关），由 Claude 审阅；
>   - 第 5 组交给 Claude（设计稿另行产出，按约定由 Fable 承担设计与审美）；
>   - 第 6、7、12 组交给 Claude（UI 与交互）；
>   - 内容组（第 8–11、13、15–20、23–28 组）交给 Claude 子代理撰写，Codex 做事实、合规审阅或回译审阅（决策 17）；
>   - 第 14 组：Claude 起草提示词，评测由新开的 Claude 子代理复核，Codex 第二读者；
>   - 第 21、29 组由协调者执行。
> - **每组 PR 的通用验收**（design 决策 16）：
>   - `pnpm check`、`pnpm typecheck`、`pnpm check:deps`、`pnpm check:singletons`、相关单测；
>   - `pnpm --filter @xuanxue/web build`，包括首页包预算；
>   - 构建后 `check:links`、`audit:seo`、`check:i18n-seo` 不比 main 退步；新页面正文内链 2–5、锚文本每目标 ≤2 种、top1 ≤70%；
>   - 新集合 `measure-locale-similarity --enforce` 每段 ≤0.30；跨语言回译与结构直译分在门槛内；
>   - `check-locale-glossary` 通过；关系类页面判定词审计为 0；引擎事实复算脚本通过；
>   - 合规措辞：依据传统方法推算、仅供参考与潜意识探索、不预测未来（沿用站上现有措辞，画布中的「自我探索」不采用）；公开正文不提 AI、不用「娱乐」、不给吉日判定；ko 用합쇼체；
>   - 关键词归属补登；数据库不可达时新页面仍为 200；
>   - 证据写入私有证据目录 `content-growth/v2/<组号>/`，PR 只引用路径。

## 1. 测量、审计与关键词归属 ★

- [x] 1.1 在 `locale-similarity.mjs` 增加 design 决策 16 列出的新集合定义（东方 `yearly`、`zodiac-pair`、`compat-scenario`、`nongminli-month`；西方 `moon-month`、`western-sign`、`western-pair`、`angel-number`、`personal-year`、`tarot-spread`）。西方集合按词二元组、东方按字二元组（2026-11-24 协调者修订为按语言选择：中日韩按字，英西按词），`data-table-section` 段只报告。补 `measure-locale-similarity.test.mjs` 单测，并在 main 构建上跑一次确认现有集合结果不变，报告存证据目录
- [x] 1.2 新建判定词审计：按语言维护判定词表（决策 14），审计 Title、H1、H2、FAQ、正文与锚文本；`--rule verdict` 覆盖全部关系类页面与第 2 阶段生肖页，`--rule marriage-topic` 保持第 2 阶段原规则，并排除生肖页指向配对页的链接锚文本。单测覆盖命中、未命中与排除规则；在 main 构建上运行结果为 0
- [x] 1.3 用原型数据估算各新集合组件段需要的独有字数（同第 2 阶段第 1 组做法），必要时上调 design 决策 16 的长度下限，结论写入证据目录并在 PR 中说明
- [x] 1.4 在私有关键词归属表中按 design 决策 13 登记本 change 全部主词为「计划」，包括「英文生肖归东方站」的跨站条目；用第 1 阶段的核对脚本确认当前没有可索引页以这些词为 Title 或 H1 开头（重点核对第 2 阶段生肖子页与 2027 年度页、太岁概念页与 2027 太歲页、`/ko/사주궁합` 与场景页）。如需改写 slug 措辞，在 PR 中列出并通知第 2 组

## 2. 路由分发与注册表字段 ★

- [x] 2.1 按 design 决策 3 扩展东方站分发：`EastContentRoute.locale` 加 `zh-Hant`、`ja`，增加新集合 id；`$section/$item` 中东方 zh-Hant、ja 两段地址交给 `east-content`；东方站根路径英文先查 east-en 内容映射（`/chinese-zodiac*`、`/bazi-compatibility*`），再落到塔罗。各语言合盘工具页加入 `EASTERN_PAGES`（id `gunghap`）。单测覆盖：未登记地址 404、西方站同路径 404、现有生肖、黄历、塔罗与排盘页不变
- [x] 2.2 新建 `features/west-content/routes.ts`（只放地址与页面 id）与按需加载的 `route-data.ts`；`$slug` 与 `$section/$item` 增加西方站分支，已有路由目录不动。单测覆盖：东方站同路径 404、未登记地址 404、现有 `/life-path-number/7` 与 es 数字页不变
- [x] 2.3 实现配对类反序地址的 301（东方按地支、西方按黄道序），单测覆盖三种语言与同生肖 / 同星座组合
- [x] 2.4 `ToolRoute` 增加 `directoryGroup`、`freeLabel`、`badge` 字段类型与校验（`badge.until` 为合法日期），现有条目填写默认值；`check-home-bundle` 记录前后数据，首页包增长 ≤2 KB gzip

## 3. 东方引擎补充（packages/bazi）★

- [x] 3.1 在 `@xuanxue/bazi/almanac` 增加 `zodiacYearFacts(year)`、`zodiacPairFacts(a, b)` 与 `zodiacPairTable()`（design 决策 4），输出只含稳定 key；单测用 `lunar-javascript` 交叉核对 2027 丁未的 12 支关系（值太岁未、冲太岁丑等）与 78 组配对的关系类型
- [x] 3.2 `almanacDay` 增加胎神占方（tyme4ts `FetusDay`），升 `ALMANAC_RULES_VERSION`；单测固定 2027 年 1 月若干日的胎神并与 `lunar-javascript` 核对；zh-Hans 黄历现有单测保持通过
- [x] 3.3 新增子入口 `@xuanxue/bazi/tojeong`：`tojeongGwae()` 按 design 决策 8 的公式实现，导出 `TOJEONG_RULES_VERSION`。单测：测试内用 `lunar-javascript` 独立重写一遍，复算 1940–2010 每年 1、15、29 日出生对 2027 的结果；固定 5 个公开示例（来源记入证据目录）；覆盖闰月、小月 30 日与阴历输入
- [x] 3.4 确认 `@xuanxue/bazi` 主入口不引入新模块（`check-bazi-build` 通过），不改 `pnpm-lock.yaml`

## 4. 西方引擎：@xuanxue/astro 与月相 ★

- [x] 4.1 新建 `packages/astro`（`@xuanxue/astro`），依赖 astronomy-engine（MIT，记录版本与许可）；子入口 `./moon`；在 `scripts/check-deps.mjs` 登记为业务包；`pnpm install --frozen-lockfile`、`pnpm check:deps`、`pnpm check:singletons` 通过
- [x] 4.2 实现 `moonPhaseTable`、`moonQuarterEvents`、`fullMoonNames` 与超级月亮、蓝月标记（design 决策 4、11），输出只含 key 与数值。单测与 USNO 月相表比对 2026–2027 全部主要月相时刻，误差 ≤2 分钟；参考表存为测试夹具
- [x] 4.3 提供构建期预计算函数：生成「构建日前 1 个月至后 14 个月」的逐日表与事件表，并导出覆盖期检查（剩余 <13 个月时报错）；单测覆盖跨年与覆盖期不足

## 5. 设计稿登记（设计稿另行产出）★

- [x] 5.1 设计稿第一批（design 决策 18 列出的波次 A 画板）由另行进行的 ui-design 工作产出。本项核对画板覆盖 design 决策 18 第一批全部条目，缺项时列给协调者；交使用者确认，记录原话。未确认的画板对应的 UI 实现不开始（第 6、7、8–13、15、16、18–20 组）
- [x] 5.2 第一批确认后，用 Artifact `read` 取回画板副本，存入 `docs/design/prototypes/content-growth-v2-tools/`，在 `docs/design/prototypes/README.md` 每个页面登记一行（日期、确认原话、文件、change 名）
- [ ] 5.3 第二批（三巨头、出生星盘、地名补全与未知时间态、后续工具、angel numbers、personal year、牌阵页）在第 23、26、27、28 组开工前产出并确认，同样存副本、登记索引

## 6. 工具分级信息架构（两站）★

- [x] 6.1 按 design 决策 5 改写 `home-hub/data.ts`：`FEATURED` 改为主卡、副卡、季节位，季节窗口按构建日期选择；入口卡显示 `freeLabel` 与小标。单测用注入日期覆盖 11-30、12-01、2-28、3-01 四个边界，覆盖「当前语言无该工具时顺补」；`landing-page.test.tsx` 更新；`check-home-bundle` 在预算内
- [x] 6.2 新建「全部工具」枢纽页（东方 zh-Hans、zh-Hant、ko、ja、en，西方 en、es，地址见决策 2）：服务端渲染，按 `directoryGroup` 分组，空组不显示，卡片为真实 `<a>`；页头工具下拉加「全部工具」入口。单测覆盖无 JS 时 HTML 含全部链接、西方站无生肖分组、两站不互链
- [x] 6.3 小标与标签规则：`badge.until` 过期后不渲染；详批按钮文案统一为「AI 详批 · {积分} 积分」（取价格快照）；公开正文与入口卡不出现 AI。单测覆盖过期与未发布语言不显示
- [x] 6.4 撰写各语言枢纽页说明与分组导语（Claude 子代理；Codex 审 zh-Hans、回译审其他语言）；验收：TDK、内链、`check:links` 无孤岛；390px 截图核对首页季节位与枢纽页；关键词归属补登

## 7. 个人年度流年工具（zh-Hans、zh-Hant、ko、en）★

- [x] 7.1 新建 `yearly-tool` 页面组件：复用八字表单与 ProfileBar，结果区渲染 `annualOutlook(chart, { startYear: 2027, years: 1 })`（干支与十神、与四柱和大运的关系、太岁、喜忌），无时辰时标注近似；结果后接已有 `bazi-full` / `saju-full` 详批按钮。登记四种语言地址与注册表（`directoryGroup: yearly`、2027 小标至 2027-02-28）。单测覆盖结果与引擎一致、无时辰、详批入口位置、数据库不可达 200
- [x] 7.2 Claude 子代理撰写四种语言的工具页说明（计算方法、读法、FAQ），ko 用「신년 사주」写法、不以「띠별 운세」「신년운세」为 Title 或 H1 目标；Codex 审 zh-Hans，回译审其他三种
- [x] 7.3 验收：长度与 TDK；四种语言互为 hreflang；内链与钱页入链 ≥3；390px 截图核对结果区；关键词归属补登

## 8. 2027 年度生肖页（zh-Hans）★

- [x] 8.1 在 `content-collections.ts` 新建 `yearly` 集合（schema 见 design 决策 6）；新建年度页与枢纽组件（关系表来自 `zodiacYearFacts`，出生年份与纳音来自 `zodiacYears`）；登记 zh-Hans 地址与注册表；构建期预渲染。新建 `scripts/check-content-yearly.mjs` 逐项复算正文与 frontmatter 中的干支与关系名。单测覆盖关系表与引擎一致、hreflang 只含已发布语言
- [x] 8.2 Claude 子代理撰写 `content/yearly/zh-Hans/2027/` 的枢纽与 12 篇（长度见决策 16），三个主题段用反思与建议语气，不写月份吉凶；Codex 做事实与合规审阅，记录存证据目录
- [x] 8.3 验收：组内相似度 `--enforce zh-Hans`；TDK、长度；内链（个人年度工具、生肖子页、六合或冲对象年度页）；在第 2 阶段生肖子页「本年与次年」段的现成句子加入链（每页最多 1 条）；390px 截图；关键词归属补登

## 9. 2027 年度生肖页（zh-Hant）★

- [x] 9.1 另一个 Claude 子代理另写 `content/yearly/zh-Hant/2027/` 枢纽与 12 篇（台湾、香港用语，不做字形转换）；登记 zh-Hant 地址与注册表
- [x] 9.2 验收：`--opencc` 同文字变体门槛（整页 ≤0.60、整句 ≤0.15、FAQ ≤0.40）；zh-Hant 组内相似度；Codex 回译审阅 TDK；与 zh-Hans 互为 hreflang；内链；关键词归属补登

## 10. 2027 年度띠页（ko）★

- [x] 10.1 另一个 Claude 子代理按韩语搜索词直接撰写 `content/yearly/ko/2027/` 枢纽与 12 篇（합쇼체），不以「띠별 운세」为 Title、H1、H2 或锚文本目标，流年段用「올해 흐름」；登记 ko 地址与注册表，补 ko 标签文案
- [x] 10.2 Codex 回译审阅（`measure-locale-backtranslation --export-input` / `--from-file`）与跨语言结构直译分；验收：ko 组内相似度、长度与 TDK、hreflang、内链（链接 `/ko/띠/<X>띠` 与 `/ko/2027-신년-사주`）、「띠별 운세」审计、390px 长标题截图、关键词归属补登

## 11. Chinese zodiac 与 2027（东方站 en）★

- [x] 11.1 新建 en 生肖枢纽 `/chinese-zodiac`：属相查询小工具复用 `zodiacBoundaries()`（客户端不加载 tyme4ts），12 生肖总表；登记 east-en 地址与注册表；Claude 子代理撰写正文（≥700 词）
- [x] 11.2 另一个 Claude 子代理撰写 `content/yearly/en/2027/` 枢纽与 12 篇（year of the fire goat 2027）；登记地址
- [x] 11.3 Codex 回译审阅；验收：en 组内相似度、长度与 TDK、术语表锚点（`i18n/glossary/en-east.json`）、四种语言 hreflang、内链、西方站无对应页（跨站归属审计）、关键词归属补登

## 12. 合盘工具多语言化与对方资料 ★

- [x] 12.1 把 `gunghap-page.tsx` 改为接收 `locale` 与 `scenario` 的通用组件，文案移到 `messages/<locale>/compat.json`；ko 页面用快照测试锁定 H1、表单与结果区不变
- [x] 12.2 对方资料（design 决策 7）：去掉对方字段默认写入 sessionStorage；ProfileBar 不默认填充对方字段，「保存为档案」为显式操作；对方字段旁显示用途说明；新生成的分享片段与分享卡不含出生资料，旧链接兼容读取；首次加载清除旧会话中的对方值。单测覆盖关闭标签页后对方字段为空、分享链接不含生日、旧链接仍可打开
- [x] 12.3 登记 zh-Hant、zh-Hans、ja、en 合盘工具地址（`EASTERN_PAGES`）与注册表（`directoryGroup: relation`、`freeLabel`）；未开放详批的语言显示「即将开放」占位。单测覆盖五种语言 hreflang 与占位

## 13. 合盘场景页与多语言文案 ★

- [x] 13.1 新建 `compat` 内容集合：工具页正文与 5 个场景页（决策 2），每个 `CompatItemKey` × 场景一段解释；场景页嵌入合盘表单并预选场景；登记地址与注册表
- [x] 13.2 Claude 子代理撰写 zh-Hans 工具页与场景页；其他语言由各自的 Claude 子代理按本语言主词另写（ko 只写场景页，`/ko/사주궁합` 正文不改；ja、en、zh-Hant 写工具页与场景页）。亲子不写强化冲突的断语，合伙不写投资建议
- [x] 13.3 Codex 审 zh-Hans，回译审其他语言；验收：场景页组内相似度、长度与 TDK、判定词审计为 0、内链（工具页 ↔ 场景页、生肖配对总表）、390px 截图核对用途说明；关键词归属补登

## 14. 合盘详批的语言与场景（非关键路径）

- [ ] 14.1 `saju-compat` 增加 zh-Hant、zh-Hans、ja、en 变体与 `scenario` 参数（新提示词版本号，旧版本不改），免责声明按 config 的合规分场景规则
- [ ] 14.2 `pnpm eval:prompts` 离线回放、`--no-judge` 生成样例；新开的 Claude 子代理按评分标准复核，Codex 第二读者审阅判定词与措辞；确定性检查把判定词列为失败项。报告存证据目录
- [ ] 14.3 交使用者审阅每种语言样例；同意后通过运行时设置开放对应语言（staging 先行），未同意的保持「即将开放」

## 15. 토정비결 2027（ko）★

- [x] 15.1 新建 `tojeong` 集合与工具页：阳历 / 阴历输入（含闰月）、目标年份（默认 2027）、三괘与괘 번호、解读按需加载；分享参数地址 `noindex, follow`、canonical 指向工具页、不进站点地图。新建 `scripts/check-content-tojeong.mjs` 校验 144 个괘 번호齐全、每段长度在 250–400 字。单测覆盖阴阳历、闰月、noindex
- [x] 15.2 Claude 子代理撰写工具页正文（≥2,000 字，含「계산 방법」与流派差异说明）与 144 段原创解读（합쇼체，反思与建议语气，不预测事件、月日、疾病）
- [ ] 15.3 Codex 做合规、합쇼체与原创性抽样比对（对照公开现代译本，记录存证据目录）；验收：TDK、内链（만세력、个人年度工具）、390px 截图、关键词归属补登
  - [x] 15.3.1 完成合规、합쇼체、自然度和事实复核，逐条比对 32 段与公开现代译解；修订与比对记录见私有证据目录 `content-growth/v2/15/review.md`
  - [x] 15.3.2 核对 TDK、만세력 正文内链、390px 截图与关键词归属补登
  - [ ] 15.3.3 第 7 组注册 `/ko/2027-신년-사주` 后，验收个人年度工具正文内链

## 16. 生肖配对（zh-Hans 78 页与总表）★

- [x] 16.1 新建 `zodiacPair` 集合与组件：总表 12×12（手机端按设计稿）、配对页（关系事实来自 `zodiacPairFacts`）；登记地址与注册表；构建期预渲染。新建 `scripts/check-content-zodiac-pair.mjs` 复算关系与五行。单测覆盖反序 301、总表 78 个链接、hreflang 只含已发布语言
- [x] 16.2 Claude 子代理撰写总表与 78 篇（每篇 ≥800 字，按 design 决策 9 的 H2），不对任何生肖作贬损描述；Codex 做事实与合规审阅
- [x] 16.3 验收：组内相似度 `--enforce zh-Hans`、判定词审计为 0、长度与 TDK、内链（合盘工具、生肖子页、同三合组配对）；第 2 阶段生肖子页关系段的现成句子加 1 条配对入链（`zodiac-pages` 修改）；关键词归属补登

## 17. 띠궁합（ko）与 Chinese zodiac compatibility（en）（2027-01-22 前，非关键路径）

- [x] 17.1 两个 Claude 子代理分别按韩语、英语搜索词另写 ko、en 总表与 78 篇（不由 zh-Hans 翻译）；登记地址与注册表
- [x] 17.2 Codex 回译审阅；验收：各自组内相似度、判定词审计、长度与 TDK、术语表锚点、hreflang、内链、关键词归属补登

## 18. 農民曆与 2027 太歲（zh-Hant）★

- [x] 18.1 黄历组件加 `locale` 参数与胎神行，登记 `/zh-hant/農民曆` 与 12 个月份页（`prerender: false`，沿用边缘缓存）；日期查询 `noindex, follow`；新建 `content/almanac/zh-Hant/`。zh-Hans 黄历单测保持通过，补 zh-Hant 路径与胎神用例
- [x] 18.2 新建 2027 太歲页（集合 `tai-sui-year`，表来自 `zodiacYearFacts`），无化解、报名或商品链接
- [x] 18.3 Claude 子代理另写農民曆工具页、12 个月份页与 2027 太歲页（台湾、香港用语）；Codex 回译审阅
- [x] 18.4 验收：`--opencc` 同文字变体门槛；月份页组内相似度；无擇日筛选；内链；数据库不可达 200；第二次请求命中缓存；关键词归属补登

## 19. 月相（西方站 en，es 跟进）★

- [x] 19.1 新建 `moon` 页面组件：今日月相、满月、月历枢纽与 12 个月份页、年度满月表（design 决策 11）。数据为构建期预计算表，客户端按本地日期与时区选行，不加载 astronomy-engine；月份页年份滚动；查询参数 `noindex, follow`。登记 west-content 地址与注册表（`directoryGroup: moon`）。新建 `scripts/check-content-moon.mjs` 复算正文中的月相日期与满月名。单测覆盖时区、年份滚动、覆盖期检查、数据库不可达 200、首页包不含 astronomy-engine
- [x] 19.2 Claude 子代理撰写 en 各页与 12 个月份页（满月名由来、观月提示、FAQ），不写健康、生育暗示；Codex 做事实与合规审阅
- [x] 19.3 验收：月份页组内相似度 `--enforce en`、长度与 TDK、内链（满月 ↔ 年度表 ↔ 当月月历）、390px 截图、关键词归属补登
- [ ] 19.4 （非关键路径）另一个 Claude 子代理按西语主词另写 es 今日月相、满月、月历枢纽三页；Codex 回译审阅；术语表锚点（`i18n/glossary/es.json`）；hreflang

## 20. 西方星座档案与配对（en）★

- [x] 20.1 新建星座事实表与 `westernZodiac` 集合、档案页、配对总表与配对页组件（design 决策 12）；登记地址与注册表（`directoryGroup: compatibility` 与 `astrology`）。新建 `scripts/check-content-western-zodiac.mjs` 复算元素、模式与角距。单测覆盖反序 301、总表 78 个链接
- [x] 20.2 Claude 子代理撰写枢纽、12 个档案页、总表与 78 个配对页；Codex 做事实与合规审阅
- [x] 20.3 验收：`western-sign`、`western-pair` 组内相似度、判定词审计为 0、长度与 TDK、内链（档案 ↔ 配对 ↔ 总表）、术语表锚点、关键词归属补登

## 21. 波次 A 集成验收与发版（协调者）★

- [ ] 21.1 main 生产构建后运行全部新集合的 `measure-locale-similarity --enforce`、`check:links`、`audit:seo`、`check:i18n-seo`、`check-locale-glossary`、判定词审计与全部 `check-content-*.mjs`：孤岛、死链与判定词为 0；首页包在预算内。报告存证据目录
- [ ] 21.2 并入各组的关键词归属补登，状态改为「现行」，运行核对脚本：冲突为 0，各语言可索引页 Title、H1 两两不重复；西方站无生肖页
- [ ] 21.3 随统一发版上 staging，抽查每个集合至少一页的 TDK、robots、canonical、hreflang 与缓存头；数据库不可达时新页面仍为 200；首页季节位显示 2027；合盘分享链接不含生日。生产发版需使用者授权
- [ ] 21.4 按 design 决策 21 生成请求编入索引的优先队列（每天 ≤10 个、两站合计），交 Grok bot 按清单执行；2–4 周后按集群复查 GSC，结论存证据目录

## 22. 星盘引擎、地名与时区（波次 B）

- [x] 22.1 在 `@xuanxue/astro` 增加子入口 `./chart`：行星视黄经、平均月交点、上升与天顶、Placidus 与整宫制宫头、主要相位（design 决策 19）；`./moon` 不引入 chart 代码（构建检查）
- [x] 22.2 地名与时区：GeoNames cities15000 按首字母切片为静态 JSON（R2 或随构建发布，页面署名 CC-BY），历史时差与夏令时由 `Intl` 求得；不查数据库。单测覆盖夏令时切换当日、1970 年前、日期变更线附近
- [x] 22.3 精度门槛：30 个参考样例（南北半球、纬度 >66°、夏令时边界、1970 年前），参考值存为测试夹具；行星 ≤1 角分、上升与天顶 ≤0.05°、Placidus 宫头 ≤0.1°、落座与落宫全部一致；纬度 >66° 时改整宫制并有用例。报告存证据目录，未通过不开始第 23 组

## 23. 三巨头计算器、出生星盘与完整解读（波次 B）

- [x] 23.1 实现三巨头计算器与出生星盘页（地址见决策 2），含地名自动补全、未知出生时间态（只给太阳、月亮，月亮跨座时列两个可能）、星盘图与行星表；客户端按需加载引擎。单测覆盖未知时间、跨座、错误输入
- [x] 23.2 新增详批 `natal-full`（en）：服务端复算星盘后生成；评测流程同第 14 组；使用者审阅样例后开放（使用者 2026-11-24「样例确认，合并后做B12/B13然后发版」；波次 B 发版 PR 删去评测待定项、开放 en、开关代码默认开启）
- [x] 23.3 Claude 子代理撰写两页正文；Codex 审阅；验收：长度与 TDK、内链、钱页入链 ≥3、术语表锚点、关键词归属补登

## 24. 上升与月亮落座页（波次 B，可选）

- [ ] 24.1 第 23 组上线 4 周后由协调者按 GSC 数据决定是否做与做哪些子集，记录使用者裁定；被裁掉时标注「已裁剪（日期，使用者原话）」，不勾选
- [ ] 24.2 按裁定分批撰写与上线，每批过 `--enforce` 组内相似度与通用验收

## 25. 同引擎后续工具（波次 B）

- [ ] 25.1 合盘（synastry）：两人星盘相位表，遵守判定词审计与第三方资料规则（同第 12 组）；精度沿用第 22 组夹具
- [ ] 25.2 逆行日历：预计算、预渲染，当年与次年行星逆行起止时刻，不查数据库；与 ephemeris 参考比对 ≤2 分钟
  - [x] 25.2.1 `@xuanxue/astro/retrograde`（视黄经速度变号求停滞）、构建期停滞表与覆盖期检查、`/retrograde-calendar` 页面（设计稿 RetroCalendar 四块）、注册表与内链、`scripts/check-content-retrograde.mjs`；正文副本在私有证据目录 `content-growth/v2/25/review-input/`
  - [ ] 25.2.2 精度：与 Swiss Ephemeris 2025–2028 共 71 次停滞比对，日期全部一致，≤2 分钟 25/71（水星至火星最大 6.7 分、海王星与冥王星最大 41 分，astronomy-engine 精度所限）；按行星分级的门槛待协调者裁定，报告见 `content-growth/v2/25/retrograde/`
  - [ ] 25.2.3 Codex 事实与合规审阅
- [ ] 25.3 土星回归与太阳返照计算器：用黄经搜索实现，测试与参考值比对
- [ ] 25.4 每项各自的设计稿、文案、审阅与通用验收，分别开 PR

## 26. angel numbers（en、es）

- [x] 26.1 新建 `angelNumbers` 集合、枢纽与数字页组件，登记地址与注册表；单测覆盖枢纽只列已发布数字、hreflang 只列已发布对应页
- [x] 26.2 Claude 子代理撰写 en 枢纽与约 30 个数字页；另一个子代理按「números angelicales」另写 es（数字集合可以不同）；Codex 审 en、回译审 es
- [x] 26.3 验收：组内相似度、长度与 TDK、内链（生命灵数页）、术语表锚点、关键词归属补登

## 27. personal year 计算器与 9 页（en、es）

- [x] 27.1 新建计算器与 1–9 年份数页，复用已有逐年个人年数规则；单测锁定计算器与详批逐年个人年数一致
- [ ] 27.2 Claude 子代理撰写 en；另一个子代理另写 es；Codex 审阅与回译
  - [x] 27.2.1 两个 Claude 子代理分别撰写 en 与 es（es 按西语主词另写，不由 en 翻译），文案副本存私有证据目录 `content-growth/v2/27/review-input/`
  - [x] 27.2.2 Codex 审阅 en（事实与合规）、回译审阅 es
- [x] 27.3 验收：组内相似度、长度与 TDK、内链、关键词归属补登

## 28. 塔罗牌阵页（en）

- [x] 28.1 新建爱情、事业、满月牌阵页（复用抽牌组件），各位置含义与正文；Title、H1 不以 free tarot reading 开头；满月牌阵与月相页互链
- [x] 28.2 Claude 子代理撰写；Codex 审阅；验收：组内相似度、判定词审计、长度与 TDK、内链、关键词归属补登

## 29. 最终集成验收（协调者，全部合并后在 main 上执行）

- [ ] 29.1 main 生产构建后重跑第 21.1 项的全部检查（含波次 B 与第 26–28 组集合），全部通过；报告存证据目录
- [ ] 29.2 确认 `content-growth-phase2` 已归档（`zodiac-pages`、`almanac-pages` 已在 `openspec/specs/`），再同步与归档本 change；未归档时等待或按 design 决策 14 处理两份 delta
- [ ] 29.3 并入剩余关键词归属补登并核对；生成第二轮请求编入索引队列交 Grok bot；在证据目录写年度维护备忘（2027-11 裁定 2027 页处理、准备 2028 年度页与季节位、月相表覆盖期）
