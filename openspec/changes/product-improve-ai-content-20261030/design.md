# Design

## Context

动机见 proposal.md 的「Why」。以下是对照 `origin/main`（`5a7d017`，v0.1.10）核对过的现状。路径默认相对于 `apps/web/`。

| 现象 | 根因 | 位置 |
|---|---|---|
| 中文结果页显示「即将开放」 | `readingAvailable` 在开关关闭、未选模型或积分 ≤ 0 时返回 false，前台于是显示 `ComingSoon`。这是 `add-zh-hans-locale` 定义的占位行为。生产后台的配置（`launch-v1-production` 2.2）尚未完成；开关为全站共用，不区分站点 | `features/readings/config.ts`、`readings.functions.ts:183`、`unlock-card.tsx` |
| Readings 空态承诺「可解锁」 | `readings_list_empty` 不判断是否有任何详批可用；导航只看 `billing && textAi` | `report-page.tsx:179`、`app-shell/space-frame.tsx:69` |
| Chat 显示 No models available | 免费套餐的 `features.models` 为空；只要 `ai.text.enabled` 为真，Chat 导航就显示；空态文案写死为英文 | `ai/model-picker.ts`、`routes/app/$slug/route.tsx:100` |
| 显示「已寄信」但实际没有发信 | 流式生成结束就显示 `readings_report_saved`；真正的发信在 `waitUntil` 中异步执行，生产 `EMAIL_TRANSPORT=log` | `unlock-card.tsx:315`、`generate.ts`、`packages/config/src/email-env.ts` |
| 电子报区块一直显示 Loading | `options` 在 `useEffect` 里请求 Turnstile siteKey，服务端渲染时永远是 Loading 状态 | `growth/forms.tsx:16-37` |
| Billing 出现幽灵价格 | 价格查询没有按 `active` 过滤；页面把不可用的价格渲染成禁用项，并带英文后缀 | `billing/customer-data.ts:50`、`routes/app/$slug/billing.tsx:79` |
| 404 页标题为 `xuanxue` | 根布局写死了 title | `routes/__root.tsx:42` |
| 简体定价页 meta 为英文 | `staticCopy` 没有 zh-Hans，回退到 en；`/`、`/blog`、`/newsletter`、`/waitlist` 同样受影响 | `features/seo/metadata.ts:72-116` |
| 隐私页点名八字、紫微 | 只有 `content/legal/en/*.mdx` 一份，不区分站点 | `content/legal/en/privacy.mdx:33` |
| 登录后 Arcanumber 顶栏出现中文链接 | `/app` 的语言来自用户偏好；`toolsForLocale(getLocale())` 按语言而不是按站点生成工具列表 | `marketing/site-header.tsx:28`、`tools/tool-href.ts` |
| 简体概念页的问题 | MDX 正文写死了内部 id 和 `/zh-hant/` 链接；slug 精确匹配，没有繁体别名 | `content/concepts/zh-Hans/*.mdx`、`concepts.functions.ts` |
| Personal Year 与 Life Path 口径不一 | Life Path 先分别归约，再相加；Personal Year 直接相加原值后归约（与当前规格一致） | `packages/numerology/src/numbers.ts:53,79` |
| 免费塔罗不扣题 | 结果只回显问题，解读用的是静态牌义 | `tarot/tarot-page.tsx:365+` |
| 无详批工具没有入口 | 姓名类计算器、生命灵数配对、是非塔罗、每日一张没有对应的 `ReadingKind` | `numerology/*`、`tarot/tarot-page.tsx:237` |

约束：
- 营销页要能预渲染，数据库故障时降级；
- 文案按功能拆分 JSON；
- 同时支持四种语言：zh-Hant、zh-Hans、ko、en；
- 不新增数据库 schema。

## Goals / Non-Goals

**Goals：**
- 先修复「承诺」与「交付」不一致的地方（P0）。这部分各项互相独立，可以并行开 worktree。
- 对外文案（AI、邮件、可解锁）的显示条件，必须来自运行时的真实状态，不能写死。

**Non-Goals：**
- 不新增详批种类，例如给姓名灵数或配对新建 `ReadingKind`；
- 不做免费层的 LLM 生成；
- 不扩充博客或程序化 SEO 内容；
- 不改变积分价格与套餐结构。

## Decisions

### 1. 文案的显示条件来自运行时状态

- **Readings 空态**：读取当前站点和语言下所有详批的报价，至少有一种可用时，才使用「在免费结果下方解锁」的文案；否则改用中性文案，并链接到免费工具。
- **「已寄信」提示**：生成完成时，服务端返回 `emailDelivery: 'queued' | 'none'`。只有在发信通道不是 `log`、且用户有已验证邮箱时才返回 `queued`，前台据此选择文案。
  - 不选「等邮件真正发出后再提示」，因为发信在 `waitUntil` 中异步执行，等待会拖慢完成态。

### 2. Chat 的可见性取决于可用模型数

- `space-frame` 与 Chat 路由复用 `getPickerModels` 的结果（或一次轻量的计数），模型数为 0 时隐藏导航，直接访问 Chat 路由则显示带购买引导的多语言空态。
- 按 D2 的已定方案，把 `deepseek-flash` 加进免费套餐的模型名单，按积分计费。这一步是后台配置（`plan-model-access`），不改代码。
- 不选「把模型写进默认 seed」：首次创建免费套餐时，默认 models 为 `[]` 是现有的规格约束。

### 3. Chat 带入命盘上下文

- 结果页提供「用这个盘问 AI」入口，跳转到 `chat?context=<kind>:<token>`。
- 这个 token 指向服务端复算后的结构化结果，用短期签名存放，不在 URL 里放出生信息明文。
- 新建对话时，把该结构化结果作为系统上下文注入，首条消息之前显示上下文摘要与「预计积分」（按模型单价 × 典型 token 估算）。
- 不选「直接把结果 JSON 放进 URL」：会泄漏出生信息，也违反分享链接的约束。

### 4. 合规声明按场景拆分（已定）

- 免费工具与免费结果统一使用「依传统规则计算、仅供娱乐、不预测未来」；
- AI 详批解锁卡、报告、定价页、Chat 使用「AI 辅助、仅供娱乐、不预测未来」；
- 页面 title 与 H1 仍然不得以 AI 作卖点；
- `content/tarot/*` 正文中的「本篇为 AI 辅助解读」类句子，按实际情况处理：如果内容是 AI 起草、人工审定的，保留这一事实性披露，并改写为「AI 起草、人工审定」；`e2e/tarot-meanings.spec.ts` 随之更新；
- `openspec/config.yaml` 的合规上下文同步改为分场景表述。

### 5. 结果页漏斗由详批目录驱动

- 解锁卡在价格上方展示 `catalog` 中的 `sections`（已有），并新增每种详批每种语言一段样例段落（`catalog` 新字段，人工撰写，不调用模型）。
- 没有对应详批的工具，按站点映射到最近的可解锁工具：
  - 姓名类、配对 → `numerology-calculator`（numerology-full）；
  - 是非、每日一张 → 三张牌（tarot-spread）。
- 定价页的「可解锁」清单遍历当前站点的详批目录，不再手写。
- 读取报价失败时不显示入口（沿用现有的降级规则）。

### 6. 站点感知

两站分开经营（D5）：
- **语言归属**：`features/site/gate.ts` 不再做跨站 301。每个站点维护自己的语言集合：东方站 zh-Hant、zh-Hans、ko，外加 en，但 en 目前只有入口页；西方站只有 en。请求本站未提供的语言前缀，返回本站风格的 404。staging 预览地址的行为不变。
- **东方站 `/en`**：独立的英文入口页，使用东方站主题与字体。内容包括：干支日简介、八字/紫微/四柱/塔罗各一段英文说明，以及指向现有 zh-Hant、zh-Hans、ko 工具的入口。页面可被索引，并新增东方站 `en` 子站点地图，只收录这一页。其他 `/en/*` 路径返回 404。完整的英文工具留待后续扩充语言时再做。
- **语言控件**：只列本站语言。东方站多一项 English，指向 `/en`。
- **hreflang**：只在同一站点内声明；x-default 指向本站入口页。东方站 `/en` 与三种语言的东方站首页互相声明。
- **应用区页头**：工具列表改为 `toolsForSite(siteId, locale)`。语言不属于当前站点时，退回到本站默认语言的工具。
- **法律页**：按站点建目录 `content/legal/<site>/<locale>/`。西方站只描述灵数与塔罗。两站共用一段「运营主体与共享账户」说明，正文按站点分开（D4）。

### 7. SEO 卫生

- **根布局 title**：使用站点品牌（干支日 / Arcanumber）；404 页 title 为「本语言的页面不存在 | 品牌」。
- **`staticCopy`**：改为全语言必填的类型（`Record<Locale, …>`），用编译期报错防止再次回退到 en。
- **robots**：对 GPTBot、ClaudeBot、Google-Extended、OAI-SearchBot、PerplexityBot 等，单独输出 `Allow: /` 并保留私有路径的 Disallow。新增 `/llms.txt`，列出站点简介与核心工具 URL（D10）。
- **简体 slug 别名**：概念页 frontmatter 增加 `aliases`（繁体 slug），路由命中别名时 301 到规范 slug。
- **博客入口**：可见条件改为「当前语言有已发布文章」。构建期就能统计，不查数据库。
- **`/faq`**：每个站点和语言一页，内容从定价页 FAQ 与工具页 FAQ 汇总（重用 `tools/faq.tsx` 的数据源），输出 FAQPage 结构化数据。

### 8. Billing 价格

查询层只返回「`active` 的价格」与「现有订阅关联的价格」；后者只在订阅信息里显示，不作为购买选项。` · unavailable` 后缀改为多语言文案。

## 决策记录（2026-10-30 用户已定）

| # | 决策 | 选项 | 建议 | 影响 |
|---|---|---|---|---|
| D1 | 生产六种详批是否全部对访客开放 | 全开 / 部分暂缓 | **已定：全开** | 运维任务 1.x，即完成 `launch-v1-production` 2.2 |
| D2 | Chat 策略 | **已定**：免费套餐开放 flash，按积分计费；没有模型时隐藏 | — | 任务 2.4 |
| D3 | 是否现在接通 Resend | 接通（需要两站 key 与 SPF/DKIM） / 暂不接通 | **已定：接通**，需要时由用户配置密钥。未接通前，「已寄信」类文案不显示（决策 1 已保证） | 运维任务 1.4 |
| D4 | 法律页的主体表述 | 两站共用「同一运营方」说明 / 两站完全独立 | **已定：共用一份运营方说明，正文按站点分开** | 任务 4.3，文案需用户确认 |
| D5 | 跨站语言策略 | 保留 301 / 两站分开经营 | **已定：两站分开经营**。西方站中文、韩文前缀返回 404；东方站 `/en` 为独立英文入口页（干支日风格）；西方站英文八字另开 change；后续两站各自扩充语言，专属功能通过博客互链 | 任务 4.2、4.8 |
| D9 | Personal Year 的口径 | 与 Life Path 一致（月、日、年分别归约后相加） / 保持现状（直接相加）并在步骤中注明 | **已定：与 Life Path 一致** | 两种口径只在出现大师数时结果不同（例：9 月 9 日、2029 年，分别归约得 22，直接相加得 4）。任务 5.4 |
| D10 | AI 爬虫与 `llms.txt` | 显式允许并提供 `llms.txt` / 维持现状 | **已定：显式允许** | 任务 4.5 |
| D11 | 样例段落由谁撰写 | Claude 起草、用户审定 / 用户提供 | **已定：Claude 起草，用户审定后合并**（四种语言各六种详批） | 任务 3.2 |

已定且不再讨论的：合规表述按场景拆分；免费 LLM 简读另开 change（原 D8）；博客流水线（D6）与程序化 SEO（D7）另开 change。

## Risks / Trade-offs

- **[改写合规表述后，审查口径变化]** → 规格中两类表述同时存在。`readings/compliance.ts` 不检查声明措辞，不受影响。更新 e2e 断言，以防回退。
- **[Chat 对免费套餐开放后，成本上升]** → 按积分计费，余额为 0 时，发送前检查已会拒绝。上线后观察一周的 flash 用量。
- **[Chat 上下文 token 被滥用]** → token 只能由本人使用，短期有效（30 分钟），只包含服务端复算过的结构化结果。
- **[样例段落被当作对个人的预测]** → 样例标明「示例」，来自脱敏的虚构命盘，并经过 `compliance.ts` 校验。
- **[依赖 `add-zh-hans-locale` 尚未归档]** → 先归档该 change，或在本 change 合并前确认两者的增量不冲突。本 change 不修改它新增的「即将开放占位」要求。
- **[取消跨站 301 后外链失效]** → 这些路径从未出现在站点地图中，外链极少。上线后在 GSC 观察两站的 404，必要时对高频路径补充本站的替代页。
- **[东方站 `/en` 只有一页，可能被视为薄内容]** → 页面内容按英文说明文的标准撰写，不少于 600 词，并在后续扩充英文工具时同步完善。
- **[robots 显式允许 AI 爬虫]** → 本站内容公开，免费工具在浏览器中计算，不涉及用户数据；私有路径仍然禁止抓取。

## Migration Plan

1. **运维（不改代码，需用户逐项批准）**：
   - 生产后台打开全部六种详批（D1）；
   - 给免费套餐授权 flash（D2）；
   - 接通 Resend，由用户配置密钥（D3）。
2. **代码分三波合并**（波次 A → B → C，见 tasks.md），每波独立 PR，不涉及数据库迁移。
3. **发版**：每波合并后，由用户批准 `v*` 发版；发版后由 Codex 按体验报告条目只读复核，证据存放在仓库外。
4. **回滚**：
   - 代码按 PR revert；
   - 详批开关与套餐模型名单可以在后台即时关闭，60 秒内生效。
