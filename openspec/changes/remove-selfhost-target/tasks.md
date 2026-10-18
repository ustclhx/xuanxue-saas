# Tasks

## 1. 交付层删除（协调者）

- [x] 1.1 删除 `docs/runbooks/evidence`、`deploy/selfhost`、`.github/workflows/selfhost-*.yml`、selfhost/node 相关 runbook、`scripts/selfhost-*`、`infra/postgres`、`apps/web/e2e/selfhost` 与 `playwright.selfhost.config.ts`、`deploy-selfhost` 技能，修复断开的引用；验证：`pnpm check`、`pnpm typecheck`、`pnpm test` 通过，`git grep -i selfhost` 只剩 Node 运行时代码与待改文档

## 2. Node 运行时删除（Claude worker）

- [x] 2.1 删除 web/jobs 的 Node 入口、构建脚本、vitest node 配置与 Node 专用测试，packages 中只服务 Node 的适配器及其依赖，CI `node` job；验证：`pnpm install` 后 `pnpm check`、`pnpm typecheck`、`pnpm check:deps`、`pnpm check:singletons`、`pnpm test`、`pnpm build` 与 `wrangler deploy --dry-run`（web、jobs）通过
- [x] 2.2 删除模板生成器与 quick-start 技能，`.agents/skills` 与 `.claude/skills` 保持逐字节一致；验证：`cmp` 两处技能目录，`pnpm check` 通过

## 3. 文档

- [x] 3.1 README、AGENTS.md、docs/01、02、07、08、platform-* 改为只描述 Cloudflare 目标，删除 node-jobs-extension 等仅 Node 文档；验证：`git grep -iE "selfhost|自托管|build:node|create-project"` 在 docs/README/AGENTS 中无结果（openspec 归档除外）
