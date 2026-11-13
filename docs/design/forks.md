# 模板文件定制登记

记录衍生项目对模板文件的定制，template-sync 遇到冲突时据此合并（流程见 `ui-design` 与 `template-sync` 技能）。

## 复制到 `packages/ui/src/project/` 的模板组件

暂无。

## 模板文件中的项目挂载点

| 模板文件 | 改动 | 项目文件 | 来源 change | 合并要点 |
|---|---|---|---|---|
| `apps/web/src/routes/app/$slug/index.tsx` | 路由选项加 `validateSearch`、`loaderDeps`、`loader`（今日面板数据），页面顶部插入 `<TodayPanel />`；共 1 个 import 与 5 行 | `apps/web/src/features/daily/mount.tsx`、`today-panel.tsx`、`today.functions.ts` | add-birth-profiles-daily-horoscope（design D10） | 采纳模板改动后重新插入这几行；`?profile=` 查询参数只由面板使用 |
