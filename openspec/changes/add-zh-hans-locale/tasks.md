# Tasks

## 0. 决策确认（开始实施前）

- [x] 0.1 运营方确认反转 2026-10-19 移除简体的决定（design 开放问题 1）
- [x] 0.2 确认详批提示词是否升版（design 开放问题 2）
- [x] 0.3 确认工具页简体路径：译为简体或沿用繁体（design 开放问题 3）

## 1. 语言与站点配置

- [x] 1.1 `DefaultLocale` 与 `template.config.ts` 的 `i18n.locales` 加入 `zh-Hans`
- [x] 1.2 东方站 `sites.east.locales` 加入 `zh-Hans`，品牌名称补 `zh-Hans: '干支日'`
- [x] 1.3 `project.inlang/settings.json` 增加 `zh-Hans` 文件路径，`locales` 加入 `zh-Hans`
- [x] 1.4 `packages/config` 与 `template.test.ts` 的默认值与断言更新

## 2. 文案

- [x] 2.1 由 `messages/zh-Hant/*.json`（20 个文件）生成 `messages/zh-Hans/*.json` 初稿，保持键名一致
- [x] 2.2 新增 `readings_coming_soon` 的简体文案
- [x] 2.3 构建日志列出 `zh-Hans` 缺失键，确认缺失项全部回退到英语且不显示键名
- [x] 2.4 运营方抽检首页、定价、工具入口、结果页与详批占位，修正术语

## 3. 路由与偏好

- [x] 3.1 `url-prefix.ts` 与 `routing.ts` 支持 `zh-hans` 前缀，`/zh/` 仍 404
- [x] 3.2 `preferredLocale`：`zh-CN`、`zh-SG` → `zh-Hans`；`zh-TW`、`zh-HK`、`zh-MO` 与裸 `zh` → `zh-Hant`
- [x] 3.3 语言切换器显示「简体中文」，`theme.ts` 与 `east-entry.tsx` 增加对应项
- [x] 3.4 工具页简体路径按 0.3 的结论登记到 `tools/registry.ts` 与 `switch-path.ts`

## 4. 详批

- [x] 4.1 `prompts/` 增加 `zh-Hans` 提示词，系统提示词要求简体输出（版本号按 0.2）
- [x] 4.2 `generate.ts` 落库规范化按语言分支，`zh-Hans` 不调用 `toTraditional`
- [x] 4.3 `unlock-card.tsx` 与 `report-page.tsx` 展示处按语言分支
- [x] 4.4 `hant.test.ts` 增加简体不被转换的断言

## 5. SEO

- [x] 5.1 东方站 hreflang 互指 `zh-Hant`、`zh-Hans`、`ko`，`x-default` 规则不变
- [x] 5.2 站点地图增加 `zh-hans` 子站点地图
- [x] 5.3 `zh-Hans` 下没有简体版本的法律页显示英文原文并附简体提示，声明 `noindex` 且不进入站点地图

## 6. 测试与验收

- [x] 6.1 更新 `site.test.ts`、`routing.test.ts`、`switch-path.test.ts`、`request.test.ts`、`seo.test.tsx` 与 `packages/email` 快照
- [x] 6.2 新增用例：`/zh-hans/` 路由、`zh-CN` 偏好、简体详批不经繁体转换、简体占位文案（偏好、转换、合规、路径已有用例；路由与占位文案尚无单独用例）
- [x] 6.3 `pnpm typecheck`、`pnpm check`、`pnpm test` 通过
- [ ] 6.4 staging 手动验收：简体浏览器首访东方站、切换语言、工具页、一次简体详批生成（不在 PR 中勾选生产验收）

## 7. 实施中发现的新增范围（待确认）

- [x] 7.1 工具页简体化：`registry.ts` 与 `tools/*`（八字、紫微、命盘、塔罗、生命灵数）的 `zh-Hans` 路径、标签与数据；路由文件名为繁体，需要简体路径别名（已确认路径译为简体）
- [x] 7.2 东方站首页 `zh-Hans` 分支（当前 `zh-Hans` 首页不会显示八字工具）
- [x] 7.3 详批 `zh-Hans` 变体：`bazi-full.v3`、`ziwei-full.v3`、`tarot-spread` 的简体版本，健康章节与免责声明的简体文案，以及 `compliance.ts` 的简体规则
- [x] 7.4 `readings/optin-email` 与 `optin-schema` 的 `zh-Hans` 文案与枚举
- [ ] 7.5 `price.ts` 的 `zh-Hans` 本地货币：已加 CNY，参考汇率 7.2 待运营确认
- [x] 7.6 `content-collections`、`tarot` 包（`CARD_MEANINGS`）、`marketing` 与 `site` 测试中的 `zh-Hans` 覆盖

