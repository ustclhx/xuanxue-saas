# Design

## Context

模板已有 Cloudflare 生产路径（Neon 付费档、`deploy-cloudflare` 技能、`docs/runbooks`）。本 change 主要是运维与内容，代码改动很少。

## Decisions

1. **一个 Worker 绑定两个自定义域名**（`routes` 中各加一条 custom_domain），预渲染构建时注入 `EAST_URL`/`WEST_URL`/`APP_URL`（`APP_URL` = 西方站）。
2. **部署顺序**沿用模板：迁移 → seed（积分包）→ jobs → web → 后台配置模型与详批开关 → 冒烟。
3. **AI 目录提交**：清单放 `docs/runbooks/launch-v1.md`（目录名、URL、提交日期、状态、徽章要求），通过浏览器插件手动或半自动提交，不购买外链（design.md §6）。
4. **上线门槛**：所有 v1 change 的任务已合并；三语 e2e 冒烟通过；Lighthouse 移动端达标；详批抽检通过（monetization 5.1）。

## Risks / Trade-offs

- [域名迟迟未定] → 先用 `*.workers.dev` staging 完成全部验收，域名到位后只需替换变量并重新构建。
- [东方站与西方站的品牌被搜索引擎视为同一实体] → 两站使用不同品牌名，Organization 结构化数据分开。
