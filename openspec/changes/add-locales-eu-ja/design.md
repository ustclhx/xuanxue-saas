# Design

## Context

动机见 proposal.md。与本设计直接相关的现状（2026-11-20，origin/main 60e9482ff）：

- **语言与站点**：`template.config.ts` 中 `i18n.locales = ['en','zh-Hant','zh-Hans','ko']`；`sites.east.locales = ['zh-Hant','zh-Hans','ko']`（无默认语言，`/` 按 Accept-Language 302/301），
  `sites.west.locales = ['en']`（默认语言无前缀）；`seo.linking.sites` 按站点分组。规则「每种语言只属于一个站点」写在 `multi-site` spec，
  `siteOfLocale()`、hreflang（`metadata.ts alternateLinks`）、站点地图、链接图检查都依赖它。东方站另有英文入口页 `/en`。
- **路由与路径**：Paraglide 2（`message-modules` 输出）按小写前缀识别语言；工具注册表 `features/tools/registry.ts` 按语言登记路径，
  没有登记的语言就没有页面、没有 hreflang；`switchLocalePath` 按注册表换页，目标语言没有对应页时回到语言首页。
  本地化路径段已存在：`/ko/만세력`、`/zh-hant/塔羅/牌義/the-sun`、`/ko/타로/카드/the-sun`（牌 slug 保持英文）。
- **内容**：content-collections 按 `content/<集合>/<locale>/` 组织；tarot 集合的 `locale` 是 `z.enum` 写死的四种语言；
  `packages/tarot/src/data/<locale>.ts` 存牌名与短牌义；数字命理只有 `en`；法律页按 `legal/<site>/<locale>`。
- **文案回退**：Paraglide 缺键时回退到 baseLocale `en`，构建只告警（`scripts/i18n-project.ts`）。模板 0.7.4 的「同站回退」规则：
  内容条目的原语言与页面语言同站时是回退页（canonical 指原文、noindex、不进站点地图）；**跨站时按普通页处理**——
  东方站 `ja` 页面若回退显示英文内容，会被当作正常页面收录，正是本设计要堵住的口子。
- **硬编码语言**：约 20 个文件写死 `'en' | 'zh-Hant' | 'zh-Hans' | 'ko'`（`packages/config` 的 `DefaultLocale`、`packages/tarot` 的 `Locale`、
  `packages/email` 的 `EMAIL_LOCALES`、`readings/catalog.ts`、`daily/rules/types.ts`、bazi 若干组件、`check-home-bundle.mjs` 的 `HOME_PAGES` 等）。
  `i18nMessages()` 在 `EMAIL_LOCALES` 缺语言时直接抛错，所以加语言必先加邮件文案。
- **AI 详批**：`readings/catalog.ts` 按「类型 × 语言」登记提示词变体：八字与紫微有 zh-Hant/zh-Hans，사주 ko，数字命理 en，塔罗四语；
  `evals/readings` 以 6 个组合 × 8 样本跑门槛（hard-checks 100%、accuracy ≥4.0、各维度不低于基线 −0.1、P95 token 与时长）。
- **币种**：`packages/billing/src/price-table.ts` 固定汇率价目表，Stripe 按语言结算 USD/TWD/KRW，PayPal 一律 USD（`currency.ts`）。
- **性能**：`marketing.performance` 开 `after-paint` 与 `criticalCss: 'used'`；首页包预算 `homeScriptGzipBudget = 352174` 按每个首页计，
  四个首页实测各 335,447 B（余量约 16.7KB），Paraglide 的 message-modules 让每条文案函数包含所有语言的字符串。
  落地页 HTML 余量约 1.5KB（约 105KB 往返边界，超出后 Lighthouse 慢 4G 多一个往返，LCP +150ms）。
  东方站标题字体是 Noto Sans TC/SC/KR 700 的 unicode-range 分片，关键样式按页保留用到的 `@font-face`。
- **构建**：上次全量构建（cache miss）约 38s，预渲染约 410 个页面（东方站每语言约 100、西方站约 110）。
- **SEO 修复第 5 步的测量**（`~/workspace/xuanxue-saas-evidence/seo-fix-20261119/part-b/`）：`measure.mjs` 取 `<main>` 去掉表单/导航，按 H2 切段；
  同文字对用字二元组 Dice + 整句复现，跨语言用结构直译分（段数、FAQ 数、段落数对齐、段长比离散度、数字序列重合）；
  `measure-intra.mjs` 测同语言跨牌模板重复。阈值：整页 Dice ≤0.60、整句复现 ≤15%、FAQ 段 ≤0.40、跨牌模板段 ≤0.30；
  ko 直译分 ≥0.7 视为直译（改写后概念页均值 0.33，牌义页因组件固定结构仍为 0.83）。

市场调研（关键词、竞品、需求证据）见 `~/workspace/xuanxue-saas-evidence/locales-eu-ja/research.md`，本文只引用结论。

## Goals / Non-Goals

**Goals:**
- 一次做好「加一种语言」所需的基础设施，使之后每种语言只剩内容、提示词、价格与审阅工作。
- 把「真实本地化」变成可复跑、可失败的检查，而不是写作要求。
- 新语言可以先合入 main、在 staging 验收，正式域名上在通过门槛前不可见。
- 不动既有语言的 URL、canonical、TDK 与内容；hreflang 与站点地图只增不改。

**Non-Goals:**
- 不让一种语言同时属于两个站点（见决策 1 的备选）。
- 不做欧洲语言的东方站内容（八字/紫微的欧洲语言版本）。
- 不做第一期的长尾：博客、每日运势、八字概念页、命盘查询、相性、`ja` 的数字命理。
- 不处理 EU VAT（OSS）与日本消费税登记、EU 14 天撤回权的结账同意流程——列为使用者/运营决策，不在本 change 实现。
- 不重提 Search Console 站点地图（全部工作完成后一次性交给 Grok bot）。

## Decisions

### 决策 1：语言清单与站点归属

| 语言 | 站点 | 期次 | 理由（详见 research.md） |
|---|---|---|---|
| `ja` | 东方站 | 1 | 唯一有真实八字/紫微需求的非中文语言：ja.wikipedia 四柱推命 5,446/月（高于英文 Four Pillars 5,097）、紫微斗数 1,277/月；日本占卜市场 2023 财年约 997 亿日元（矢野经济研究所）；免费排盘竞品多为薄的多语言工具站；「干支」是日语常用词（干支 20,232/月），品牌「干支日」直接成立 |
| `es` | 西方站 | 1 | 「número de vida」在西班牙与拉美媒体中长期高频出现，结果页以新闻稿为主、缺少强工具站；Numerología 2,173/月（Wikipedia） |
| `pt-BR` | 西方站 | 2 | 调研中最大的单一国家市场：塔罗是巴西第一占卜搜索，数字命理第四；葡萄牙只占头部巴西站流量的 1–6%，只做巴西葡语 |
| `fr` | 西方站 | 2 | 唯一有确证大量塔罗数据的欧洲语言（tarot、tarot gratuit 各约 71K/月，tarot oui non 30K/月）；竞品强（evozen 约 180 万搜索访问/月） |
| `de` | 西方站 | 3 | 塔罗兴趣欧洲最高（Tarot 9,097/月），数字命理多为杂志站覆盖；需求中等 |
| `it` | 西方站 | 3 | tarocchi 5,987/月，numerologia 2,037/月；需求中等 |
| `nl`、`pl`、`pt-PT` | — | 不做 | 需求小（nl Numerologie 477/月）；`pl` 塔罗相对市场体量不弱但需要 latin-ext 字体分片，列为可选 |

数字为公开估算（Wikipedia 浏览量作跨语言比例代理、Ahrefs/Semrush 公开站点快照），不是 Google 关键词量；第二期开工前用 Keyword Planner 或 Ahrefs 导出复核顺序。

- **欧洲语言不进东方站**：各欧洲语言「中国生肖/星座」的兴趣约为 BaZi 的 50 倍（de 7.3K、fr 12.8K、es 10.1K 对 Four Pillars 约 150–170/月），即「chinesisches Horoskop / horoscope chinois / horóscopo chino」这类生肖需求，
  与本站的八字排盘不是同一产品；做成薄页反而拖累收录。
- **`ja` 只在东方站**。日本也有大量 数秘術（ライフパスナンバー）需求，但「每种语言只属于一个站点」是 hreflang、canonical 与链接图的基础假设。
  第二期可把数字命理工具在 `ja` 下登记到东方站（与塔罗已在两站各登记一条的做法相同），需使用者确认（决策待定 D-3）。
- 备选「一种语言属于两站」：要改 `siteOfLocale`、hreflang、回退判定、链接图分组与模板的 `seo.linking.sites` 约束，属模板级改动，否决。

### 决策 2：URL 与路径段

- 前缀：小写 BCP 47（`/ja`、`/es`、`/pt-br`、`/fr`、`/de`、`/it`），与现有 `localeUrlSegment()` 一致，不新增规则。
- **日语路径段用日文关键词**，与 `/ko/만세력`、`/zh-hant/八字排盤` 一致：

  | 页面 | 路径 |
  |---|---|
  | 落地页 | `/ja` |
  | 四柱推命（主工具） | `/ja/四柱推命` |
  | 紫微斗数 | `/ja/紫微斗数` |
  | 三张牌 / 今日一张 / Yes-No / 凯尔特十字 | `/ja/タロット`、`/ja/タロット/今日の一枚`、`/ja/タロット/イエスノー`、`/ja/タロット/ケルト十字` |
  | 牌义索引 / 牌义 | `/ja/タロット/カード`、`/ja/タロット/カード/the-sun` |

- **欧洲语言路径段用去变音符的本地关键词**（避免百分号编码、便于分享）。第一期 `es`：

  | 英文 | 西班牙语 |
  |---|---|
  | `/life-path-number`、`/life-path-number/7` | `/es/numero-de-vida`、`/es/numero-de-vida/7` |
  | `/numerology-calculator` | `/es/calculadora-numerologia` |
  | `/name-numerology` | `/es/numerologia-del-nombre` |
  | `/life-path-compatibility` | `/es/compatibilidad-numerologica` |
  | `/numerology-chart` | `/es/carta-numerologica` |
  | `/destiny-number`、`/soul-urge-number` | `/es/numero-del-destino`、`/es/numero-del-alma` |
  | `/tarot`、`/tarot/daily`、`/tarot/yes-or-no`、`/tarot/celtic-cross` | `/es/tarot`、`/es/tarot/carta-del-dia`、`/es/tarot/si-o-no`、`/es/tarot/cruz-celta` |
  | `/tarot/cards`、`/tarot/cards/the-sun` | `/es/tarot/cartas`、`/es/tarot/cartas/the-sun` |

  其他语言的路径段在各自内容任务开始前按 research.md 的主词定稿，登记在注册表与术语表中。
- **牌 slug 保持英文**（`the-sun`），复用 `meaningAlternates()`，与 ko/zh 现状一致。备选「本地化牌 slug」（`el-sol`、`die-sonne`）
  URL 关键词收益很小，却要 78 × N 的 slug 表与重定向维护，否决；如使用者坚持，可只对欧洲语言做（决策待定 D-2）。
- 路径段全部经工具注册表登记；不登记的页面在该语言中不存在（404），因此「延后的长尾」不会产生薄页。

### 决策 3：hreflang 分组

- 继续「只在同站内声明」：西方站组 `en`、`es`（后续 `pt-BR`、`fr`、`de`、`it`），x-default 为 `en`；
  东方站组 `zh-Hant`、`zh-Hans`、`ko`、`ja`，x-default 为 `zh-Hant`；东方站首页与 `/en` 互指不变。
- `ja` 必须追加在东方站语言列表末尾（`locales[0]` 是 x-default 与根路径 301 的目标）。
- 只列出已发布且该页确有对应版本的语言（注册表天然满足）；未发布语言在 `alternateLinks()` 与站点地图中过滤（决策 5）。
- 验收用 seo-snapshot 对比：既有页面的差异只能是新增的 hreflang 行与新增的子站点地图。

### 决策 4：站点专属工具与各语言的工具集

| 工具 | `en` | `es`/`pt-BR`/`fr`/`de`/`it` | `zh-Hant`/`zh-Hans` | `ko` | `ja`（第一期） |
|---|---|---|---|---|---|
| Life Path 工具与 12 个数字页、计算器、姓名、相性、图表、destiny/soul urge | ✓ | ✓ | — | — | 第二期待定（D-3） |
| 每日数字命理 / 每日运势 | ✓ | 第二期 | ✓ | ✓ | 第二期（日本人搜的是六曜 9,255/月、一粒万倍日、大安，不是翻译的黄历宜忌，规则需重写） |
| 塔罗抽牌 ×4、牌义索引、78 张牌义 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 八字主工具 | — | — | ✓ | ✓ | ✓（四柱推命） |
| 紫微斗数 | — | — | ✓ | — | ✓ |
| 命盘查询 | — | — | ✓ | — | — |
| 사주궁합 / 相性 | — | — | — | ✓ | 第二期（「四柱推命 相性」） |
| 八字概念页 | — | — | ✓ | ✓ | 第二期 |

页头导航、内链矩阵、`switchLocalePath` 都从注册表读取，不需要额外分支；排盘结果中「大运 → 概念页」这类链接在目标不存在时不渲染。

### 决策 5：语言发布状态与回退

- 新增项目自有文件 `apps/web/src/features/i18n/rollout.ts`：`LOCALE_RELEASE: Record<locale, 'released' | 'pending'>`，现有四种语言为 `released`。
  `isLocaleLive(locale, host)`：已登记的正式主机上只有 `released` 为真；未登记主机（staging、预览、`*.localhost`）全部为真。
- 过滤点（每处一个调用、带测试）：站点守卫（未发布前缀 → 404，不做跨站 301）、站点地图索引与子站点地图、`alternateLinks()`、语言菜单与语言建议、
  `llms.txt`、东方站根路径跳转、认证页语言进入。预渲染照常生成 pending 语言页面（staging 需要），正式主机上由守卫返回 404。
- 备选 A「语言未完成前不写进 template.config」：Paraglide 不编译该语言，staging 无法验收，内容也不能分批合并；否决。
  备选 B「长期集成分支」：与其他 change 冲突严重；否决。
- **严格文案**：`scripts/i18n-project.ts` 增加严格语言集合（全部新语言），这些语言在公开、认证、账户、计费与邮件相关功能文件中缺键时构建失败；
  只有 `admin*`、`ui-preview*` 等后台功能文件允许回退。这是模板文件的改动，同时整理成模板需求提交给 template supervisor。
- **内容回退**：新语言的内容集合（tarot、numerology、legal）缺条目时，构建检查失败（第一期页面集合必须齐全），不依赖 0.7.4 的回退页规则。
  东方站 `ja` 不允许回退到英文内容，检查脚本对 `ja` 页面正文做文字检测（必须含假名，拉丁字母比例低于阈值）。

### 决策 6：结算币种

| 语言 | Stripe | PayPal | 说明 |
|---|---|---|---|
| `ja` | JPY | USD | JPY 零小数，按 10 日元取整（如 $2.99 → ¥450，快照汇率在价目表中定稿） |
| `es` | USD | USD | 西语访客以拉美为主，单一 EUR 不合适；按国家分币种超出「按界面语言」规则，否决 |
| `pt-BR` | BRL | USD | 需确认 Stripe 账户可对 BRL 收款（巴西卡对外币有 IOF 费用，本币可提高转化） |
| `fr`、`de`、`it` | EUR | USD | 欧元 .99 定价 |

- 复用 `localize-checkout-currency` 的价目表、币种指数表与回退规则；`currency.ts` 的 `EnabledCurrency`、回调币种白名单、
  `formatMoney()`（JPY、EUR、BRL 的本地格式）与同步脚本扩展。
- 各币种的具体金额由使用者确认；Stripe live 价格创建是外部写操作，需使用者批准后由协调者执行。
- 税务：EU 对非欧盟卖家的 B2C 数字服务从第一欧元起需要 VAT（OSS），日本对境外数字服务有消费税（年销售超 1,000 万日元须登记）。
  这与语言无关（英文页面已对欧盟用户销售），但扩语言会放大，列为待定 D-7，本 change 不改税务流程。

### 决策 7：AI 详批语言

- 每个「类型 × 语言」一个提示词变体（沿用 catalog 的注册方式与「已发布版本不可改」规则）：
  `ja`：bazi-full（四柱推命）、ziwei-full、tarot-spread；`es`：numerology-full、tarot-spread。
- 日语提示词不是中文提示词的翻译：要用日本流派的术语（命式、通変星、蔵干、十二運星、天中殺、身強・身弱）与结构；
  西语提示词以英文 v4 为骨架，加入西语术语表与合规表述，输出语言固定为西班牙语（中性拉美西语，避免 vosotros）。
- 评测：`evals/readings` 新增套件版本，每个新组合 ≥8 个虚构样本（日本、拉美/西班牙的出生地与姓名），沿用全部门槛；
  新增确定性检查：输出文字检测（`ja` 必须含假名且不出现简体专用字形，`es` 不出现 CJK），术语表禁用词检查。
  LLM 评委用同一套 rubric，评委提示词注明目标语言。真实调用需要 `--budget-usd`，预算由使用者批准。
- 未通过门槛的组合在该语言隐藏解锁卡（`paid-readings` delta）；免费工具照常上线，不阻塞 SEO。
- 追问（follow-ups）与主题对话沿用详批语言；guard 的繁中字形补正只作用于 zh-Hant。

### 决策 8：法律页与邮件

- 法律页：每种语言提供所属站点法律页的译文（隐私、条款、退款、免责、运营方说明），LLM 初译 + 另一模型交叉审阅；页内注明「以英文版（西方站）／繁體中文版（东方站）为准」，
  但 EU 消费者权利不能被语言条款排除。法律页不进相似度门槛（译文本来就应一致）。EU 14 天撤回权与数字内容立即履行的同意，
  在结账页的处理与语言无关，列为待定 D-8，需要法律审阅。
- 邮件：`packages/email` 的 `EMAIL_LOCALES` 与文案按语言补齐（构建已强制）；`resolveEmailLocale` 加入 `pt` → `pt-BR`、`es-*` → `es` 的映射。
  事务邮件是翻译性质，不进相似度门槛，但进术语表检查与跨模型抽检。

### 决策 9：第一期页面集合

| 页面 | `es`（西方站） | `ja`（东方站） |
|---|---|---|
| 落地页、定价、FAQ、通讯页 | ✓ | ✓ |
| 主工具 | Life Path 工具 + 12 数字页 | 四柱推命 |
| 其他工具 | 计算器、姓名、相性、图表、destiny、soul urge | 紫微斗数 |
| 塔罗 | 抽牌 4 页、牌义索引、78 张牌义 | 同左 |
| 法律页 | 4 + 运营方说明 | 同左 |
| 认证、账户、应用区、计费界面与邮件 | ✓ | ✓ |
| **合计公开可索引页（约）** | **≈106** | **≈93** |

延后：博客、每日页、八字概念页、相性、命盘查询、`ja` 数字命理。78 张牌义页作为整体上线（索引页需要全部牌）；
如果内容产出跟不上，备选是先发大阿尔卡那 22 张、索引页只列已有牌（需改索引页，列为待定 D-5）。

### 决策 10：内容生产方法与质量门槛

- **不是翻译流程**：每页由写作代理拿「事实单」写作——事实单包含引擎计算事实、固定关键词与正逆位倾向、该语言主词与次级词、
  本地 SERP 的真实问题（People Also Ask、Yahoo!知恵袋、Reddit/foros）、术语表、合规表述与内链锚文本，**不提供源语言正文**，从源头避免逐句对译。
- **术语表**：`apps/web/i18n/glossary/<locale>.json`（首选词、禁用写法、合规表述、锚文本白名单 ≤2 种/目标），由 `check-locale-glossary.mjs` 检查，接入 `pnpm check`。
  例：`ja` 正位置/逆位置（禁「正位」）、命式（禁「命盤」）、通変星（禁「十神」）；`es` Oros（不用 Pentáculos 作花色名）、número del camino de vida；
  `de` Münzen/Stäbe/Kelche/Schwerter、Lebenszahl；`fr` Deniers/Bâtons/Coupes/Épées、chemin de vie。
- **测量**：把 part-b 的 `measure.mjs`/`measure-intra.mjs` 移植为 `apps/web/scripts/measure-locale-similarity.mjs`（只用已有的 happy-dom，
  不引入 opencc；繁简对比仍用证据目录的脚本）。按站点地图与 hreflang 配对，输出 JSON 与 Markdown 报告到 `EVIDENCE_DIR`。
- **阈值**（`localized-content-quality` spec）：
  1. 结构直译分 ≤0.60（正文为主的页面：落地页、工具页、数字页、FAQ 页）；牌义页因组件固定结构不用此项。
  2. 回译相似度：页面经固定模型、温度 0 回译成源语言后，与源页的词二元组 Dice ≤ 校准阈值（默认 0.50），FAQ 段 ≤0.40。
     校准：每种语言用 3 页「机器直译」对照组测出直译的基线，阈值取 min(0.50, 对照组中位数 − 0.20)，校准结果写进报告。
  3. 数字序列重合度 ≤0.50（含示例的页面）。
  4. 同语言程序化集合按位置段落平均 Dice ≤0.30。
  5. 同文字变体（如后续 `pt-PT`）沿用 Dice ≤0.60 / 整句复现 ≤15% / FAQ ≤0.40。
  6. FAQ：内容源中每个问题标 `origin: local | adapted`，每页 `local` ≥2（3 问页）；检查脚本统计。
  7. 长度下限：工具页正文 ≥ 本语言 600 词（`ja` 1,500 字），数字页与牌义页不少于英文对应页的 70%（防止薄页）。
- **审阅**（D-6，使用者决定只用 AI）：首页、主工具、定价、法律由另一模型逐页交叉审阅，程序化集合每集合 ≥10% 交叉抽审；不安排人工母语审阅；记录进证据目录。
- **门槛与发布挂钩**：一种语言改为 `released` 的 PR 必须附 measure 报告、术语检查、审阅记录与链接检查的结果。

### 决策 11：性能与预算

- **HTML 体积**：hreflang 每条约 90–130B（日文路径百分号编码后更长），东方站首页 +1 条 `ja`；语言菜单每项约 200B。
  东方站首页约 +350B、西方站首页（菜单首次出现 + `es`）约 +900B，均在 1.5KB 余量内；后续语言把西方站首页推到约 +2.2KB（6 种语言），
  会超出余量。对策：语言菜单项精简 class（共用一个类名），菜单在第二期前改为「首帧只输出当前语言 + 一个指向语言列表的按钮」由 Fable 处理视觉；
  每期验收测落地页 HTML（原始与 gzip）。
- **字体**：日语页如引入 Noto Sans JP 700，unicode-range 分片约 120 条 `@font-face`，内联后 HTML 增加约 25–35KB，直接超出往返边界。
  第一期 `ja` 标题使用系统日文字体（Hiragino Kaku Gothic ProN / Yu Gothic / Meiryo）+ 度量匹配的本地回退，不加载网页字体；
  同时把东方站默认的 TC 字体规则改为只在 `:lang(zh-Hant)` 生效，避免 `ja`/`ko` 页内联 TC 分片。视觉确认由 Fable 做。
  西方站 Manrope 的 latin 分片覆盖西、葡、法、德、意的变音符；`pl` 需要 latin-ext（不做）。
- **首页脚本**：每条 Paraglide 文案函数包含全部语言字符串，加 2 种语言会让每个首页闭包增加首页文案的 2 份。
  先做测量（任务 1.6）：若增量超过余量 16.7KB，首选 Paraglide 的按语言拆分（`experimentalMiddlewareLocaleSplitting` 或 locale-modules），
  其次把首页岛屿用到的文案减到最少；**不默认上调预算**，上调需使用者确认（D-9）。新首页加入 `HOME_PAGES` 与 head 快照。
- **构建时间**：预渲染页面约 410 → 610（第一期）→ 约 1,050（全部语言）；按目前约 38s 的全量构建，估计第一期 +15–25s、全部 +60–90s，
  仍在 CI 可接受范围；如超过 3 分钟，再评估按站点拆分预渲染。Worker 上传体积（文案与牌义数据按语言增长）每期记录，留在 10MB 压缩上限内。
- **LCP**：每个新首页与一个主工具页跑 Lighthouse 移动端，LCP 不比同站现有首页基线差 100ms 以上，CLS 不增加。

### 决策 12：模板边界与分工

- 改动尽量放在项目自有文件（`pages.project.ts`、`rollout.ts`、注册表、内容、术语表、脚本）；必须改的模板文件
  （`i18n-project.ts` 严格模式、`metadata.ts` 过滤、`check-home-bundle.mjs` 的首页清单、Paraglide 拆分）同时整理成模板需求，避免下一次 template-sync 冲突。
- 分工：基础设施、路由、SEO、计费、评测 → Opus 或 Codex；内容写作 → Opus 子代理按批次（与 part-b 相同的方式）；
  语言菜单、日语字体与排版、首页在新语言下的视觉检查 → Fable。第一期没有新页面类型或新布局，**不需要 ui-design 设计稿**；
  若 D-11 选择改造语言菜单（首帧只输出按钮），属于较大布局改动，需要 ui-design 设计稿并经使用者确认。

### 待使用者决定（开工前需要答复的项，括号内为推荐）

| 编号 | 问题 | 推荐 |
|---|---|---|
| D-1 | 语言清单、站点归属与顺序 | 第一期 `ja`（东方站）+ `es`（西方站）；第二期 `pt-BR`、`fr`；第三期 `de`、`it`；不做 `nl`、`pl`、`pt-PT`；欧洲语言不进东方站 |
| D-2 | 牌义页 slug 是否本地化 | 不本地化，保持 `the-sun`，只本地化路径段 |
| D-3 | `ja` 是否在第二期加数秘術（在东方站登记数字命理工具） | 是，第一期复盘后再定 |
| D-4 | `es` 的结算币种 | Stripe 与 PayPal 都用 USD |
| D-5 | 78 张牌义是否整体上线 | 整体上线；产出不足时退到「先大阿尔卡那」 |
| D-6 | 审阅方式 | **已定（使用者 2026-11-20）：只用 AI**——另一模型交叉审阅 + 自动门槛，不请人工母语审阅 |
| D-7 | EU VAT（OSS）与日本消费税 | 由运营决定；建议在欧洲语言（第二期）发布前开启 Stripe Tax 评估 |
| D-8 | EU 14 天撤回权在结账页的同意文案 | 第二期前做法律审阅；第一期 `es` 以拉美为主可先不改 |
| D-9 | 首页包预算能否上调 | 不上调，先做按语言拆分；拆分不可行时再请使用者确认上调幅度 |
| D-10 | 第一期是否同时上 AI 详批 | 是，但每个组合必须过评测门槛，否则该组合隐藏解锁卡；真实评测预算每语言 ≤ US$15 |
| D-11 | 第二期前是否改造语言菜单（首帧只输出按钮） | 是，走 ui-design 设计稿 |
| D-12 | 法律译文以哪种语言为准、是否请律师审阅 | 西方站以英文为准、东方站以繁中为准；欧洲语言发布前做一次律师审阅 |
| D-13 | JPY / EUR / BRL 的具体价格 | 按价目表规则算出后由使用者逐项确认 |
| D-14 | 发布开关方式 | 采用项目自有的发布状态（决策 5） |

## Risks / Trade-offs

- [内容量大：第一期约 200 页、日文约 25 万字、西文约 9 万词] → 写作按花色/数字分批并行，每批跑门槛；牌义可退到「先大阿尔卡那」（D-5）。
- [回译相似度依赖模型与回译风格] → 用对照组校准阈值，报告中同时给出结构直译分与人工抽检结论；以审阅为最终裁定。
- [新语言页面被 Google 当作直译仍不收录] → 门槛外再加发布后 4 周的 GSC 覆盖率复盘；第二期语言在第一期复盘后再开工。
- [`ja` 与中文共享汉字，结构上易被写成中文的转写] → 写作不提供中文正文；术语表禁用中文术语；回译对照以 zh-Hans 与 ko 双源测量。
- [Paraglide 文案增长挤爆首页预算] → 任务 1.6 先测量与拆分评估；不行再减文案；预算上调需使用者同意。
- [EU/日本税务与撤回权] → 不在本 change 解决，但发布欧洲语言前需使用者对 D-7、D-8 给出结论。
- [模板文件改动与 template-sync 冲突] → 改动最小化并提交模板需求。
- [staging 预览主机全部语言可见] → 预览主机整体 noindex（既有规则），不影响正式站。

## Migration Plan

1. **第 0 期（基础设施，可合入 main，正式站无变化）**：发布状态、硬编码语言集中化、严格文案、过滤点、测量与术语脚本、首页包测量与拆分、字体规则。
   验收：既有页面 seo-snapshot 逐字节一致；所有检查通过。
2. **第 1 期**：`ja`、`es` 以 `pending` 状态加入配置 → 内容与提示词分批合入 → staging 验收 → 门槛报告齐全 → 使用者确认 → 改为 `released` 并发版。
   发版后：canonical/hreflang/sitemap diff 只含新增；IndexNow 由发版流水线自动提交；Search Console 不单独提交。
3. **第 2、3 期**：每种语言重复第 1 期流程（无基础设施改动）。
4. **回滚**：把语言改回 `pending` 即在正式站下线（404、移出站点地图与 hreflang），无需回滚代码；已建的 Stripe 价格保持停用即可。

### 工作量估计（粗估，代理工作日；并行后日历时间更短）

| 部分 | 工作量 | 说明 |
|---|---|---|
| 第 0 期基础设施（第 1–3 组） | 6–8 天 | 发布状态与过滤点 2 天、硬编码语言集中 1–2 天、严格文案与内容检查 1 天、首页包拆分评估 1–2 天、测量/术语脚本 1–2 天、字体与页头 1 天 |
| `ja` 第一期（第 4 组） | 8–11 天 | 牌义约 19 万日文字（5 批并行，约 3 天）、工具与落地页 2 天、术语与四柱推命呈现 1–2 天、详批提示词与评测 2 天、计费 1 天、审阅修订 1–2 天 |
| `es` 第一期（第 5 组） | 7–9 天 | 牌义约 7 万词（3 天）、数字命理 15 页约 2 万词（2 天）、工具页 1 天、详批与评测 1–2 天、审阅修订 1 天 |
| 第一期发布（第 6 组） | 1–2 天 | 验收、diff、发版与核对 |
| **第一期合计** | **约 22–30 天工作量，日历约 2.5–3.5 周** | 第 1/2/3 组并行，4/5 组在第 1 组合并后并行 |
| 每个第二、三期语言 | 6–8 天 | 无基础设施改动；欧元/巴西雷亚尔计费各约 1 天 |

外部成本：回译与评测的模型调用每语言预计 US$10–30（需批准）。

## Open Questions

- 回译用哪个模型与温度，回译成本每种语言约多少美元（任务 2.2 校准时给出）。
- 第二期 `pt-BR` 的 BRL 是否被当前 Stripe 账户支持（任务 6.x 只读查询确认）。


## 使用者决定（2026-11-20）

- 语言与站点、顺序：按建议（阶段 1 东方站 `ja`、西方站 `es`；阶段 2 西方站 `pt-BR`、`fr`；阶段 3 `de`、`it`；东方站不加欧洲语言）。
- 审阅：只用 AI（「AI review only」），不安排人工母语审阅；质量靠自动门槛与跨模型审阅。
- 币种：`ja`→JPY、`es`→USD、`pt-BR`→BRL、`fr`/`de`/`it`→EUR，PayPal 保持 USD；具体价格与 Stripe live 建价在上线前另行请使用者确认。
- 其余默认按建议：牌义 slug 保持英文；78 张牌一次上线；阶段 1 开 AI 详批但每种详批×语言评测通过前隐藏解锁卡（真实评测预算每语言 ≤US$15）；不提高首页包预算；`rollout.ts` 发布开关；EU VAT、14 天撤回权与法律译文审阅在阶段 2 前决定；语言菜单在阶段 2 前走 ui-design 设计稿。

- 使用者补充（2026-11-20）：每种语言使用独立子目录网址（`/ja/`、`/es/`），文案各语言独立维护，不由其他语言自动生成；**每种语言的内页关键词须单独设计**——上线前为每个页面确定当地主词（slug、Title、H1、锚文本），依据当地搜索词调研而非直译。做完 `ja`、`es` 后暂停加语言，先做 content growth，之后再回来做第 7 组（pt-BR、fr、de、it）。

- 使用者补充（2026-11-20）：第一期同时给东方站补完整英文页面（`ganjiday.com/en/…`：四柱八字 / Four Pillars、紫微、塔罗等），不只现有 `/en` 导览页（原 SEO 任务书「不扩英文工具页」作废）。**网址已由下文「网址与切换规则（2026-11-20 重定）」取代：东方站英文在根路径 `/…`，不在 `/en/…`。**`en` 因此按站点各自登记：两站各有英文页面与各自的 hreflang 组，互不跨 host、互不链接；东方站英文塔罗文案须与西方站英文不同，跨站也执行相似度门槛（结构、回译之外，同语言同类页段落 Dice ≤0.30）。基础设施（第 1 组）须支持「一种语言属于多个站点」，现有输出逐字节不变。

## 第 0 期实施记录（第 1 组，2026-11-20）

本节记录任务 0.1、1.1–1.10 落地时对上文决策的细化与偏差，证据在 `~/workspace/xuanxue-saas-evidence/locales-eu-ja/phase0/`。

### 发布状态的范围（细化决策 5）

- 第 0 期**不把** `ja`、`es` 写进 `template.config.ts`（仍由 4.1 / 5.1 写入）：写入后 Paraglide 会编译该语言、严格文案与内容检查会因缺内容而失败。
  `rollout.ts` 预先登记 `east.ja`、`west.es`、`east.en` 为 pending，写入配置后自动按 pending 处理；未登记的组合一律按 pending。
- **按「站点 × 语言」登记**（使用者补充：东方站完整英文页面）：`LOCALE_RELEASE.east.en` 与 `west.en` 各自发布。站点守卫按「本站语言列表」
  判断归属（`siteHasLocale`），不再经 `siteOfLocale` 的单一归属；`siteOfLocale` 在一种语言属于多站时取以它为默认语言的站点（`en` → 西方站），
  使只知道语言的场景（规范域名、品牌名）保持现状。东方站现有英文入口页 `/en` 不受 `east.en` 状态影响。
- **可发现位置不看主机**：hreflang、语言菜单、语言建议随预渲染 HTML 在构建期生成，同一份文件在正式域名与 staging 都会返回，
  因此这些位置（以及站点地图、`robots.txt`、`llms.txt`、东方站根路径跳转、认证页语言跳转）一律只列已发布语言；
  未发布语言在 staging / 本地只能按地址直接访问（预览主机整体 noindex）。未发布语言页面自身的 hreflang 保留自指。
- **访问控制看主机**：正式域名（`sites.*.hosts`）上未发布语言前缀返回本站导航语言的 404，不跨站；`*.localhost` 与 `*.workers.dev` 放行。
  构建期预渲染以正式域名为 Host 请求页面，守卫对预渲染请求不按发布状态拦截（`gateSiteRequest({ prerender })`），pending 页面照常预渲染供 staging 使用；
  浏览器端的外站前缀判断（`hasForeignPrefix`）只在浏览器中考虑发布状态，服务端由守卫负责。
- 应用区：正式域名上未发布语言不作为账户语言（`request.server.ts ownsLocale`）。

### 首页包测量与按语言拆分（任务 1.6，细化决策 11）

- 模拟两种新语言的完整文案（ja = 繁中逐字 CJK 码位 +1，es = 英文 rot13，字数与熵不变）：每个首页闭包 gzip 从 350,023 B 增至 374,078 B（+24,055 B，约每种语言 +12KB），
  超出预算 352,174 B。首页闭包约有 492 条文案（daily 105、bazi 82、auth 58、account 57、numerology 56 …，来自路由树的静态部分）。
- Paraglide 自带方案不适用：`experimentalStaticLocale` / per-locale build 要按语言各构建一份客户端图并分发静态资源，与 TanStack Start 的 buildApp 编排冲突；
  `experimentalMiddlewareLocaleSplitting` 不支持客户端路由。
- 实现项目插件 `scripts/locale-split.ts`：客户端构建中把严格语言（v1 之后的新语言）的文案函数移出文案模块，每种语言生成一个字典分包；
  文案回退行改为 `splitMessage(locale, 序号, en_x)(inputs)`，v1 四种语言照旧内联。客户端入口在水合前按当前语言加载字典（与 StartClient 并行），
  v1 语言页面不加载。服务端不拆分，SSR / 预渲染输出完整文案。拆分后首页闭包只多一次性的查表开销，与新语言数量无关；
  新语言页面另下载本语言字典（模拟全量文案约 46–50KB gzip，含后台文案；实际后台文案不翻译会更小）。实测数字见 PR。
- `HOME_PAGES` 改为由站点语言生成（`homePagesFor`），新语言首页（含 pending）自动纳入预算与 head 快照检查；新首页的快照在写入语言的 PR 中用 `--write-head-snapshot` 补上。

### 模板需求（第 0 期改动的模板文件，需整理给 template supervisor）

| 编号 | 模板文件 | 需求 |
|---|---|---|
| TR-1 | `packages/config` `resolveSites`、`resolveSeoLinking` | 允许一种语言属于多个站点（按站点登记语言）；`seo.linking.sites` 不再拒绝重复语言（东方站根路径英文页面） |
| TR-2 | `features/seo/metadata.ts`、`origins.ts`、`pages.ts` | `alternateLinks` / `pageHead` / `sameSiteLocales` / `fallbackSourceLocale` / `localeOrigin` 按页面所属站点（`SeoPage.site`）而不是按语言推断；提供发布状态过滤钩子（本期在 `alternateLinks` 内调用项目的 `isLocaleReleased`） |
| TR-3 | `scripts/i18n-project.ts` | 严格语言选项：指定语言缺键时构建失败，后台等功能文件可豁免（本期已加 `strict` 选项） |
| TR-4 | `scripts/check-home-bundle.mjs` | 首页清单由站点配置生成（本期 `homePagesFor`） |
| TR-5 | `scripts/vite-shared.ts`、`src/client.tsx` | 项目插件与水合前钩子的扩展点（本期直接注册 `localeSplit` 并在入口调用 `loadSplitMessages`）；或模板内置按语言拆分 |
| TR-6 | `features/i18n/suggestion.ts`、`preference.ts`、`packages/email` `locale.ts` | 带地区的语言（`pt-BR`）只匹配同地区或不带地区的标签，`pt-PT` 不匹配（模板测试原期望 `pt-PT` → `pt-BR`） |
| TR-7 | `features/seo/crawlers.ts`、`features/i18n/language-controls.tsx`、`request.server.ts`、`src/server.ts` | 站点地图、robots、llms.txt、语言菜单、应用区语言与预渲染请求的发布状态钩子 |
| TR-8 | `apps/web/content-collections.ts`、`apps/web/package.json` | 内容集合语言枚举由配置推导；构建前运行项目的内容完整性检查 |

### 东方站英文（5b 组）的风险

- `en` 只有一套 Paraglide 文案：东方站英文页面的品牌、导航与工具文案不能直接复用西方站英文（Arcanumber、数字命理导航），
  需要按站点区分的文案层（例如东方站英文专用的功能文件与键，或站点作用域的 message 包装）。
- 内容集合与站点地图按语言取条目：`content/tarot/en` 同时被两站使用会造成两站同语言同主题的重复内容。
  东方站英文塔罗须独立内容源（例如 `content/tarot/en-east` 映射到东方站），并按决策 10 跨站测相似度（同语言同类页段落 Dice ≤0.30）。
- `seo.linking.sites`、链接图检查、`localeOrigin`、`publicPages` 的站点过滤都按「一种语言一个站点」写成，需 TR-1/TR-2 后再接入；
  在此之前把 `en` 加进东方站会让 `siteOfLocale` 之外的这些位置把东方站英文页当作西方站页面。

## 网址与切换规则（使用者 2026-11-20 重定；多语言 SEO 规范 ML-01～ML-10）

规范全文见 `~/workspace/xuanxue-saas-evidence/i18n-spec/multilingual-seo-spec.md`。与上文冲突时以本节为准。

- **`/` 是两站的英文首页，不跳转**。英语是两站的默认语言，其他语言各占小写前缀（`/zh-hant`、`/zh-hans`、`/ko`、`/ja`、`/es`），
  地址不变、不合并成 `/zh/`。东方站英文页面放在根路径下（内页 slug 由 5b.0 关键词地图定），不放在 `/en/…`。
- **过渡（1.11 已实现）**：东方站完整英文页面上线前，`/` 显示原英文入口页的内容（预渲染文件仍为 en.html，
  `static-pages.ts` 在东方站 `/` 读取它；路由改写把东方站 `/` 映射到路由 `/en`），`/en` 301 到 `/`。
  东方站各页 hreflang 的 `en` 改为 `https://ganjiday.com/`；首页组（`/`、`/zh-hant`、`/zh-hans`、`/ko`）的 x-default 改为 `/`；
  其余东方站页面没有英文版本，x-default 暂为繁中同页（ML-05「x-default 指向英文版本」在有英文版本时成立，5b 组上线英文页面后随之改变）。
  zh-hant / zh-hans / ko 首页的 canonical 不变。与 0.1 基线的全部差异逐行列在 1.11 的 PR 中。
- **只按地址区分语言**：去掉东方站根路径按 Accept-Language / Cookie 的 301/302；无前缀认证页（东方站）与应用区的回退
  改为固定的东方站第一个已发布语言（繁中），不看浏览器语言与偏好 Cookie；西方站认证页不再按浏览器语言跳转。
  应用区仍按账号语言与 `PARAGLIDE_LOCALE` Cookie 选语言（应用区没有语言前缀，属登录后界面，不被收录）——
  若要严格做到「Cookie 不决定语言」，需要应用区也带语言前缀，列为待定。
- **语言建议提示 LocalePrompt**（`features/i18n/locale-prompt.tsx`）：取代模板的 SSR `LanguageSuggestion` 横幅与 `<head>` 首帧脚本
  （二者把候选横幅写进 SSR HTML、并用 Cookie 记住选择，违反 ML-02/03）。只在客户端水合后空闲时出现；候选取当前页
  `<link rel="alternate" hreflang>`（即本站已发布、且该页确有的版本）；不带地区的 `zh` 给简繁两个候选；文案用目标语言
  （`locale-prompt-copy.ts`，不走 Paraglide：新语言文案按语言拆分，当前页取不到目标语言）；关闭、切换或在语言控件手动选择后
  按站点写入 localStorage，永久不再提示；固定在底部、不占文档流；无障碍按设计稿 D 节（region 地标、role=status 下一帧填入、
  Esc 关闭、键盘关闭后焦点回到 `<main>`）。视觉细节由 Fable 按画板精修。
- **自动验收** `check:i18n-seo`（1.12）：接入 CI build job，见 seo spec「多语言 SEO 验收检查」。
- **ML-09（账号语言首页跳转）**：账号语言字段已存在，但注册时也会写入，无法区分「主动切换」；且 `/` 是静态预渲染页，
  读会话会让每个带 Cookie 的首页请求访问数据库（Neon 成本基线）。记为后续任务 1.13。
- **ML-04 回退页**：现有 `zh-hans` 法律页等「显示原文的回退页」按规范的例外处理（canonical 指原语言、noindex、不进 hreflang 与站点地图），
  新语言不使用回退页（1.5 内容完整性检查）。

新增模板需求：

| 编号 | 模板文件 | 需求 |
|---|---|---|
| TR-9 | `features/i18n/language-controls.tsx`（LanguageSuggestion）、`suggestion.ts`（localeSuggestionScript）、`routes/__root.tsx` | 语言建议改为客户端提示，不输出 SSR 横幅与首帧脚本、不写 Cookie（本项目已停用并以 LocalePrompt 取代） |
| TR-10 | `features/i18n/auth-locale.ts`、`request.server.ts`、`preference.ts`（preferredLocale） | 不按 Accept-Language / 偏好 Cookie 选择公开页与认证页语言 |
| TR-11 | — | 模板加入多语言 SEO 验收检查（本项目 `check-i18n-seo.mjs` 可作参考） |
