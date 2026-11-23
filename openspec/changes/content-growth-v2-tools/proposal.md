# 内容增长 v2：新工具方向（时效快赢、星历引擎、工具分级）

## Why

content growth 规划 v2（2026-11-23 使用者确认，私有证据目录 `content-growth/plan-v2-20261123.md`，调研见同目录 `tool-research-20261123/`）把下一批投入从「纯内容扩量」转向**有引擎独有结果、并且有时间窗口的工具**：
2027 丁未年的搜索高峰从 12 月开始，到春节（2027-02-06）前后结束；ko 신년운세与토정비결、zh-Hant 農民曆与太歲、en「year of the goat 2027」都集中在这个窗口。错过 12 月中，这一轮的季节流量基本拿不到。

同时，使用者 2026-11-23 放宽了第 2 阶段「不做婚姻、配对类专项推演」的约束：合盘与配对可以做，但不给「宜不宜结婚」一类结论，并且工具要分级展示（首页只放精选，其余进可抓取的深层目录）。
西方站（arcanumber.com）排名仍弱，月相与星座配对是不需要重引擎的快赢；星盘（三巨头 → 免费出生星盘）价值最高，使用者决定投入，排在快赢之后。

## What Changes

**波次 A（12 月中前上线，赶 2027 窗口）**

- **E1 2027 年运集群**（东方站 zh-Hans、zh-Hant、ko、en）：
  - 每种语言一个 2027 枢纽与 12 个生肖 / 띠 / sign 的 2027 页：太岁关系由引擎计算，文字逐页、逐语言撰写；
  - 每种语言一个「个人 2027 流年」工具：输入生日，用已有的 `annualOutlook` 给出 2027 丁未年与本命的关系，详批沿用已有八字 / 사주详批（v4 含流年逐年章节）；
  - ko 不以「띠별 운세」为目标，沿用第 2 阶段的「띠」「올해 흐름」写法；
  - en 版在东方站根路径英文，同时新建 en 生肖枢纽（「chinese zodiac」归东方站）。
- **E2 合盘套件**：把已上线的 ko `/ko/사주궁합` 本地化到 zh-Hant、zh-Hans、ja、en，加恋人、朋友、合伙、亲子等关系场景页。
  - 分数只作传统参考，不给「宜不宜结婚」「会不会离」之类判定；
  - 对方生日属于第三方个人数据：页面说明用途，默认不保存。
- **E3 ko 토정비결 2027**：引擎按传统算法得出 144 괘 之一；144 段解读全部原创，不使用现代韩译或解说。
- **E4 生肖配对**：zh-Hans 78 组配对页加 12×12 总表（波次 A 关键路径）；ko 띠궁합与 en Chinese zodiac compatibility 各自另写，在 2027-01-22 前上线（不在 12 月中关键路径上，取舍见 design 决策 9）。
- **E5 zh-Hant 農民曆与 2027 太歲**：复用黄历引擎与版式，按台湾、香港用语与惯例另写，不做字形转换；另建 2027 太歲页（值、沖、刑、害、破的传统说明，不做化解与商品导购）。
- **W1 月相工具**（西方站 en，es 跟进）：今日月相、今晚是否满月、12 个月份月历、年度满月表。
  - 引入 astronomy-engine（MIT），本期只用月相部分；
  - 构建期预计算、预渲染，客户端只按本地日期选行，不查数据库。
- **W2 西方星座配对**（en）：12 星座档案页作为底座，加 12×12 配对总表与 78 组配对页。
- **英文生肖归属**：「chinese zodiac」及其配对、2027 年运等英文主词归东方站根路径英文（ganjiday），西方站不建生肖页；登记到关键词归属表。

**工具分级信息架构（两站，波次 A 内）**

- 首页精选改为 1 张主卡 + 4 张副卡 + 1 个季节位（12 月到 2 月放 2027 内容，其余月份放每日运势或黄历）。
- 每种语言一页服务端渲染的「全部工具 / All tools」枢纽页，按规划 v2 §一分组；页头工具下拉加入口。
- 标签：入口卡用动作式免费标签（免费排盘、免费查询等）；付费只标在详批按钮上（「AI 详批 · 10 积分」）；新内容与季节内容加「新」「2027」小标，到期自动消失。
- **设计稿是开工前提**：设计稿另行产出，副本登记在 `docs/design/prototypes/content-growth-v2-tools/`（待登记）；带 UI 的任务组在使用者确认前不开始实现。

**波次 B（波次 A 之后）**

- **W3 三巨头计算器 → 免费出生星盘**：同一个 `@xuanxue/astro` 引擎加宫位公式、地名与历史时区查询（约 3–4 周），接 AI 付费完整解读。
  - 上线前必须通过引擎精度门槛：与 astro.com 等参考星盘逐项比对。
  - 之后在同一引擎上依次做合盘（synastry）、逆行日历、土星回归、太阳返照，各自单独成组。

**并入的 v1 第 3 阶段（后续组）**

- angel numbers 枢纽与约 30 个数字页（en、es 按本语言主词另写；pt-BR「horas iguais」等 pt-BR 上线后再做）；
- personal year 计算器与 9 个年份数页；
- 塔罗牌阵页（不重复已有的是非、凯尔特十字）。

**门槛**（每批页面，沿用第 2 阶段口径）：组内相似度 ≤0.30（`measure-locale-similarity`）；`audit:seo`、`check:links`、`check:i18n-seo`；正文内链 2–5、每目标锚文本 ≤2 种、top1 占比 ≤70%；术语表锚点；关键词归属登记；首页包预算；判定词审计；引擎事实在测试中复算。

**不在本次范围**（后续候选）：九星気学与六曜（ja）、易卦（梅花、六爻、64 卦）、姓名学、籤詩、解梦、地点星盘、五行查询。
第 2 阶段第二波（紫微主星、zh-hant 生肖、八字概念补齐）不改动，仍由 `content-growth-phase2` 的 12-02 检查点决定。

## Capabilities

### New Capabilities

- `tool-directory`：工具分级：首页精选（主卡、副卡、季节位）、每语言的「全部工具」枢纽页、免费 / 付费 / 新 / 年份标签规则。
- `yearly-outlook-pages`：带年份的年运集群：年度枢纽、12 生肖年度页、个人年度流年工具、年度太岁页，以及年份页的时效与维护。
- `relationship-compatibility`：双人合盘工具的多语言版本与关系场景页、分数解释、无判定措辞、第三方出生资料的用途说明与不保存。
- `chinese-zodiac-pair-pages`：东方站十二生肖两两配对页与 12×12 总表（zh-Hans、ko、en）。
- `tojeong-bigyeol`：ko 토정비결工具：传统 144 괘算法、原创解读、结果不进索引。
- `moon-phase-pages`：西方站月相工具：今日月相、满月查询、月份月历、年度满月表；预计算、不查库。
- `western-zodiac-pages`：西方站 12 星座档案、星座配对总表与 78 组配对页。
- `natal-chart`：星历引擎、三巨头计算器、免费出生星盘、精度门槛、地名与历史时区、付费完整解读，以及同引擎的后续工具。
- `angel-number-pages`：西方站 angel numbers 枢纽与数字页，按语言本地主词另写。

### Modified Capabilities

- `seo`：新增「跨站主题归属」（同一主题的英文主词只归一个站）、「带年份页面的时效」与「关系类页面的判定词审计」要求。
- `numerology-pages`：新增 personal year 计算器与 9 个年份数页。
- `tarot-pages`：新增牌阵说明页要求。
- `zodiac-pages`（`content-growth-phase2` 新增，归档顺序见 design）：修改「传统关系只作一般说明」，允许链接到生肖配对页，仍不给判定。
- `almanac-pages`（`content-growth-phase2` 新增）：新增 zh-Hant 農民曆工具与月份页。

## Impact

- **引擎**：
  - `packages/bazi`：在 `@xuanxue/bazi/almanac` 子入口补年度生肖关系、生肖配对事实、胎神（農民曆）；新增 `@xuanxue/bazi/tojeong` 子入口（토정비결 144 괘）。合盘评分（`computeCompatibility`）不改。只用已有依赖。
  - 新包 `packages/astro`（`@xuanxue/astro`）：依赖 astronomy-engine（MIT），子入口 `./moon`（W1）与 `./chart`（W3）；改 `pnpm-lock.yaml`（只由引擎组修改）。依赖方向按 `packages/bazi` 的同类规则登记到 `scripts/check-deps.mjs`。
- **Web**：
  - 东方站沿用 `features/east-content/` 的单段 / 两段分发；东方站根路径英文与西方站新增两段地址的分发（不逐页新增路由文件）。
  - 新内容集合（`content-collections.ts`）：年度生肖、生肖配对、토정비결解读、農民曆月份、星座档案与配对、月份月历、angel numbers 等。
  - 首页精选（`features/marketing/home-hub/data.ts`：`FEATURED`、`FEATURED_LIMIT`）改为主卡 + 副卡 + 季节位；新增「全部工具」枢纽页；注册表 `features/tools/registry.ts` 增加分组、标签与小标字段。
  - 合盘页 `features/tools/bazi/gunghap-page.tsx` 从 ko 专用改为多语言组件；对方资料不再默认写入浏览器存储。
  - 详批：`saju-compat` 增加 zh-Hant、zh-Hans、ja、en 提示词与场景参数，经评测后上线；波次 B 新增星盘完整解读。
  - 新增文案文件 `messages/<locale>/<feature>.json`。
- **工具与检查**：`locale-similarity.mjs` 增加新集合定义；`scripts/check-content-*.mjs` 增加新集合的引擎复算；判定词审计脚本；首页包预算。
- **数据**：不涉及数据库 schema 与迁移；公开页不查数据库（Neon 成本基线）。地名库（GeoNames，CC-BY，需署名）以静态切片随构建或放 R2，不进 Neon。
- **证据**：私有证据目录 `content-growth/v2/<组号>/` 与 `content-growth/keyword-ownership.md`。
- **设计稿**：`docs/design/prototypes/content-growth-v2-tools/`（另行产出，待登记）。
- **外部**：Search Console「请求编入索引」每个 Google 账号每天约 10 次、两站共用，由协调者排队（design 决策 21）。
