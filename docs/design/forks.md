# 模板文件定制登记

记录衍生项目对模板文件的定制，template-sync 遇到冲突时据此合并（流程见 `ui-design` 与 `template-sync` 技能）。

## 复制到 `packages/ui/src/project/` 的模板组件

暂无。

## 模板文件中的项目挂载点

| 模板文件 | 改动 | 项目文件 | 来源 change | 合并要点 |
|---|---|---|---|---|
| `apps/web/src/routes/app/$slug/index.tsx` | 路由选项加 `validateSearch`、`loaderDeps`、`loader`（今日面板数据），页面顶部插入 `<TodayPanel />`；共 1 个 import 与 5 行 | `apps/web/src/features/daily/mount.tsx`、`today-panel.tsx`、`today.functions.ts` | add-birth-profiles-daily-horoscope（design D10） | 采纳模板改动后重新插入这几行；`?profile=` 查询参数只由面板使用 |
| `packages/config/src/template.ts` | `emailSender` 的发件人显示名改为收件人语言下的品牌名（`siteBrandName(config, site, locale)`；语言不属于该站点时用站点品牌名）；约 4 行 | `template.config.ts` 的 `sites.east.brand.names`；`apps/jobs/src/queues/email.ts` 的发件人缓存改按完整 `from` 取键 | separate-landing-homepage（design D3a：韩语站名「간지데이」、中文「干支日」） | 采纳模板改动后保留按语言取显示名；模板若自行支持按语言的发件人名则改用模板实现 |
| `apps/web/src/features/ai/subject-chat.tsx` | 临时上下文对话页的「返回结果」链接改为 `legacyToolPath(page.returnTo)`；1 个 import 与 1 行 | `apps/web/src/features/tools/tool-href.ts` 的 `legacyToolPath` | separate-landing-homepage（design D4「已存的返回地址」） | 采纳模板改动后保留这一处映射：迁移前签发的 `returnTo` 可能是语言首页，须落到主工具页 |
