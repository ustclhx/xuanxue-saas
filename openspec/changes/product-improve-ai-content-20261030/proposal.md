# Proposal

## Why

2026-10-30 的双站实机复测（`docs/ux-review/2026-10-30/`，仓库外保存）显示：付款与公开定价已经打通，但「承诺与交付」仍然对不上。
- **干支日中文 AI 主路径断在「即将开放」。** 定价页在卖 AI 完整详批，结果页却显示「即将开放」，App 的 Readings 空态又写「可在免费结果下解锁」，Chat 显示 No models available。
- **免费层规则引擎处处自称「AI 辅助」。** 这既稀释了付费理由，也不准确。
- **双站互相串扰，站点卫生问题多。** 例如：
  - 登录后 Arcanumber 顶栏出现中文链接，点击跳到干支日；
  - 隐私页点名八字、紫微；
  - 简体定价 meta 是英文；
  - 404 页标题是 `xuanxue`；
  - Billing 页出现已停用的「幽灵价格」；
  - 电子报区块一直显示「载入中」。

竞品（FateMaster / OpenFate）免登录就能走到免费 AI 或完整盘，我方中文漏斗却在交付前就断了，这是当前最大的转化缺口。

## What Changes

**交付对齐（P0）**
- 详批可用性按站点与语言核对，生产后台补齐开关、模型与积分（衔接 `launch-v1-production` 2.2；D1 已定：六种全开）。
- App 的 Readings 空态跟随详批的实际可用性显示：当前站点没有任何可解锁的详批时，不承诺「可解锁」。
- Chat：
  - 免费套餐开放 `deepseek-flash`，按积分计费；
  - 当前空间没有可用模型时，隐藏 Chat 导航与入口，不露出空对话；
  - 空态文案改为多语言。
- Billing 只显示可购买的价格。已停用的价格不再渲染，只在关联现有订阅时，以订阅信息的形式出现。
- 「链接已寄到你的信箱」只在报告邮件确实交给真实发信通道后才显示（D3 已定：接通 Resend，密钥由用户配置）。
- 电子报表单由服务端直接输出，不再一直停在 Loading。

**免费层文案与真实能力对齐（信任）**
- **BREAKING（合规表述）**：免费工具与结果改用「依传统规则计算、仅供娱乐、不预测未来」；「AI 辅助」只出现在 AI 详批的解锁卡、报告、定价页与 Chat 上。同步修订 `openspec/config.yaml` 的合规上下文。
- 定价页的「可解锁」清单由详批目录生成：只列当前站点可解锁的详批，塔罗、宫合都不遗漏。

**结果页内容漏斗（转化）**
- 每个可解锁的结果下方显示详批章节大纲、一段脱敏样例段落，以及积分价格和解锁按钮。
- 没有对应详批的工具（姓名灵数、表达数、灵魂数、生命灵数配对、是非塔罗、每日一张）显示「去可解锁工具」的引导。
- 牌义页、Life Path 含义页、八字概念页末尾，加「用本站工具算你的」与「解锁结合你命盘的 AI 详批」入口。
- 从结果页进入 Chat 时，携带当前命盘或牌阵作为上下文，并显示模型与预计积分消耗。

**双站分开经营（D5 已定）与 SEO 卫生**
- **BREAKING**：取消语言前缀的跨站 301。西方站访问 `/zh-hant`、`/zh-hans`、`/ko` 返回 404；东方站的 `/en` 不再跳转西方站，而是做成一个独立的英文入口页（干支日风格），介绍本站体系并链接到现有的中文、韩文工具。其他 `/en/*` 路径返回 404。
- 语言控件只列本站语言；hreflang 只在本站内声明，x-default 指向本站入口页。
- 应用区的页头工具导航按当前站点生成，不生成跨站链接。
- 法律页按站点区分正文，两站共用一段「运营主体与共享账户」说明（D4 已定）。
- 根布局与 404 页标题使用当前站点品牌。
- 补齐简体中文的静态页 title 与 meta，不得回退到英文。
- 简体概念页：
  - 去掉泄漏的内部 id；
  - 页内链接指向同一语种；
  - 繁体 slug 301 到对应的简体 slug。
- robots 显式允许主流 AI 爬虫，并新增 `llms.txt`（D10 已定）。
- 博客没有已发布文章时，导航隐藏博客入口；新增 `/faq` 汇总页，带 FAQPage 结构化数据，并收录进站点地图。

**体验瑕疵**
- 报告标题与正文使用同一语言。
- Personal Year 与 Life Path 的计算口径统一为分别归约后相加（D9 已定）。

**不在本 change（后续单独立 change）**
- 博客内容流水线与首批产品证明型文章（D6）；
- 程序化 SEO 页面（D7）；
- 免费层 LLM「半生成」简读与配套的预算、限流（D8）；
- 全漏斗埋点看板；
- 西方站英文八字（计算器与英文 bazi-full 详批，单独立 change）；
- 两站逐步扩充语言，各自保持站点风格（东方站完整英文工具等）；
- 两站的专属功能通过博客文章互相外链。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `paid-readings`：
  - 结果页漏斗：大纲、样例段落、价格；
  - 无详批工具的引导入口；
  - App 空态跟随可用性；
  - 邮件提示的真实性；
  - 报告标题语言；
  - 定价页的可解锁清单。
- `tool-pages`：合规声明按场景拆分：免费工具不写 AI，AI 表述只用于 AI 产物。
- `ai-chat`：没有可用模型时隐藏入口，空态多语言；可从结果页带入命盘上下文；显示预计积分。
- `payments`：账单页只展示可购买的价格。
- `newsletter`：订阅表单首屏可用，不依赖客户端加载完成。
- `multi-site`：语言归属改为各站独立、不跨站跳转（未提供的语言前缀返回 404）；东方站英文入口页；语言控件只列本站语言；应用区导航按站点生成；法律页按站点区分。
- `seo`：
  - hreflang 只在本站内声明；
  - 站点品牌标题，包括 404 页；
  - 静态页 meta 覆盖全部语言；
  - robots 对 AI 爬虫的姿态与 `llms.txt`；
  - `/faq` 的结构化数据与站点地图收录。
- `marketing-site`：博客为空时隐藏入口；新增 FAQ 汇总页；内容词典页接入工具与详批入口。
- `eastern-tool-pages`：简体概念页的语种一致、繁体 slug 别名、不泄漏内部标识。
- `numerology`：Personal Year 改为与 Life Path 相同的分别归约口径。

## Impact

- **代码**（`apps/web`）：
  - `features/readings/*`：unlock-card、report-page、catalog、readings.functions；
  - `features/ai/*`：model-picker、chat-page；
  - `features/app-shell/space-frame.tsx`、`routes/app/$slug/*`；
  - `features/billing/customer-data.ts`、`routes/app/$slug/billing.tsx`；
  - `features/growth/forms.tsx`；
  - `features/marketing/site-header.tsx`、`legal-page.tsx`；
  - `features/seo/*`：metadata、crawlers、pages；
  - `routes/__root.tsx`；
  - `features/tools/*`、`content/concepts/zh-Hans/*`、`content/legal/*`；
  - `messages/*/*.json`。
- **包**：`packages/numerology`（D9）；`packages/entitlements` 只读，套餐模型名单通过后台配置。
- **运维与配置**：
  - 生产后台的详批开关、模型与积分（D1：全开）；
  - 免费套餐的模型名单（D2）；
  - Resend 密钥与发信域名（D3：接通，用户配置密钥）。

  这些都由用户批准后执行，不在 PR 中预先勾选。
- **规格依赖**：建议先归档 `add-zh-hans-locale`，因为它向 paid-readings、multi-site、seo 增加了简体相关的要求，本 change 的增量在其之上编写。
- **测试**：
  - 文案相关测试：`e2e/tarot-meanings.spec.ts` 断言了「AI 辅助」文案；
  - 新增单测：价格过滤、标题品牌、meta 语言覆盖、slug 别名、Chat 入口可见性。
- **数据库**：无 schema 变更。
