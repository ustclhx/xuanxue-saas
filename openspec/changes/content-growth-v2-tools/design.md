# Design

## Context

动机见 proposal.md「Why」。本节只记录决定做法的现状事实，于 2026-11-23 在 main `d254c17b1` 上核实。

### 规划与时间窗口

- 使用者决定（`content-growth/plan-v2-20261123.md`「使用者决定」，有约束力）：
  1. 12 月中前上线 E1、E3、E5、E2、E4、W1、W2；第 2 阶段第二波仍等 12-02 检查点。
  2. 星历引擎投入，排在快赢之后（W3），之后用同一引擎做合盘、逆行、土星回归。
  3. 英文生肖归 ganjiday 英文版。
  4. 工具分级改版现在出设计稿。
- 2027 丁未年：立春 2027-02-04，春节 2027-02-06。ko 신년운세、토정비결与 en「year of the goat 2027」12 月起升，春节为顶（`tool-research-20261123/east.md` §1.3、§1.5）。
- 本 change 的「12 月中」按 **2026-12-15 生产上线** 计；生产发版需使用者授权。

### 第 2 阶段现状（`content-growth-phase2`）

- 第 1、2、4、5、6 组已合并：生肖 zh-hans 与 ko、黄历 zh-hans、`@xuanxue/bazi/almanac` 子入口（`almanacDay`、`almanacMonth`、`zodiacYears`、`zodiacBoundaries`、`nayinTable`、`terrainTable`）、`features/east-content/` 分发骨架。
- 第 7 组（12-02 复查）与第二波（第 8、9、10 组）未开始；本 change 不改动它们。
- 第 2 阶段「约束」禁止生肖配对与合婚，禁用词审计含配对、合婚、궁합。使用者 2026-11-23 放宽了这一条（决策 14）。

### 引擎已有能力

| 能力 | 位置 | 本 change 的用法 |
|---|---|---|
| 流年逐年数据 | `annualOutlook(chart, { startYear, years })`：流年干支、十神、与四柱及大运的合冲刑、太岁、喜忌 | E1 个人年度工具直接复用 |
| 合盘评分 | `computeCompatibility` / `scoreCompatibility`（`compat.ts`）：基础 60，日干五合 +15、日支六合 +12、三合 +8、六冲 −15、相刑 −8、五行互补各 ≤+10 | E2 不改分数，只换解释与场景 |
| 地支关系、太岁 | `relations.ts`：`branchRelations`、`taiSuiOf`、`triadOf` 等 | E1 年度关系、E4 配对事实、E5 太歲表 |
| 黄历 | `@xuanxue/bazi/almanac` | E5 复用；胎神需补 |
| 阴阳历换算 | tyme4ts 1.5.3（`LunarDay`、`SixtyCycle`），另有 `FetusDay`（胎神） | E3 토정비결、E5 胎神 |

缺口：年度生肖关系表（12 支 × 目标年）、配对事实（两支关系与五行生克）、胎神、토정비결 144 괘、天文计算（月相、星盘）。

### Web 现状

- **东方站分发**：`routes/$slug.tsx` 承接排盘页（`EASTERN_PAGES`）与东方内容单段页；`routes/$section/$item.tsx` 按语言与首段分发：zh-hans、ko 到 `features/east-content`，东方站根路径英文到 east-en 塔罗。注册与预渲染读 `east-content/routes.ts`（只放地址与页面 id）。
- **西方站**：语言 en、es（`template.config.ts`）；两段地址各有路由目录（如 `routes/life-path-number/`），`$section/$item` 在西方站目前返回 404。
- **首页精选**：`features/marketing/home-hub/data.ts`：`FEATURED_LIMIT = 4`，东方 `['bazi','ziwei','saju-gunghap','tarot-three-card','mingpan']`，西方 `['life-path','numerology-calculator','tarot-three-card']`，另有西方文字链接 `life-path-compatibility`（2026-11-17 设计稿确认）。
- **注册表**：`ToolRoute` 有 `nav`、`prerender`、`navGroup?: 'calendar'`（页头「历法与生肖」分组，phase2 EastNavVariant 方案 C）。
- **ko 合盘**：`/ko/사주궁합`（`gunghap-page.tsx`），组件写死 `LOCALE = 'ko'`；对方资料用 `PARTNER_STORAGE_KEY` 写入 sessionStorage；分享片段 `toShareInput` 同时带两人的出生资料。首页东方精选已含 `saju-gunghap`。
- **详批**：`saju-compat` 只有 ko 变体；`bazi-full` 有 zh-Hant、zh-Hans、en、ja（v4 含流年逐年章节），`saju-full` 有 ko。
- **检查工具**：`locale-similarity.mjs`（集合按 H2 分段；中日韩按字二元组，英、西等按词二元组，按语言而非站点选择——协调者 2026-11-24 修订：东方站英文页按字计会让任意英文段落都显得雷同）、`measure-locale-backtranslation.mjs`、`audit-seo.mjs`、`check-links.mjs`、`check-i18n-seo.mjs`、`check-locale-glossary.mjs`（`apps/web/i18n/glossary/{en-east,es,ja}.json`）、`check-home-bundle.mjs`、`scripts/check-content-zodiac.mjs`（引擎复算样板）。
- **设计稿规则**（`docs/design-system.md` §8.1）：新页面模式与套用现有模式的新页面都要画布稿；已有集合新增文章、版式不变的免稿。

### 外部约束

- Search Console「请求编入索引」每个 Google 账号每天约 10 次，ganjiday 与 arcanumber 共用同一账号。
- Neon 成本基线（`docs/runbooks/production-neon.md` §4）：公开页、定时任务不得让数据库无法缩容到零。
- astronomy-engine：MIT，纯 JS，压缩约 116 KB，可在 Workers 运行，与 NOVAS 相差 ±1 角分内；不含凯龙、莉莉丝（`west.md` §5）。

## Goals / Non-Goals

**Goals：**
- 波次 A 的页面在 2026-12-15 前上线生产，且每批都通过第 2 阶段同口径的门槛。
- 每个新页面有引擎算出的逐页事实和逐页、逐语言撰写的正文；不为页数造页。
- 公开页不查数据库；首页包不超预算；不逐页新增路由文件。
- 关系类工具给出可解释的分数与相处建议，不做关系决策判定，对方资料默认不保存。
- 星盘引擎先过精度门槛，再上任何依赖它的页面。

**Non-Goals：**
- 九星気学、六曜、易卦、姓名学、籤詩、解梦、地点星盘、五行查询、紫微合盘、이름궁합（后续候选）。
- 第 2 阶段第二波的任何改动；12-02 检查点只约束第二波的纯内容扩量，不约束本 change 的工具页（规划 v2「与 v1 的关系」）。
- 合盘评分规则的改动；⌘K 搜索与「问 AI」兜底（工具超过约 20 个再做）。
- pt-BR、fr 等新语言（angel numbers 的 horas iguais、heures miroirs 等语言上线后再做）。

## Decisions

### 决策 1：波次、关键路径与里程碑

| 里程碑 | 日期 | 内容 |
|---|---|---|
| M0 | 11-27 | 设计稿第一批经使用者确认（第 5 组登记）；第 1–4 组合并 |
| M1 | 12-09 | 波次 A 内容与 UI 组全部合并到 main |
| M2 | 12-11 | 第 21 组集成验收通过，随统一发版上 staging |
| M3 | 12-14 | 使用者授权后上生产（留 1 天余量到 12-15） |
| M4 | 2027-01-22 | 第 17 组（ko、en 生肖配对）上线，赶春节前两周 |

- **关键路径（12 月中）**：第 1、2、3、4、5 → 第 6、7、8、9、10、11、12、13、15、16、18、19、20 → 第 21。
- **不在关键路径**：第 14 组（合盘详批新语言；免费结果可先上线，详批显示「即将开放」）、第 17 组、第 19 组的 es 子任务。
- **文案先行**：所有内容组的文案在第 1–3 组合并前即可开写；代码与页面等第 1–3（东方）或第 1、2、4（西方）组合并；UI 实现等第 5 组登记使用者确认。
- **延期时的裁剪顺序**（M1 前任一组预计赶不上时由协调者报使用者）：先推迟第 20 组（W2）到 12 月底，再推迟合盘场景页（第 13 组的场景部分，工具页照常），最后推迟第 19 组 es。E1、E3、E5 不裁，它们的窗口最窄。

### 决策 2：路径与 slug（按语言）

单段地址走 `$slug`，两段走 `$section/$item`；不使用三段地址。下表 slug 为主词定稿，第 1 组在关键词归属核对后可以改写措辞，但段数与归属关系不变。

**东方站**

| 集合 | zh-Hans | zh-Hant | ko | ja | en（根路径） |
|---|---|---|---|---|---|
| 2027 枢纽 / 生肖页 | `/zh-hans/2027生肖运势`、`/2027生肖运势/属鼠` … | `/zh-hant/2027生肖運勢`、`/屬鼠` … | `/ko/2027년-띠`、`/2027년-띠/쥐띠` … | — | `/chinese-zodiac-2027`、`/chinese-zodiac-2027/rat` … |
| 生肖枢纽（en 新建） | 已有 | 第 2 阶段第 9 组 | 已有 | — | `/chinese-zodiac` |
| 个人年度流年 | `/zh-hans/2027流年` | `/zh-hant/2027流年` | `/ko/2027-신년-사주` | — | `/bazi-2027` |
| 2027 太歲 | —（由第 2 阶段太岁概念页负责） | `/zh-hant/2027太歲` | — | — | — |
| 合盘工具 | `/zh-hans/八字合盘` | `/zh-hant/八字合盤` | `/ko/사주궁합`（不变） | `/ja/四柱推命相性` | `/bazi-compatibility` |
| 合盘场景 | `/八字合盘/合婚` `恋人` `朋友` `合伙` `亲子` | `/八字合盤/合婚` `戀人` `朋友` `合夥` `親子` | `/사주궁합/부부` `연인` `친구` `동업` `부모-자녀` | `/四柱推命相性/結婚` `恋愛` `友人` `仕事` `親子` | `/bazi-compatibility/marriage` `couples` `friends` `business-partners` `parent-child` |
| 生肖配对 | `/zh-hans/生肖配对`、`/生肖配对/属鼠和属牛` … | — | `/ko/띠궁합`、`/띠궁합/쥐띠-소띠` … | — | `/chinese-zodiac-compatibility`、`/chinese-zodiac-compatibility/rat-and-ox` … |
| 토정비결 | — | — | `/ko/토정비결` | — | — |
| 農民曆 | — | `/zh-hant/農民曆`、`/農民曆/1月` … `/12月` | — | — | — |
| 全部工具 | `/zh-hans/全部工具` | `/zh-hant/全部工具` | `/ko/전체-도구` | `/ja/ツール一覧` | `/tools` |

**西方站**

| 集合 | en | es |
|---|---|---|
| 月相 | `/moon-phase-today`、`/full-moon`、`/full-moon-calendar`、`/moon-calendar`、`/moon-calendar/january` … `/december` | `/es/fase-lunar-hoy`、`/es/luna-llena`、`/es/calendario-lunar`（月份页后续） |
| 星座档案 | `/zodiac-signs`、`/zodiac-signs/aries` … | 后续 |
| 星座配对 | `/zodiac-compatibility`、`/zodiac-compatibility/aries-and-leo` … | 后续 |
| 三巨头 / 星盘（波次 B） | `/rising-sign-calculator`、`/birth-chart`；后续 `/synastry`、`/retrograde-calendar`、`/saturn-return`、`/solar-return` | 后续 |
| angel numbers | `/angel-numbers`、`/angel-numbers/111` … | `/es/numeros-angelicales`、`/es/numeros-angelicales/111` … |
| personal year | `/personal-year-number`、`/personal-year-number/1` … `/9` | `/es/ano-personal`、`/es/ano-personal/1` … |
| 塔罗牌阵 | `/tarot/love`、`/tarot/career`、`/tarot/full-moon` | 后续 |
| 全部工具 | `/tools` | `/es/herramientas` |

- 配对的规范顺序：东方按地支（子丑寅…），西方按黄道（Aries 起）；反序 301。同生肖 / 同星座组合为 `属鼠和属鼠`、`aries-and-aries`。
- 合盘场景：夫妻 / 婚恋场景页拥有「八字合婚」「사주 부부 궁합」「marriage compatibility」一类主词；工具页拥有「八字合盘」「사주궁합」「四柱推命 相性」「bazi compatibility」。

### 决策 3：路由承接

- **东方站中日韩**：沿用 `features/east-content/routes.ts` 追加映射；新增集合 id：`yearly`、`yearly-tool`、`compat`、`compat-scenario`、`zodiac-pair`、`tojeong`、`nongminli`、`tai-sui-year`、`tools-hub`。`EastContentRoute.locale` 扩展到 `zh-Hant`、`ja`。
- **东方站根路径英文**：在 `features/east-en/paths.ts` 增加 `/chinese-zodiac*`、`/bazi-2027`、`/bazi-compatibility*`、`/tools` 映射；`$section/$item` 中 en 分支先查 east-en 内容映射，再落到塔罗。
- **西方站**：新建 `features/west-content/routes.ts`（与 east-content 同构，只放地址与页面 id），`$slug` 与 `$section/$item` 增加西方站分支；已有路由目录（`life-path-number/` 等）不动。
- **合盘工具**：东方各语言合盘页并入 `EASTERN_PAGES`（id `gunghap`），场景页走 `$section/$item`。
- 两个路由文件只由第 2 组修改；页面组件按集合懒加载（配对页不加载八字引擎，月相页不加载 astronomy-engine）。第 2 组用 `check-home-bundle` 记录前后数据，首页包增长 ≤2 KB gzip；超出时改为独立路由文件并在 PR 说明。

### 决策 4：引擎补充

- **`@xuanxue/bazi/almanac`**（第 3 组）：
  - `zodiacYearFacts(year)`：12 支与目标年干支的关系（值、冲、刑、害、破太岁，六合、三合），输出稳定 key；
  - `zodiacPairFacts(a, b)`：两支关系（六合、三合、六冲、相刑、相害、相破）与五行生克方向；78 组全表 `zodiacPairTable()`；
  - `almanacDay` 增加胎神（tyme4ts `FetusDay`）的占位 key 与方位，`ALMANAC_RULES_VERSION` 升版。
- **`@xuanxue/bazi/tojeong`**（新子入口，第 3 组）：`tojeongGwae({ birth, calendar, leapMonth }, targetYear)`，返回상괘、중괘、하괘与괘 번호及中间数（见决策 8）。
- **`packages/astro`（`@xuanxue/astro`，新包）**：
  - `./moon`（第 4 组）：`moonPhaseTable(startDate, days)`（逐日的照亮比例、月龄、相位名 key）、`moonQuarterEvents(startDate, endDate)`（新月、上弦、满月、下弦的 UTC 时刻）、`fullMoonNames()`（月份 → 传统满月名 key）、`supermoon/blueMoon` 标记；
  - `./chart`（第 22 组，波次 B）：见决策 19。
  - 依赖 astronomy-engine，只由第 4 组改 `pnpm-lock.yaml`（§3 规则 4：冲突时 rebase 后重新 `pnpm install` 并 `pnpm dedupe`）；在 `scripts/check-deps.mjs` 登记为业务包，不依赖 apps 与 React；`check:singletons` 通过。
- **约定**：输出只含稳定 key 与数值，不含本地化文字；单测用独立数据交叉核对（`lunar-javascript` 核对干支与阴历；USNO 月相表核对月相）；构建期计算，随 loader 下发，客户端不加载 tyme4ts 与 astronomy-engine（个人工具除外，按需加载）。

### 决策 5：工具分级信息架构

- **注册表字段**（第 2 组加类型，第 6 组定取值）：
  - `directoryGroup`：东方 `chart | relation | yearly | divination | calendar | knowledge`，西方 `tarot | numerology | astrology | moon | compatibility`；
  - `freeLabel`：动作式标签 key（免费排盘、免费合盘、免费查询、免费抽牌、免费起卦，en「Free chart」等）；
  - `badge?: { kind: 'new' | 'year'; label?: string; until: 'YYYY-MM-DD' }`。
- **首页**（`home-hub/data.ts`，只由第 6 组修改）：`FEATURED` 改为 `{ main, secondary[], seasonal[] }`，`FEATURED_LIMIT` 拆为主卡 1、副卡 4；季节位按构建日期取窗口（12-01 至次年 2 月末为年度内容，其余为每日运势或黄历）。默认配置：

| 站 / 语言 | 主卡 | 副卡（按顺序取前 4 个有页面的） | 季节位（12–2 月） |
|---|---|---|---|
| 东方 zh | 八字排盘 | 八字合盘、紫微排盘、生肖配对、塔罗 | 2027 流年 / 生肖运势 |
| 东方 ko | 만세력 | 사주궁합、띠궁합、타로、토정비결（季节外） | 2027 신년 사주 · 토정비결 |
| 东方 ja | 四柱推命 | 四柱推命相性、紫微斗数、タロット | （无 2027 ja 内容时为每日运势） |
| 东方 en | Bazi Calculator | Bazi Compatibility、Chinese Zodiac Compatibility、Zi Wei Dou Shu、Tarot | Year of the Fire Goat 2027 |
| 西方 en | Life Path Calculator | Moon Phase Today、Zodiac Compatibility、Tarot、Numerology Calculator | Full Moon Calendar 2027 |
| 西方 es | Número de vida | Fase lunar hoy、Tarot gratis、Calculadora de numerología | — |

  - 首页仍预渲染；季节切换随发版生效（发版频率高于每月一次，可接受）。单测用注入的日期覆盖窗口边界。
- **全部工具枢纽页**：服务端渲染，每语言一页，按 `directoryGroup` 分组，空组不显示；卡片含名称、一句说明、`freeLabel` 与小标。页头工具下拉末尾加「全部工具」入口，保留现有分组（`calendar`）。页面进站点地图、llms.txt。
- **标签规则**：付费只出现在详批按钮「AI 详批 · 10 积分」（积分数取运行时价格快照，不写死）；入口卡不标付费；「会员」只给订阅专属内容（本 change 无）；小标到 `until` 次日不再渲染。
- **合规用语分区**：「AI」只出现在详批按钮、解锁卡、定价页与 Chat（项目 config 的合规分场景规则）；公开正文、TDK、入口卡说明与枢纽页不提 AI。

### 决策 6：E1 2027 年运集群

- **年度生肖页**（集合 `yearly`，`content/yearly/<locale>/2027/<key>.mdx` 与 `index.mdx`）。frontmatter：`year`、`branch`、`slug`、`relations_note`、`focus`（3 个主题：工作、关系、自我照顾）、`faq`。H2：
  1. 2027 丁未与本生肖的关系（组件输出 `zodiacYearFacts`，上方 `relations_note` 逐页撰写）；
  2. 三个主题段（逐页撰写，反思与建议语气，不写月份吉凶）；
  3. 不同出生年份的差异（组件列出本生肖 1948–2023 的出生年与纳音，正文说明「同一生肖不同纳音」的传统读法）；
  4. 用完整八字看 2027（链接个人年度工具，说明年支只是八字一部分）；
  5. FAQ 3–4 问。
- **枢纽**：2027 丁未的干支、纳音、立春与春节日期（引擎），12 生肖与 2027 的关系总表（值、冲、刑、害、破、合），链接 12 页与个人工具。
- **个人年度工具**（集合 `yearly-tool`）：表单复用八字表单（含 ProfileBar），结果区用 `annualOutlook(chart, { startYear: 2027, years: 1 })` 渲染：2027 干支与十神、与四柱和大运的关系、太岁、喜忌；结果后详批按钮接已有 `bazi-full`（zh、en）或 `saju-full`（ko），提示语说明详批含「流年逐年」章节。工具页正文说明计算方法与读法，可索引；结果不改地址。
- **en**：同时新建 `/chinese-zodiac` 枢纽（属相查询小工具复用 `zodiacBoundaries`，12 生肖总表），拥有「chinese zodiac」「chinese zodiac years」主词；12 个 en 生肖基础页本期不做（决策 13 说明）。
- **ko 用词**：不以「띠별 운세」为目标；枢纽 Title 草案「2027 정미년 띠: 열두 띠의 올해 흐름과 세운 관계」，子页「쥐띠 2027년: 정미년 세운과 올해 흐름」，个人工具「2027 신년 사주: 내 사주로 보는 정미년 흐름」。
- **年份页时效**：网址带年份。2027 页在 2027 年内不改；2027-11 发布 2028 页之前，按 seo「带年份页面的时效」由使用者裁定 2027 页的处理，记入证据目录。

### 决策 7：E2 合盘套件

- **组件多语言化**（第 12 组）：`gunghap-page.tsx` 改为接收 `locale` 与 `scenario` 的通用组件，文案移到 `messages/<locale>/compat.json`；ko 页面行为与地址不变（快照测试锁定 ko 的 H1、表单与结果区）。
- **场景**：`scenario ∈ { general, marriage, couple, friends, business, parent-child }`。分数相同；每个 `CompatItemKey` × 场景一段解释（由第 13 组撰写，存 `content/compat/<locale>/items.json` 一类数据文件），工具页（`general`）用通用解释。
- **对方资料**（第三方个人数据）：
  - 对方字段旁显示用途说明：「只用于本次合盘计算；购买详批时随报告保存，可随报告删除」（措辞由各语言撰写）；
  - 默认不写入 sessionStorage / localStorage（去掉 `PARTNER_STORAGE_KEY` 的默认写回）；本人资料行为不变；
  - ProfileBar 对对方字段不默认填充；访客点「保存为档案」才写入档案；
  - 分享片段与分享卡只带分数、各项关系名与场景，不带两人的出生资料；旧版带资料的分享链接仍可打开（兼容读取），但新生成的不再携带；
  - 详批：报告记录按现有机制保存两人输入（服务端复算所需），解锁卡写明这一点；无新增存储。
- **详批语言**（第 14 组）：`saju-compat` 增加 zh-Hant、zh-Hans、ja、en 变体与 `scenario` 参数，提示词新版本号；用 `pnpm eval:prompts`（离线回放，`--no-judge` 生成）后由新开的 Claude 子代理按评分标准复核，确定性检查含判定词；使用者审阅每种语言样例后，运行时设置切换开放。未通过前该语言显示「即将开放」。
- **判定措辞**：分数解释、正文、FAQ、详批提示词都写「传统合参参考」框架；亲子、婆媳不写强化冲突的断语；合伙不写投资建议。

### 决策 8：E3 토정비결

- **算法**（记录为 `TOJEONG_RULES_VERSION`，采用最常见的一派，测试注明来源）：
  - 先把生日换为阴历；目标年按阴历取生月、生日在该年的对应日；
  - 상괘 =（세는 나이 + 目标年太岁数）mod 8，余 0 作 8；
  - 중괘 =（目标年生月的日数，大月 30、小月 29 + 该月月建数）mod 6，余 0 作 6；
  - 하괘 =（生日 + 该日日辰数）mod 3，余 0 作 3；
  - 太岁数、月建数、日辰数按先天数（甲己 9、乙庚 8、丙辛 7、丁壬 6、戊癸 5；子午 9、丑未 8、寅申 7、卯酉 6、辰戌 5、巳亥 4）求和；
  - 闰月按本月处理；目标年没有该日（如 30 日遇小月）时按 29 日处理，页面注明。
- 第 3 组用一份独立实现（测试内用 `lunar-javascript` 重写）复算 1940–2010 每年 1、15、29 日出生对 2027 的结果，并固定 5 个公开示例（来源记入证据目录）。流派差异写入工具页的「계산 방법」段。
- **内容**（集合 `tojeong`，`content/tojeong/ko/gwae.json` 或 144 个小文件）：每괘 1 段总论（250–400 字，합쇼체）加 3 个主题短句；**全部原创**，不改写现代韩译或解说书；原典四字句最多作标题级引用。12 个月别 풀이本期不做。
- **索引**：只有工具页可索引；结果在客户端显示，分享参数地址 `noindex, follow`、canonical 指向工具页。144 段解读按需加载（不进首屏包）。
- **措辞**：不预测具体事件、月日、疾病、事故；写成「올해 돌아볼 주제」一类反思框架。

### 决策 9：E4 生肖配对与语言次序

- **结论**：zh-Hans 78 页与总表在波次 A（12-15）；ko 띠궁합与 en Chinese zodiac compatibility 各自 78 页加总表在第 17 组，2027-01-22 前上线。
- **理由**：
  - 78 页 × 3 语言 = 234 段逐组原创文案，每段要过组内相似度 ≤0.30，并做跨语言回译审阅；与 E1 四种语言、E2 五种语言同时挤在三周内，质量风险大。
  - 配对词的高峰在春节前（`east.md` §7.1 #4「春节前上线收益最大」），01-22 仍在窗口内；12 月中更紧的是 2027 年运（E1）与토정비결（E3）。
  - zh-Hans 先行可以验证版式与相似度口径，ko、en 组复用组件只写内容。
- **页面**（集合 `zodiac-pair`）：H2 为「两支关系」（组件输出 `zodiacPairFacts` 加逐组 `relations_note`）、「相处的节奏」「彼此能学的」「需要磨合的地方」（逐组撰写）、「用八字看两个人」（链接合盘工具，说明年支只是一部分）、FAQ。总表为 12×12 网格（手机端改为按生肖分组列表，由设计稿定）。
- **生肖页的入链**：第 2 阶段生肖子页的关系段可以加 1 条链接到本生肖与六合对象的配对页（现成句子，不新造），见 `zodiac-pages` 修改。

### 决策 10：E5 zh-Hant 農民曆与 2027 太歲

- **農民曆**：复用 `features/east-content/almanac/` 的工具页与月份页组件，按 `locale` 取文案；字段增加胎神占方（决策 4）；沖煞写法按台湾惯例「沖X(年干支)煞Y」。正文另写（台湾、香港用语，如「農民曆」「黃道吉日」作为通用说明而非择日），过 `--opencc` 同文字变体门槛（整页 ≤0.60、整句 ≤0.15、FAQ ≤0.40）。
- **2027 太歲**（集合 `tai-sui-year`）：值、沖、刑、害、破太歲的生肖与出生年份表（`zodiacYearFacts`）；说明安太歲是民俗，不提供化解方法、法会报名或商品；链接 zh-Hant 2027 生肖页与農民曆。
- 与第 2 阶段的关系：第 2 阶段决策 6 把 zh-hant 黄历留作后续 change，本组即是；不影响 zh-hans 黄历与第 2 阶段第 9 组（zh-hant 生肖）。

### 决策 11：W1 月相

- **预计算**：构建时用 `@xuanxue/astro/moon` 生成「构建日前 1 个月至后 14 个月」的逐日表与月相事件表（约 450 行，JSON 约 15 KB gzip 前），随页面数据下发。客户端只做「按本地日期选行」与时区格式化（`Intl`），不加载 astronomy-engine。构建检查：表的剩余覆盖期 <13 个月时失败（发版频率保证滚动）。
- **页面**：
  - 今日月相：当天相位、照亮比例、月龄、下一次新月 / 满月倒计时，HTML 预渲染为构建日数据并标注「as of」，水合后换为访客当天；
  - 满月：今晚是否满月、下一次满月日期与名字（Wolf Moon 等）、超级月亮与蓝月标记；
  - 月历枢纽与 12 个月份页：地址不带年份，滚动规则同第 2 阶段黄历决策 5；逐日月相图标与四个主要相位时刻；逐月撰写满月名由来、观月提示与 FAQ；
  - 年度满月表：本年与次年的全部满月（日期、时刻 UTC 与本地、名字）。
- **es**：今日月相、满月、月历枢纽三页，按西语主词另写（第 19 组子任务，非关键路径）。
- **合规**：不写月相影响健康、生育、手术等暗示；仪式类内容只作传统与自我反思。

### 决策 12：W2 西方星座

- **星座事实表**（`features/west-content/zodiac/facts.ts`，静态，不依赖天文引擎）：日期范围、元素、模式、守护星、对宫、黄道序；配对的角距由黄道序差推出（合、半六分、六分、四分、三分、梅花、对分）。
- **档案页**（13 页）：基本事实组件 + 逐页撰写的性格、工作、关系主题 + 12 行配对一览。
- **总表与配对页**（79 页）：总表 12×12（手机端按星座分组）；配对页 H2：元素与模式、角距、相处节奏、彼此能学的、需要磨合的地方、FAQ。
- **「X compatibility」主词**：默认由档案页的配对一览段承担为副词（档案页主词为星座名），不另建 12 个「行」页；若 GSC 显示这些词有曝光而排名弱，再另开 change 建行页（Open Questions 2）。

### 决策 13：关键词归属（上线前登记到私有归属表）

| 站 / 语言 | 主词 | 归属页 | 锚文本（≤2 种） |
|---|---|---|---|
| 东 zh-Hans | 2027生肖运势 | `/zh-hans/2027生肖运势` | 2027生肖运势；2027年生肖 |
| 东 zh-Hans | 2027属鼠运势（各生肖同理） | `/2027生肖运势/属鼠` | 2027属鼠；属鼠2027年 |
| 东 zh-Hans | 2027流年 | `/zh-hans/2027流年` | 2027流年；2027年八字流年 |
| 东 zh-Hans | 八字合盘 / 八字合婚 | `/zh-hans/八字合盘` / `/八字合盘/合婚` | 八字合盘；合盘 / 八字合婚 |
| 东 zh-Hans | 生肖配对 / 属鼠和属牛配对 | `/zh-hans/生肖配对` / 各组 | 生肖配对；生肖配对表 / 属鼠和属牛 |
| 东 zh-Hant | 2027生肖運勢、2027流年、八字合盤、農民曆、X月農民曆、2027犯太歲 | 对应页 | 主词；一个自然变体 |
| 东 ko | 2027년 띠、쥐띠 2027、2027 신년 사주、사주궁합（不变）、부부 궁합、띠궁합、쥐띠 소띠 궁합、토정비결 2027 / 무료 토정비결 | 对应页 | 主词；一个自然变体 |
| 东 ja | 四柱推命 相性、四柱推命 結婚 相性 | 对应页 | 主词；一个自然变体 |
| 东 en | chinese zodiac / chinese zodiac years | `/chinese-zodiac` | Chinese zodiac；Chinese zodiac years |
| 东 en | year of the goat 2027 / chinese zodiac 2027 | `/chinese-zodiac-2027` | Year of the Goat 2027；Chinese zodiac 2027 |
| 东 en | rat 2027（各生肖同理） | `/chinese-zodiac-2027/rat` | Rat in 2027；Year of the Rat 2027 |
| 东 en | bazi compatibility / chinese zodiac compatibility | 对应页 | 主词；一个自然变体 |
| 西 en | moon phase today、is tonight a full moon、moon calendar、full moon calendar 2027、X moon calendar | 对应页 | 主词；一个自然变体 |
| 西 en | zodiac signs、aries（各星座）、zodiac compatibility、aries and leo compatibility | 对应页 | 主词；一个自然变体 |
| 西 es | fase lunar hoy、luna llena、calendario lunar | 对应页 | 主词；一个自然变体 |

- **跨站**：chinese zodiac 系列英文主词归东方站；西方站不建生肖页（seo「跨站主题归属」）。西方站已有 `life-path-compatibility` 保持不变；zodiac compatibility 与之不冲突（主词不同）。
- **站内冲突核对**：
  - 2027 年度页与第 2 阶段生肖子页：子页主词「属鼠」，年度页主词「2027属鼠」；子页 Title 不以年份开头，年度页 Title 以「2027」开头。
  - ko 「띠별 운세」不归任何页。「신년운세」不作为任何页的 Title、H1 目标，ko 个人工具用「신년 사주」（Open Questions 1）。
  - 「太岁」「犯太岁」zh-Hans 归第 2 阶段太岁概念页；zh-Hant「2027犯太歲」归 2027 太歲页。
- 各组把补登写在证据目录 `content-growth/v2/<组号>/keyword-ownership-add.md`，由协调者并入（同第 2 阶段做法）。

### 决策 14：关系类约束与判定词审计（取代第 2 阶段的婚配禁用词审计在本 change 页面上的适用）

- 使用者 2026-11-23 放宽：婚姻、配对类工具可以做；禁止的是**判定**，不是主题。
- **判定词表**（第 1 组维护，按语言）：zh「宜结婚 / 不宜结婚 / 不能结婚 / 会离婚 / 必离 / 克夫 / 克妻 / 注定分手 / 最佳婚配」及繁体；ko「결혼하면 안 / 이혼수 / 상극이라 헤어」等；ja「結婚してはいけない / 離婚する」等；en「should not marry / will divorce / doomed」等；es 对应。审计范围：本 change 的全部关系类页面（合盘、场景、配对、星座配对、牌阵）以及第 2 阶段生肖页。
- **第 2 阶段审计的处理**：第 2 阶段第 11.1 项的「婚配类禁用词审计」仍对生肖、黄历、主星页的 Title、H1、H2、FAQ 执行；但生肖页正文指向配对页的链接锚文本不计入（`zodiac-pages` 修改）。第 1 组在审计脚本中把两套规则分开：`--rule marriage-topic`（第 2 阶段集合）与 `--rule verdict`（全部关系类页面）。
- **归档顺序**：`zodiac-pages` 与 `almanac-pages` 由第 2 阶段新增，本 change 对它们的修改依赖第 2 阶段先归档。协调者在第 29 组先确认第 2 阶段已归档，否则等待或把本 change 的这两份 delta 转为第 2 阶段归档后的补丁。

### 决策 15：内链

- 正文内链每页 2–5 条，每目标锚文本 ≤2 种，top1 占比 ≤70%（`audit:seo`）。
- **模板区块**：枢纽列出下级；子页用面包屑与同组区块（`groupLinksMax` 轮转）；月份页声明 `series`。
- **钱页**（八字排盘、合盘工具、个人年度工具、토정비결、出生星盘）入链 ≥3。
- **主要正文链接**：
  - 年度生肖页：个人年度工具、本语言生肖子页、六合 / 冲对象的年度页（1 条）；
  - 配对页：合盘工具、两个生肖子页中的 1 个、同三合组的另一配对页；
  - 合盘场景页：合盘工具、另一场景页、生肖配对总表（东方）；
  - 農民曆：当月与次月月份页、2027 太歲；
  - 月相：满月页 ↔ 年度满月表 ↔ 当月月历；
  - 星座配对：两个档案页中的 1 个、总表。
- 入链来源只在现成句子中加，每页最多 1 条；两站不互链。

### 决策 16：门槛与长度下限

**每批页面的门槛**（每组 PR 都要满足；协调者在第 21、29 组整体复核）：

1. 组内相似度：`measure-locale-similarity --enforce <locales>`，按 H2 段对齐，每段 ≤0.30；数据表段（`data-table-section`）与整页只报告。第 1 组为新集合加定义：`yearly`、`zodiac-pair`、`compat-scenario`、`nongminli-month`、`moon-month`、`western-sign`、`western-pair`、`angel-number`、`personal-year`、`tarot-spread`。
2. 跨语言：ko、zh-Hant、en、ja 与 zh-Hans 之间的结构直译分、`measure-locale-backtranslation --from-file` 在门槛内；zh-Hant 另过 `--opencc` 同文字变体门槛。
3. `audit:seo`（TDK 长度、正文内链 2–5、锚文本 ≤2 种、top1 ≤70%）、`check:links`（无孤岛、死链、指向 noindex 的正文链接）、`check:i18n-seo`。
4. 术语表锚点：新出现的 en、ja、es 术语登记到 `apps/web/i18n/glossary/*.json`，`check-locale-glossary` 通过。
5. 关键词归属补登；判定词审计为 0（关系类页面）。
6. 引擎事实复算：每个新集合一个 `scripts/check-content-<集合>.mjs`，仿照 `check-content-zodiac.mjs`，逐项用引擎复算正文与 frontmatter 中出现的干支、关系、日期、괘 번호、月相时刻、角距。
7. 首页包预算（`check-home-bundle`）；公开页数据库不可达时 200。
8. 合规措辞：免费页写「依据传统方法推算、仅供参考与潜意识探索、不预测未来（沿用站上现有措辞，画布中的「自我探索」不采用）」（各语言对应）；不提 AI、不用「娱乐」、不给吉日判定；ko 用합쇼체。

**长度下限**（渲染正文，不含表格单元与 FAQ；中文按汉字，ko 按不含空格字符，en、es 按词）：

| 页 | zh-Hans / zh-Hant | ko | ja | en / es |
|---|---|---|---|---|
| 2027 枢纽 / 年度生肖页 | 800 / 1,200 | 1,000 / 1,600 | — | 700 / 900 |
| 个人年度工具 | 1,000 | 1,300 | — | 800 |
| 合盘工具 / 场景页 | 1,200 / 800 | 现有 / 1,000 | 1,500 / 1,000 | 900 / 600 |
| 配对总表 / 配对页 | 800 / 800 | 1,000 / 1,000 | — | 700 / 600 |
| 토정비결工具 | — | 2,000（每괘 250–400） | — | — |
| 農民曆工具 / 月份 / 2027 太歲 | 1,200 / 600 / 1,200 | — | — | — |
| 月相各页 / 月份页 | — | — | — | 700 / 400 |
| 星座档案 / 总表 / 配对 | — | — | — | 1,000 / 500 / 600 |
| angel number / personal year / 牌阵 | — | — | — | 600 / 700 / 800 |

TDK 长度按 `audit-seo.mjs` 的 `tdkLength`（中韩 Title 20–30、Description 70–80 全角宽；en、es 按现有区间）。

### 决策 17：文案撰写与交叉审阅

- 规则同第 2 阶段决策 14：Claude 写的由 Codex 审，反之亦然（使用者 2026-11-20 规则；回译不用 API，见 Codex 回译流程）。
- **zh-Hans**：Claude 子代理撰写；Codex 做事实与合规审阅。
- **zh-Hant、ko、ja、en、es**：另一个 Claude 子代理按本语言搜索词直接撰写；Codex 回译后用 `measure-locale-backtranslation --from-file` 计算，并用跨语言结构直译分把关。
- **토정비결**：Claude 撰写 144 段；Codex 做合规、합쇼체与原创性抽样比对（对照公开现代译本），记录存证据目录。
- **详批提示词**：Claude 起草；评测以 `--no-judge` 生成，由新开的 Claude 子代理按评分标准复核（使用者 2026-11-22 规则），Codex 做第二读者审阅措辞与判定词。
- 所有数字、干支、日期、괘 번호、月相时刻由引擎复算（决策 16 第 6 项）。

### 决策 18：设计稿

- 设计稿**另行产出**（ui-design，Design 画布），本 change 只登记与核对覆盖面。确认后副本存 `docs/design/prototypes/content-growth-v2-tools/`，并在 `docs/design/prototypes/README.md` 每个页面一行登记（第 5 组；2026-11-23 已确认并登记，画布 https://claude.ai/artifact/JVKZo14GYdaGNPWfrtvZXt；使用者接受的 13 项默认见索引行）。
- **第一批（波次 A，M0 前确认）**应覆盖：
  - 首页精选（东、西站，桌面与手机，季节位两态）、全部工具枢纽（东、西）、页头「全部工具」入口；
  - 2027 枢纽、年度生肖页（含 ko 手机长标题）、个人年度工具（四态：空、结果、无时辰、错误）；
  - 合盘工具多语言版、场景页、对方资料用途说明、分享卡（不含生日）；
  - 生肖配对总表（桌面网格、手机列表）与配对页；
  - 토정비결工具（输入、结果、阴历切换、错误）；
  - 農民曆差异（胎神行）与 2027 太歲页；
  - 月相四类页面（今日、满月、月份、年度表）；
  - 星座档案、配对总表与配对页。
- **第二批（波次 B 与后续组开工前）**：三巨头、出生星盘（星盘图、行星表、地名自动补全与未知时间态）、后续工具、angel numbers、personal year、牌阵页。
- 带 UI 的任务组在对应画板经使用者确认前不开始 UI 实现；文案、引擎与路由不受影响。
- 第 2 阶段已确认的版式（黄历、生肖、FactTable）可直接复用；只有新区块需要新画板。

### 决策 19：W3 星盘引擎与工具（波次 B）

- **`@xuanxue/astro/chart`**（第 22 组）：
  - 行星：太阳、月亮、水星至冥王星的地心视黄经（astronomy-engine），平均月交点用公式；不含凯龙、莉莉丝（以后需要时评估 Swiss Ephemeris 专业许可，不用 AGPL 版）；
  - 上升、天顶：由地方恒星时与黄赤交角计算；
  - 宫位：Placidus 为默认，整宫制为备选；纬度 >66° 时 Placidus 不可解，自动改用整宫制并标注；
  - 相位：合、六分、四分、三分、对分，容许度在代码中固定并在页面说明。
- **地名与时区**：GeoNames cities15000（CC-BY 4.0，页面署名）按首字母切片为静态 JSON，放 R2 或随构建发布，客户端按需加载；时区取地名记录的 IANA id，历史时差与夏令时由 `Intl.DateTimeFormat` 求得。不查 Neon。
- **精度门槛**（第 22 组，未通过不进入第 23 组）：30 个参考样例（南北半球、高纬度、夏令时切换当日、1970 年前、日期变更线附近），参考值取自 astro.com 星盘或 Swiss Ephemeris 输出，存为测试夹具（只存数值）；行星 ≤1 角分、上升与天顶 ≤0.05°、Placidus 宫头 ≤0.1°、落座与落宫全部一致。报告存证据目录。
- **页面**（第 23 组）：三巨头计算器（主词 rising sign calculator，副词 big three calculator）与出生星盘（主词 birth chart calculator，副词 free birth chart）；星盘图 SVG 组件放 `@xuanxue/ui/project` 或 web 内部组件（按设计稿）。
- **付费完整解读**：新增详批类型 `natal-full`（en 先行），服务端复算星盘后生成；评测流程同决策 17。
- **落座页**（第 24 组，可选）：144 个「上升 X 座」「月亮落 X 座」页，按组内相似度门槛分批，先做高量子集；是否做由第 23 组上线后 4 周的数据决定。
- **后续工具**（第 25 组）：合盘（synastry，两人星盘相位表；同样遵守判定词约束与第三方资料规则）、逆行日历（预计算、预渲染）、土星回归、太阳返照；每项单独设计稿与 PR。

### 决策 20：并入的 v1 第 3 阶段

- **angel numbers**（第 26 组）：枢纽 + 约 30 个数字（111、222、333、444、555、666、777、888、999、000、1111、1212、1234 等按搜索量取）；每页从数字命理角度撰写，链接相关生命灵数页；es 按「números angelicales」另写，数字集合可以不同。
- **personal year**（第 27 组）：计算器与 1–9 页，复用 `readings-prompt-v4-yearly` 已有的逐年个人年数规则，测试锁定一致。
- **塔罗牌阵**（第 28 组）：爱情、事业、满月牌阵（与 W1 互链），复用抽牌组件；不争「free tarot reading」。
- 这三组排在波次 A 之后，可与波次 B 并行（不依赖星盘引擎）。

### 决策 21：收录提交与 Search Console 配额

- 「请求编入索引」每个 Google 账号每天约 10 次，两站共用。波次 A 新增可索引页约 300 个，不能逐页请求。
- **做法**：
  - 发版流水线照常提交 IndexNow 与站点地图；
  - 协调者在第 21 组列出优先队列：每天最多 10 个，先钱页与枢纽（2027 枢纽 × 4、个人年度工具 × 4、合盘工具 × 4、토정비결、農民曆、2027 太歲、生肖配对总表、月相 4 页、星座配对总表、全部工具页），约 4 天排完；其余页靠枢纽内链与站点地图被发现；
  - 按约定，请求编入索引与站点地图重提由 Grok bot 按清单执行，结果表格回传；本 change 只交付清单与顺序。
- 2–4 周后按集群复查 GSC（已编入、曝光、排名），结论记证据目录。

## Risks / Trade-offs

- [三周内并行组多，文案量大，可能赶不上 12-15] → 文案先行；关键路径外的组明确标出；按决策 1 的裁剪顺序推迟 W2、合盘场景、es 月相；E1、E3、E5 优先保障。
- [程序化集合相似度超标：78 组配对、144 괘、12 月份页] → 组件段配逐页 `*_note`；第 1 组先用原型估算各段独有字数；超标时减少表格中重复标签，不绕开测量。
- [合盘放宽后出现判定类措辞或歧视性生肖描述] → 判定词审计作为硬门槛；撰写说明写入约束；Codex 审阅逐项核对；详批评测把判定词列入确定性检查。
- [对方资料隐私] → 默认不保存、分享不带生日、详批前说明；旧分享链接兼容读取但不再生成。
- [토정비결算法流派差异导致结果与他站不同] → 工具页写明采用的公式与差异；测试固定公开示例；不声称「唯一正确」。
- [토정비결解读与现有译本雷同的版权风险] → 全部原创，Codex 抽样比对，记录存证据。
- [月相主词有 Google 答案框，点击率低] → 主打长尾（is tonight a full moon、moon calendar 月份、full moon calendar 2027）；投入控制在一周。
- [月相预计算表随时间过期] → 构建检查剩余覆盖期 ≥13 个月；发版频繁；表过期前一个月 CI 失败提醒。
- [astronomy-engine 进入 Worker 包体积] → 只在构建期与星盘工具的服务端复算使用；月相页客户端不加载；`check-home-bundle` 与 Worker 体积检查。
- [星盘引擎精度不足或地名时区错误] → 精度门槛先于页面；夏令时与历史时区样例；未通过不上线。
- [2027 年度页与生肖子页、太岁概念页主词蚕食] → 决策 13 的核对要点；Title 开头区分年份。
- [`zodiac-pages`、`almanac-pages` delta 依赖第 2 阶段先归档] → 决策 14 的归档顺序；第 29 组核对。
- [请求编入索引配额不足] → 决策 21 的优先队列。

## Migration Plan

- 各组按 tasks.md 分别开 PR；合并到 main 后随统一发版上 staging，再上生产。合并与发版都需授权；生产部署由使用者在对话中「批准」后协调者用 gh API 批准该次部署（每次单独确认）。
- 不涉及数据库 schema 与迁移。回滚即还原对应 PR：新地址变回 404 并从站点地图移除；首页精选回退到原 `FEATURED`。
- 合盘对方资料不再写入 sessionStorage：已有会话中的旧值在首次加载新版本时清除。
- 详批新语言与 `natal-full` 通过运行时设置开放；回滚为切回「即将开放」，不需重新部署。
- **年度维护**（写入证据目录运维备忘）：每年 11 月准备次年年度页与季节位；2027-11 前裁定 2027 页处理；月相表随发版滚动；立春后核对「本年」切换。

## Open Questions

以下默认值已写入本设计，不影响 specs 与任务拆分；使用者可以在开工前改：

1. ko 个人年度工具以「2027 신년 사주」为主词，不以「신년운세」为 Title、H1 目标（与「띠별 운세」同理）。若使用者同意以「신년운세」为目标，只改决策 13 的一行与第 7 组的 TDK。
2. 西方「aries compatibility」等 12 个词默认由星座档案页兼任，不建 12 个行页（决策 12）。
3. 2027 年度页在 2028 年的处理（保留、301 或 noindex）留到 2027-11 裁定（决策 6）。
4. ko、en 生肖配对 01-22 上线（决策 9）；若使用者要求 12 月中，需要从第 13 组或第 20 组调人，并接受这两组推迟。
