# Tasks

执行者标记：**[Codex]** 简单/机械改动；**[Opus]** 复杂开发、SEO 与内容写作、审阅；**[Fable]** 只做视觉与排版。
每组可在独立 worktree 并行；组内按编号顺序。共享文件按 docs/09-parallel-plan.md §3 处理：`messages/<locale>/<feature>.json` 按功能拆分，
`template.config.ts`、`tools/registry.ts` 与 `rollout.ts` 只由第 1 组改动，其他组在它合并后 rebase。
开工前需要使用者对 design.md「待使用者决定」D-1 至 D-14 给出答复。

## 0. 基线（Opus，第 1 组开始前）

- [ ] 0.1 在 origin/main 生产构建上保存基线：两站 seo-snapshot（canonical/hreflang/sitemap/robots）、`check:links` 与 `audit:seo` 报告、四个首页的 HTML 原始与 gzip 大小、首页包 gzip、Lighthouse 移动端（两站首页与主工具页）、全量构建与预渲染耗时、Worker 上传体积；写入 `EVIDENCE_DIR`

## 1. 语言基础设施（第 0 期，Opus；可合入 main，正式站无可见变化）

- [ ] 1.1 新增 `features/i18n/rollout.ts`（发布状态与 `isLocaleLive(locale, host)`）及单元测试；现有四种语言为 released
- [ ] 1.2 在站点守卫、站点地图、`alternateLinks()`、语言菜单与建议、`llms.txt`、东方站根路径跳转、认证页语言进入处接入发布状态；未发布前缀在正式主机返回 404、不做跨站 301
- [ ] 1.3 集中硬编码语言：`packages/config` 的 `DefaultLocale`、`packages/tarot` 的 `Locale`、`readings/catalog.ts`、`daily/rules/types.ts`、bazi 组件、`tarot/routes.ts`、content-collections 的 `z.enum` 等改为从配置推导或显式按语言登记；类型检查在漏登记时报错
- [ ] 1.4 `scripts/i18n-project.ts` 增加严格语言：公开、认证、账户、计费、邮件相关功能文件缺键时构建失败（后台功能文件允许回退）；补测试；整理成模板需求
- [ ] 1.5 内容完整性检查：新语言第一期页面集合（tarot 78、numerology、legal）缺条目时构建失败；`ja` 页面正文文字检测（含假名、拉丁比例阈值）
- [ ] 1.6 首页包测量：模拟加 2 种语言的文案，测每个首页闭包 gzip 增量；评估并实现 Paraglide 按语言拆分（或减少首页文案）；`HOME_PAGES` 与 head 快照改为由站点语言生成；预算不上调（D-9）
- [ ] 1.7 浏览器语言匹配：`ja-*` → `ja`、`es-*` → `es`、`pt`/`pt-BR` → `pt-BR`（`pt-PT` 不匹配）；`resolveEmailLocale` 同步；测试覆盖
- [ ] 1.8 `LOCALE_AUTONYMS` 补日本語、Español、Português (Brasil)、Français、Deutsch、Italiano
- [ ] 1.9 [Codex] 姓名数字的特殊字母映射（ß→SS、ł→L、æ→AE、ø→O、œ→OE）与本语言错误提示键；`packages/numerology` 单元测试
- [ ] 1.10 验收：既有页面 seo-snapshot 与 0.1 逐字节一致；`pnpm check`、`typecheck`、`test`、`build`、两站 `check:links`、`audit:seo` 通过

## 2. 本地化质量工具（Opus，可与第 1 组并行）

- [ ] 2.1 移植 part-b 测量为 `apps/web/scripts/measure-locale-similarity.mjs`（happy-dom 解析；按站点地图与 hreflang 配对；结构直译分、数字序列重合、同语言按位置段落 Dice、同文字变体 Dice/整句复现、FAQ `origin` 统计、长度下限）；输出 JSON/Markdown 到 `EVIDENCE_DIR`；单元测试用小样例
- [ ] 2.2 回译相似度：固定模型与温度 0 回译、词二元组 Dice；用每语言 3 页机器直译对照组校准阈值，写入报告；成本记录（真实调用需使用者批准预算）
- [ ] 2.3 术语表格式 `apps/web/i18n/glossary/<locale>.json` 与 `check-locale-glossary.mjs`（禁用写法、合规表述、「娱乐」定位禁用词），接入 `pnpm check`
- [ ] 2.4 `ja`、`es` 术语表初稿（塔罗牌名/花色/正逆位、数字命理术语、四柱推命与紫微术语、合规表述、每个目标页的 ≤2 种锚文本）；Opus 起草，另一模型交叉审阅定稿
- [ ] 2.5 写作事实单模板与生成脚本（引擎事实、关键词、本地问题来源、术语、锚文本），不含源语言正文

## 3. 视觉（Fable）

- [ ] 3.1 东方站字体规则：TC 规则只在 `:lang(zh-Hant)` 生效；`ja` 标题用系统日文字体与度量匹配回退；`ko`/`zh-Hans` 页不再内联 TC 分片；截图对比（手机/桌面、浅/深色）与 HTML 大小前后对比
- [ ] 3.2 西方站出现语言菜单后的页头检查（手机宽度不换行、无 CLS）；菜单项 class 精简
- [ ] 3.3 `ja` 与 `es` 落地页、主工具页、牌义页在 staging 的视觉检查（日文换行与禁则、长西语单词断行、按钮文字溢出），只做样式修正
- [ ] 3.4（若 D-11 选是，第二期前）语言菜单改造：经 ui-design 取得使用者确认的设计稿后实现

## 4. 日语（东方站，第一期）

- [ ] 4.1 [Opus] `template.config.ts`：`i18n.locales`、`sites.east.locales` 末尾追加 `ja`，`brand.names.ja = '干支日'`，`seo.linking.sites` 东方站组加 `ja`；`rollout.ts` 设为 pending
- [ ] 4.2 [Opus] 注册表与路由：`/ja/四柱推命`、`/ja/紫微斗数`、塔罗四页、`/ja/タロット/カード` 与 78 张牌义；`pages.project.ts` 的 STATIC_MAIN、主词与 parent；`switchLocalePath` 测试
- [ ] 4.3 [Opus] 四柱推命呈现：命式、通変星、蔵干、十二運星、天中殺等日语标签；日本标准时间与 1948–1951 夏令时（引擎复算测试）；默认出生地为东京；概念页链接在 `ja` 不渲染
- [ ] 4.4 [Codex] `messages/ja/*.json` 界面文案（认证、账户、计费、应用区、通用组件），按术语表；缺键检查为 0
- [ ] 4.5 [Opus] 公开页文案与内容：落地页、四柱推命与紫微工具页正文/FAQ、塔罗抽牌页、牌义索引、FAQ 页、定价页（事实单写作，不给中文正文）
- [ ] 4.6 [Opus] 78 张牌义 `content/tarot/ja` + `packages/tarot/src/data/ja.ts`：按花色分 5 批并行，每批跑 2.1–2.3 与 `measure-intra`
- [ ] 4.7 [Opus] 法律页与运营方说明 `content/legal/{east,shared}/ja`（注明以繁中版为准）；`packages/email` 的 `ja` 邮件文案
- [ ] 4.8 [Opus] AI 详批：四柱推命、紫微、塔罗的 `ja` 提示词变体；`evals/readings` 新套件版本，每组合 ≥8 个样本；文字检测与术语检查；离线单测；经批准预算后真实运行并过门槛
- [ ] 4.9 [Codex] 计费：JPY 加入币种表（零小数）、价目表、回调白名单、`formatMoney`、同步脚本；`ja` → JPY；测试。staging 沙盒同步；live 价格创建等使用者批准（D-13）
- [ ] 4.10 [Opus] 门槛验收：measure 报告（结构直译 ≤0.60、回译 ≤校准阈值、FAQ ≤0.40、数字重合 ≤0.50、跨牌 ≤0.30、FAQ local ≥2）、术语检查、跨模型审阅记录（D-6）
- [ ] 4.11 [Opus] staging 验收（`*.workers.dev` 下 `/ja` 全部页面、认证、购买、详批、邮件）；e2e：`dual-site-seo.spec.ts` 等补 `ja` 用例（隔离库）

## 5. 西班牙语（西方站，第一期）

- [ ] 5.1 [Opus] `template.config.ts`：`i18n.locales`、`sites.west.locales` 追加 `es`，`seo.linking.sites` 西方站组加 `es`；`rollout.ts` 设为 pending（与 4.1 同一 PR 或先后 rebase）
- [ ] 5.2 [Opus] 注册表与路由：design 决策 2 的 `es` 路径表（数字命理全部工具与 12 数字页、塔罗四页、牌义索引与 78 张）；主词与 parent；hreflang 测试
- [ ] 5.3 [Codex] `messages/es/*.json` 界面文案（中性拉美西语），按术语表；缺键为 0
- [ ] 5.4 [Opus] 数字命理内容 `content/numerology/es`：Life Path 工具长文、12 个数字页、destiny、soul urge；示例用拉美/西班牙人名与日期并经引擎复算；FAQ 取西语真实问法
- [ ] 5.5 [Opus] 公开页文案：落地页、计算器/姓名/相性/图表工具页、塔罗抽牌页、FAQ 页、定价页
- [ ] 5.6 [Opus] 78 张牌义 `content/tarot/es` + `packages/tarot/src/data/es.ts`：分 5 批并行，每批跑门槛
- [ ] 5.7 [Opus] 法律页 `content/legal/{west,shared}/es`（注明以英文版为准）；`es` 邮件文案
- [ ] 5.8 [Opus] AI 详批：数字命理与塔罗的 `es` 变体；评测样本 ≥8/组合；过门槛
- [ ] 5.9 [Codex] 计费：`es` 维持 USD（D-4），确认定价页与解锁卡的西语金额格式
- [ ] 5.10 [Opus] 门槛验收（同 4.10，源语言为 `en`）
- [ ] 5.11 [Opus] staging 验收与 e2e 补 `es` 用例

## 6. 第一期发布（协调者，需使用者授权）

- [ ] 6.1 生产构建上跑全部验收并存证据：两站 `check:links`（孤岛 0、死链 0）、`audit:seo`（正文内链 2–5、锚文本 ≤2 种、top1 ≤70%、钱页入链 ≥3、两站互不链接）、相似度报告、术语检查、Lighthouse（LCP 不劣于基线 100ms 以上、CLS 不增加）、首页包预算、落地页 HTML ≤ 约 105KB、构建时间与 Worker 体积
- [ ] 6.2 canonical/hreflang/sitemap 与 0.1 基线 diff：既有页面只多出 `ja`/`es` 的 hreflang 行，站点地图只多出新语言子站点地图与其条目，其余逐字节一致
- [ ] 6.3 使用者确认后把 `ja`、`es` 改为 released 并发版；确认 main 部署流水线成功、`/api/health` 版本正确、两站抽样页面 200 与 hreflang 正确
- [ ] 6.4 Stripe live JPY 价格创建（使用者批准后执行）并在生产只读核对
- [ ] 6.5 发布后 4 周 GSC 覆盖率复盘（「已抓取-尚未编入索引」占比），结论决定第二期是否开工；Search Console 站点地图重提留到全部工作完成后交 Grok bot

## 7. 第二、三期（每种语言一组，复用第 4/5 组流程）

- [ ] 7.0 [Opus] 第二期开工前用 Keyword Planner 或 Ahrefs 导出复核 research.md 中各语言主词与顺序，定稿各语言路径段与术语表初稿

- [ ] 7.1 `pt-BR`（BRL，需确认 Stripe 账户支持）：同第 5 组 5.1–5.11
- [ ] 7.2 `fr`（EUR）：同第 5 组
- [ ] 7.3 `de`（EUR，第三期）：同第 5 组
- [ ] 7.4 `it`（EUR，第三期）：同第 5 组
- [ ] 7.5 第二期长尾评估：`ja` 数秘術（D-3）、`ja` 八字概念页与相性、各语言每日页；每项单独起 change 或追加任务前先给使用者看
