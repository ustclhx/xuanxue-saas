# Proposal

## Why

使用者 2026-11-19 定的顺序是：SEO 修复完成后，两站扩展到欧洲主流语言与日语（「两个站都丰富多语言，覆盖欧洲主流语言和日语」）。
扩语言的前提是不能重犯刚修完的问题：ganjiday 曾有 193 页「已抓取-尚未编入索引」，原因是各语言只是字形转换或逐句直译。
因此本 change 先补齐让新语言「能上线、能被收录」的基础设施与可量化的本地化门槛，再按市场优先级分期上线语言，
每一期只放内容足够厚、通过门槛的核心页面。

## What Changes

- **语言与站点归属**（design 决策 1）：日语 `ja` 归东方站（四柱推命、紫微斗数、塔罗；品牌「干支日」在日语中天然成立）；
  欧洲语言只归西方站（数字命理与塔罗）。第一期上线 `ja`（东方站）与 `es`（西方站）；第二期 `pt-BR`、`fr`；第三期 `de`、`it`。第二期开工前用 Keyword Planner/Ahrefs 导出复核顺序（公开数据有限，见 research.md）。
  `nl`、`pl`、`pt-PT` 本 change 不做。欧洲语言不进东方站：八字/BaZi 在这些语言中几乎没有独立搜索需求。
- **URL**：沿用小写语言前缀（`/ja`、`/es`、`/pt-br`）。日语路径段用日文关键词（`/ja/四柱推命`、`/ja/タロット/カード/the-sun`），
  与 `/ko/만세력` 一致；欧洲语言路径段用去掉变音符的本地关键词（`/es/numerologia/...`）。牌义页沿用英文牌 slug。
- **分期发布开关**：新增项目自有的「语言发布状态」。未发布语言只在预览/staging 主机可见，在正式域名上返回 404，
  不进站点地图、hreflang、语言菜单与 `llms.txt`。基础设施与部分内容可以先合入 main，不暴露薄页。
- **同站回退防护**：新语言的公开页面文案缺键时构建失败（不再回退成英文混排）；东方站 `ja` 页面不得以英文内容回退显示。
- **本地化质量门槛**（新能力 `localized-content-quality`）：把 SEO 修复第 5 步的相似度测量移植为仓库脚本，
  对新语言执行跨语言直译分、回译相似度、FAQ 选题本地化、示例差异、同语言跨页模板重复与术语表检查；
  未达标的页面不能随语言发布。术语表按语言维护并由检查脚本强制。
- **工具与页面范围**：第一期每种语言只放首页、主工具页、塔罗抽牌与 78 张牌义、（西方站）数字命理工具与 12 个数字页、
  定价、FAQ、法律页、认证与应用区界面；博客、每日运势、八字概念页、相性等长尾延后。
- **结算币种**：`ja` 用 JPY，`es` 暂用 USD（拉美为主），`pt-BR` 用 BRL、`fr`/`de`/`it` 用 EUR（Stripe），PayPal 保持 USD。
  固定汇率价目表扩展；Stripe live 价格创建需使用者批准。
- **AI 详批**：为 `ja` 新增四柱推命、紫微斗数、塔罗的日语提示词变体（日本术语：命式、通変星、蔵干、十二運星、天中殺），
  为 `es` 新增数字命理与塔罗变体；每个新组合在 `evals/readings` 补 ≥8 个样本并过既有门槛。未通过评测的组合在该语言隐藏解锁入口。
- **邮件、法律页与合规表述**：邮件模板与法律页按语言提供（译文 + 跨模型审阅）；合规表述（依据传统方法、仅供参考、不预测未来、
  不使用「娱乐」定位）按语言写进术语表。
- **性能预算**：新首页纳入首页包检查与 head 快照；首页包预算不上调为默认（先做 Paraglide 按语言拆分的评估）；
  落地页 HTML 维持约 105KB 以内；日语页不内联日文网页字体的全部分片声明。

## Capabilities

### New Capabilities
- `localized-content-quality`：新语言上线前的本地化质量门槛：相似度与模板重复的量化阈值、术语表、FAQ 与示例本地化、跨模型审阅与自动门槛，
  以及语言的分期发布状态与「只有通过门槛的页面随语言发布」。

### Modified Capabilities
- `i18n`：新增扩展语言集合与分期规则；新语言公开页面文案缺失时构建失败。
- `multi-site`：「语言归属站点」加入 `ja`（东方站）与欧洲语言（西方站）；「东方站入口页」加入日语浏览器的跳转。
- `seo`：「站点地图与抓取规则」改为按已发布语言列出子站点地图；新增「未发布语言不可被发现」。
- `numerology-pages`：新增西方站各语言的本地化数字命理页面（路径、术语与非 ASCII 姓名字母）。
- `eastern-tool-pages`：新增日语四柱推命与紫微斗数工具页。
- `tarot-pages`：新增各语言牌义页的本地化要求（牌名、花色与正逆位术语按语言惯例）。
- `paid-readings`：「报告内容约束」扩展到新语言，未通过评测的语言组合不显示解锁入口。
- `checkout-currency`：新增新语言的结算币种规则（该能力来自尚未归档的 `localize-checkout-currency`，这里只新增需求）。
- `marketing-site`：「法律页」增加按语言提供的要求与译文声明。

## Impact

- 代码（apps/web）：`template.config.ts`（`i18n.locales`、`sites`、`seo.linking.sites`）、`features/i18n/*`、`features/site/*`（发布状态、语言名）、
  `features/tools/registry.ts` 与 tarot/numerology/bazi 路由表、`features/seo/*`（pages.project.ts、hreflang 过滤）、`features/daily/rules`（第一期不加）、
  `features/readings/catalog.ts` 与 `prompts/*`、`messages/<locale>/*`、`content/{tarot,numerology,legal}/<locale>`、`styles/brand.css`（字体）、
  `scripts/check-home-bundle.mjs`、`home-head-snapshot.json`、`scripts/i18n-project.ts`、`content-collections.ts`；
  散落的硬编码语言联合类型（约 20 个文件）。
- packages：`config`（`DefaultLocale` 等类型）、`email`（`EMAIL_LOCALES` 与文案）、`tarot`（`data/<locale>.ts` 牌名与牌义数据）、
  `numerology`（ß、ł、æ、ø、œ 等不能经 NFD 拆分的字母）、`billing`（币种表与价目表：JPY、EUR、BRL）。
- evals：`evals/readings` 样本、套件版本与门槛按新组合扩展。
- 新脚本：`apps/web/scripts/measure-locale-similarity.mjs`、`check-locale-glossary.mjs`（只用仓库已有依赖 happy-dom）。
- 外部（需使用者批准）：Stripe live 创建 JPY/EUR/BRL 价格；评测真实调用的美元预算；EU VAT（OSS）与日本消费税的登记由运营决定。
- 不变：两站互不链接；canonical、hreflang 只在站内；现有语言的 URL、TDK 与内容不改；Search Console 站点地图重提等全部完成后一次性做。
