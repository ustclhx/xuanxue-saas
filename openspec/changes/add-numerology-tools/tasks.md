# Tasks

## 1. 引擎

- [ ] 1.1 创建 `packages/numerology`，更新 check-deps 规则；实现归约（大师数保留）、生命灵数（含步骤）、生日数、个人年；验证：单元测试覆盖 spec 大师数与跨年场景
- [ ] 1.2 实现姓名规范化（NFD 去重音、非拉丁报错）、表达/灵魂/人格数（Y 规则）与相性矩阵；验证：单元测试覆盖 spec 姓名与相性场景，`pnpm check:deps` 通过

## 2. 页面

- [ ] 2.1 西方站 `/` 改为 Life Path Number 计算器首页（design 决策 3 的结构，原营销首页板块迁往 `/pricing` 与页脚），接入分享链接、合规声明与埋点；验证：e2e 输入 1987-11-29 显示 11 与步骤，禁用 JS 请求含 H1 与表单标签
- [ ] 2.2 `/numerology-calculator/`、`/numerology-chart/`（数字分布图）、`/name-numerology/`、`/life-path-compatibility/`；验证：e2e 覆盖不填姓名与相性场景
- [ ] 2.3 12 个数字页 MDX 内容 + `/soul-urge-number/`、`/destiny-number/` 枢纽页，FAQPage JSON-LD 与互链矩阵，全部注册到 `TOOL_ROUTES`；验证：SEO 单测断言 14 页唯一 Title/canonical/FAQ，`pnpm build` 后站点地图包含全部页面
