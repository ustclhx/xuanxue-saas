# Design

## Context

- 语言集合由 `packages/config/src/template.ts` 的 `DefaultLocale`（`'en' | 'zh-Hant' | 'ko'`）与 `template.config.ts` 的 `i18n.locales` 决定，东方站 `sites.east.locales` 为 `['zh-Hant', 'ko']`。
- 文案使用 Paraglide，`apps/web/project.inlang/settings.json` 列出每种语言的文件路径，当前 `en` 为基准语言，`zh-Hant` 与 `ko` 各 20 个文件。
- 语言偏好 `apps/web/src/features/i18n/preference.ts` 的 `preferredLocale` 先按完整标签匹配，再按主语言匹配，因此 `zh-CN` 目前落到 `zh-Hant`。
- 路由前缀由 `url-prefix.ts` 生成小写形式（`zh-Hant` → `zh-hant`）；`switch-path.ts` 与 `features/tools/registry.ts` 为工具页保存各语言的路径别名（如 `zh-Hant: '/八字排盤/'`）。
- 详批 `features/readings/generate.ts` 在落库前用 `toTraditional` 规范化正文（3 处调用），`unlock-card.tsx` 与 `report-page.tsx` 各在展示时再调用一次；提示词 `prompts/*.ts` 按语言给出 `en` / `zh-Hant` / `ko` 三份，`tarot-spread.v2` 从 `v1` 的繁体提示词派生。
- 2026-10-19 的 `add-dual-site-foundation` 有意移除简体（见 proposal）。本设计以该决定被反转为前提。

## Goals / Non-Goals

**Goals**
- 东方站增加 `zh-Hans`，访客的界面、邮件、详批报告均为简体。
- `zh-Hant` 与 `zh-Hans` 的路由、偏好、SEO 互不干扰；繁体行为与变更前一致。
- 翻译和提示词的语言质量可抽检，服务端不再把简体经过繁体转换。

**Non-Goals**
- 不新增第三个站点或域名。
- 不做博客、法律页、塔罗牌义、工具内容集合的全量简体版本；法律页在 `zh-Hans` 下显示英文原文并附简体提示、`noindex`。
- 不改变西方站、支付、积分与数据库结构。

## Decisions

1. **语言标识与前缀**：使用 BCP 47 标签 `zh-Hans`，URL 前缀 `zh-hans`，与现有 `zh-hant` 规则一致；`/zh/` 继续返回 404。
2. **站点归属**：`zh-Hans` 加入东方站 `locales`，与 `zh-Hant`、`ko` 同站，`defaultLocale` 仍为 `null`。
3. **偏好匹配**：在 `preferredLocale` 中先处理简体地区标签（`zh-CN`、`zh-SG`）→ `zh-Hans`，其余 `zh-*` 与裸 `zh` → `zh-Hant`。这样避免修改通用的主语言回退逻辑。
4. **文案**：新建 `messages/zh-Hans/*.json`，由繁体文件转换生成初稿；Paraglide 的 `baseLocale` 不变（仍为 `en`）。缺失键按现有回退规则落到英语，构建日志列出缺失项，以便抽检。
5. **详批语言**：
   - 提示词增加 `zh-Hans` 版本，系统提示词明确使用简体输出。
   - 落库前的规范化按语言分支：`zh-Hant` 继续调用 `toTraditional`，`zh-Hans` 不调用；展示处（`unlock-card.tsx`、`report-page.tsx`）同样按语言分支。
   - 提示词版本号的处理见开放问题 2。
6. **SEO**：`seo` 的多语言关联把东方站 `zh-Hant`、`zh-Hans`、`ko` 互相声明；`zh-Hans` 下没有简体版本的法律页声明 `noindex` 且不进入站点地图。
7. **占位**：「即将开放」的文案以 `readings_coming_soon` 形式加入 `zh-Hans` 文件，与其他语言相同的键。

## Risks / Trade-offs

- **译文质量**：从繁体机械转换会有术语与语气问题。缓解：运营方抽检，关键页（首页、定价、工具入口、结果页、详批占位）先行。
- **重复内容**：简体与繁体页面相似。缓解：hreflang 互指、canonical 指向本语言，回退页 `noindex`。
- **工具页路径**：工具路由文件名为繁体，简体别名需要在 `registry` 与 `switch-path` 中登记，遗漏会 404。缓解：`switch-path` 与路由的测试覆盖每个工具的简体路径。
- **已落库报告**：历史繁体报告不变，简体访客只生成新报告。

## Resolved Questions

1. **反转 2026-10-19 的决定**：已由用户确认。
2. **提示词升版**：已由用户确认。详批中文提示词新建 `v3`（`bazi-full.v3`、`ziwei-full.v3`、`tarot-spread` 的 `zh-Hans` 版本），不改动已有 `v1` / `v2` 文件。
3. **工具页简体路径**：已由用户确认，路径译为简体（如 `/zh-hans/八字排盘/`）。

## Implementation Findings

- 简体文案（网站界面、邮件）由 OpenCC `t2s` 从繁体生成初稿，需运营方抽检。`toTraditional` 对 `zh-Hans` 原样返回，因此报告落库与展示不会经过繁体转换。
- 工具页（八字、紫微、命盘、塔罗、生命灵数）有大量 `'zh-Hant'` 硬编码（路由文件名为繁体、排盘标签、城市列表、牌义数据），`zh-Hans` 的工具页与东方站首页尚未完成；在完成前不能把 `zh-Hans` 对外上线。
- 法律页没有繁体版本，现有行为为英文原文 + 本语言提示，`zh-Hans` 与之对齐。
- 价格估算 `readings/price.ts` 只有 `zh-Hant`（TWD）；`zh-Hans` 的本地货币与汇率需要确认。
