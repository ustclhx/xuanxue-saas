# Tasks

> 并行与共享文件说明（遵守 docs/09-parallel-plan.md §3、§6）：
> - 第 1 组先合并（体量小）。第 2–6 组彼此独立，可以各开一个 worktree 并行；第 2、3 组的最终门槛依赖第 1 组的测量工具，文案可以先写。第 7 组由协调者在全部合并后执行。
> - 共享文件：
>   - `apps/web/content-collections.ts`：第 2 组改 `tarot` 集合，第 3、6 组改 `numerology` 集合。各改各的集合块，后合并的一方 rebase 时保留双方字段。
>   - `apps/web/src/features/tools/numerology/content.functions.ts`：第 3、6 组都可能改，冲突时合并两边字段。
>   - `apps/web/src/features/tools/registry.ts`：只由第 6 组修改（入门页条目）。
>   - `messages/<locale>/tarot.json` 只由第 5 组修改；第 2 组不改 messages。
>   - `apps/web/i18n/glossary/es.json`：第 2、3、6 组可能各自增加锚文本条目，冲突时合并。
> - 不做婚姻、配对类工具（design「约束」）；不改现有 `/ko/사주궁합`。
> - 不涉及 schema 与迁移，不改 `pnpm-lock.yaml`。只勾选分配给自己的编号。
> - 建议执行者：第 1、4 组交给 Codex（简单代码改动）；第 2、3、5、6 组交给 Claude（文案量大或需要设计稿）。每组 Claude 写的 es、zh、ko 文案由 Codex 回译审阅（design 决策 8）。
> - 每组 PR 的通用验收：`pnpm check`、`pnpm typecheck`、`pnpm check:deps`、相关单测、`pnpm --filter @xuanxue/web build`（含首页包预算），以及构建后 `check:links`、`audit:seo`、`check:i18n-seo` 不比 main 退步。证据写入私有证据目录 `content-growth/phase1/<组号>/`，PR 只引用路径。

## 1. 测量工具与关键词归属表

- [ ] 1.1 在 `apps/web/scripts/locale-similarity.mjs` 增加组件段对照表：牌义页导语、抽一张、延伸牌义；数字页首屏样例（es 截到结果区声明为止）、其余数字。按 en、es 段标题正则对齐，只计组件部分。补 `measure-locale-similarity.test.mjs` 单测；`pnpm check` 通过
- [ ] 1.2 在 `measure-locale-similarity.mjs` 的报告中输出「组件段」表（每语言每段的平均与最差页）。`--enforce en,es` 时任一段 >0.30 以 1 退出。在 main 构建上复现 design.md 基线表：en 0.549、1.0、0.405、0.736、0.677；es 0.490、1.0、0.385、0.712、0.729。报告存入证据目录
- [ ] 1.3 在私有证据目录建立 `content-growth/keyword-ownership.md`，按站点 × 语言 × 主词 → 页面登记：本 change 的 1.3、1.4 主词，es、ja 已有的塔罗与数字命理主词，以及各牌阵页的子词。核对没有两个页面以同一主词为 Title 或 H1 目标

## 2. 牌义页组件段逐牌撰写（西方站 en、es）

- [x] 2.1 在 `content-collections.ts` 的 `tarot` 集合 schema 增加可选字段 `lede`、`try_prompt`、`related_note`。`meaning.functions.ts` 随 loader 下发。`meaning-page.tsx`：页头显示 `lede`（缺失时显示 description）；`TryOneCard` 接收说明句（缺失时用 `tarot_meaning_try_intro`）；`RelatedMeanings` 的说明句用 `related_note`（缺失时用 `tarot_related_intro_*`）。补组件单测，覆盖有字段与缺字段两种情况，并验证东方站页面输出不变
- [x] 2.2 en 78 篇按花色分 6 批写入三个字段（design 决策 2、3：`lede` 45–70 词，`try_prompt` 30–50 词，`related_note` 30–60 词），不新增链接。每批后运行组件段测量与 `node scripts/check-content.mjs`，最后三段均 ≤0.30
- [x] 2.3 es 78 篇由另一个子代理按西语习惯直接撰写同三字段（`lede` 建议 ≥55 词），遵守 `i18n/glossary/es.json`。组件段三段均 ≤0.30；`check-locale-glossary` 通过
- [ ] 2.4 es 回译审阅：用 `measure-locale-backtranslation.mjs --locale es --export-input` 导出，交给 Codex 回译后用 `--from-file` 计算，牌义页整页与 FAQ 不超过校准阈值；按审阅意见修改。报告存证据目录
- [ ] 2.5 验收：逐页比对 main，确认 4 条延伸牌义链接与转化条的目标与锚文本、Title、H1、meta description、canonical、hreflang 一致（脚本输出差异为 0）；es↔en 本地化门槛未达 0 页；`check:links`、`audit:seo` 不退步；`--enforce en,es` 的组件段测量通过

## 3. 数字页组件段逐数字撰写（西方站 en、es）

- [ ] 3.1 在 `content-collections.ts` 的 `numerology` 集合 schema 增加可选字段 `sample_note`、`neighbors`（`neighbors` 用 `[锚文本]` 标出链接位置，链接数与顺序同 `neighborNumbers()`）。`content.functions.ts` 随 loader 下发。`content-page.tsx` 的 `NeighborNumbers` 优先用 `neighbors`，并保留 `data-locale-fixed`。`LifePathCalculator`、`LifePathCard` 增加 `note`：传入时样例状态显示 `note`、去掉卡内短声明，`<Disclaimer />` 保留；`/life-path-number` 不传 `note`。单测覆盖：样例状态与提交后状态、链接目标与锚文本不变
- [ ] 3.2 en 12 篇写入 `sample_note`（100–130 词）与 `neighbors`（45–80 词）。`sample_note` 中的约简过程必须与 `exampleDateFor(n)` 的引擎步骤一致，`check-content-concepts` 校验通过；两段测量均 ≤0.30
- [ ] 3.3 es 12 篇由另一个子代理按西语习惯直接撰写同两字段，样例说明按 es 的约简写法（如「se conserva」）。两段（只计组件）均 ≤0.30，`check-locale-glossary` 通过；es 回译审阅流程同 2.4
- [ ] 3.4 验收：390×844 截图，en `/life-path-number/7` 与 es `/es/numero-de-vida/7` 首屏表单与提交按钮仍可见；结果区底部有合规声明；`check:links`、`audit:seo` 不退步；es↔en 本地化门槛（结构直译、数字序列）未达 0 页

## 4. 空博客列表不进索引（两站全部语言）

- [ ] 4.1 在 `apps/web/src/routes/blog/index.tsx` 的 `head` 中读取 loader 的 `posts`，为空时追加 `robots: noindex, follow`（写法同 `routes/blog/page/$page.tsx`）。补单测：没有已发布文章的语言输出 noindex，有已发布文章时不输出
- [ ] 4.2 补测试固定现有行为：没有已发布文章的语言，站点地图不含 `/blog`（`features/seo` 单测），页脚不含 `/blog`（`site-header.test.tsx` 已有断言，核对覆盖 es、zh、ko、ja）
- [ ] 4.3 构建后用 preview 请求 `/blog`、`/es/blog`、`/zh-hans/blog`、`/zh-hant/blog`、`/ko/blog`、`/ja/blog`：均为 200 且带 `noindex, follow`。`check:i18n-seo` 与 `check:links` 通过。结果存证据目录
- [ ] 4.4 在模板需求清单中登记 R7（空博客列表 noindex，附本组 diff），交给模板维护者；PR 正文写明本文件是模板交付文件、已提交上游请求

## 5. 塔罗入口页负责免费塔罗主词（en、zh-hans、zh-hant、ko）

- [ ] 5.1 Claude 文案子代理定稿 en、zh-hans、zh-hant、ko 四种语言的 Title、Description、H1 与 titleMain（以 design 决策 6 草案为底稿；zh-hant 与 zh-hans 分别撰写）。每条用 `audit-seo.mjs` 的 `tdkLength` 核对长度（英文 Title 40–60、Description 140–160；中韩 Title 20–30、Description 70–80）。Codex 回译审阅 zh-hant、ko，意见与修改存证据目录
- [ ] 5.2 写入 `features/tools/tarot/routes.ts`（`TITLES`、`SEO_TITLES`、`DESCRIPTIONS` 的 three-card）与 `messages/{en,zh-Hans,zh-Hant,ko}/tarot.json` 的 `tarot_three_card_h1`。核对 `tarotLocalizedSeoPages()` 的筛选副作用：单测断言单张、是非、凯尔特十字与牌义索引页的 Title、Description 与 main 逐字相同。es、ja 不改
- [ ] 5.3 锚文本核对：`audit:seo` 显示指向四种语言入口页的正文锚文本各 ≤2 种（主词与三张牌名称），top1 占比合规；`check:links` 无 h1、死链问题。390px 截图核对页头导航与首页工具卡，长导航名不溢出
- [ ] 5.4 关键词归属表（1.3 产出）把四种语言的免费塔罗主词登记到入口页；确认单张、是非、凯尔特十字、牌义索引页的 Title 与 H1 不以该主词开头

## 6. 数字命理入门页（西方站 en、es）

- [ ] 6.1 按 `ui-design` 技能出画布稿：en 桌面与 390px，枢纽页版式加相关区块，内嵌 Life Path 计算器。经使用者确认后存离线副本并登记原型索引。未确认前不开始 6.3
- [ ] 6.2 Claude 子代理撰写 `content/numerology/en/numerology.mdx` 与 `content/numerology/es/numerology.mdx`：按 design 决策 7 的大纲与 TDK，正文 ≥1,000 词，FAQ 3–4 问；es 另写，使用不同的虚构算例；算例由引擎复算，`check-content-concepts` 通过。es 回译审阅流程同 2.4
- [ ] 6.3 在 `numerology/routes.ts` 的 `PATHS` 增加 `numerology` 页面 id（en `/numerology`，es `/numerologia`）。`slug-route.ts` 与 `slug-page.tsx` 承接该 id（en 也经 `$slug`，不新增路由文件）。注册表 `NUMEROLOGY_ROUTES` 登记 Title、Description、titleMain，父页为首页。SeoPage 声明 `related` 为 7 个计算器页，并渲染相关区块。补路由与 SEO 单测；`check-home-bundle` 首页包不超预算
- [ ] 6.4 入链：在首页「How we calculate」一行，以及 `/life-path-number`、`/numerology-calculator` 长文中现成提到 numerology 的句子里，各加最多 1 条指向入门页的链接（en「what is numerology」/「numerology basics」，es「qué es la numerología」/「numerología para principiantes」）；不新造句子，总入链 ≥2。es 两种锚文本登记进 `i18n/glossary/es.json`
- [ ] 6.5 验收：两页进入站点地图、互为 hreflang、canonical 自指；`audit:seo` 显示正文内链 2–5、TDK 在区间内、钱页入链不减少；`check:links` 无孤岛与死链；`measure-locale-similarity` 中 es 对 en 的结构直译分 ≤0.6、数字序列重合 ≤0.5；llms.txt 含两页；关键词归属表已登记

## 7. 集成验收（协调者，全部合并后在 main 上执行）

- [ ] 7.1 main 生产构建后运行 `measure-locale-similarity --site west --enforce en,es`（组件段全部 ≤0.30）与 `--site east`。报告与 design.md 基线对比后存证据目录
- [ ] 7.2 main 上运行 `check:links`、`audit:seo`、`check:i18n-seo`，全部通过且孤岛、死链为 0；核对关键词归属表与线上 Title、H1 一致
- [ ] 7.3 随统一发版上 staging，抽查 `/tarot`、`/numerology`、`/es/numerologia`、`/blog` 的 TDK 与 robots；生产发版需使用者授权。站点地图重提与请求编入索引并入全部工作完成后交给 Grok bot 的清单（不在本 change 内执行）
