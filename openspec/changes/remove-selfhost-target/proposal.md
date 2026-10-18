# Proposal

## Why

本项目由 saas-template 的 create-project 生成（`--target cloudflare`）。生成器在 Cloudflare 目标下仍保留了完整的自托管交付（Node 构建、Docker Compose、镜像发布、WAL-G 备份、主机初始化）、模板自身的生成器，以及模板的验收证据。用户决定（2026-10-19）只走 Cloudflare 部署路径。这些代码、文档、CI 和技能会增加 worker 的阅读量与测试成本，部分 runbook 还暴露了模板的旧运维信息。

## What Changes

- 删除自托管交付层：`deploy/selfhost`、5 个 selfhost workflow、selfhost/node runbook、`scripts/selfhost-*`、`infra/postgres`、`apps/web/e2e/selfhost` 与 `playwright.selfhost.config.ts`、`deploy-selfhost` 技能；删除 `docs/runbooks/evidence`。
- 删除 Node 运行时：`apps/web` 的 `server.node.ts`、`vite.node.config.ts`、`src/node`、`build:node`；`apps/jobs` 的 Node 入口与引擎；`packages/platform`、`email`、`storage`、`config` 中只服务 Node 目标的适配器（Postgres 直连之外的 Valkey 缓存、SMTP、S3/SeaweedFS、node-schema）；相关测试、vitest node 配置与 CI 的 `node` job。
- 删除模板生成器：`scripts/create-project*`、`quick-start` 技能、`docs/create-project.md`。
- 文档（README、docs/01、02、07、08、platform-*）改为只描述 Cloudflare 目标。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `selfhost-deployment`: 全部需求移除。
- `database-backup-recovery`: 全部需求移除（只服务自托管 PG）。
- `project-bootstrap`: 全部需求移除（本仓库不再生成项目）。
- `agent-skills`: 技能清单去掉 quick-start 与 deploy-selfhost，部署技能只保留 Cloudflare。

## Impact

大范围删除，涉及 apps/web、apps/jobs、packages/{platform,email,storage,config}、CI 与文档。必须在 v1 的 `fd-sites-i18n` 之前合并，以免与其改动冲突；`bazi-engine`、`pkg-num-tarot` 只新增独立包，可以并行。
