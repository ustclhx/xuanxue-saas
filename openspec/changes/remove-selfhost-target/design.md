# Design

## Context

模板通过 `packages/platform` 的中立能力契约同时支持 Cloudflare 与 Node 适配（docs/platform-capabilities.md）。Cloudflare 适配是主路径，Node 适配位于 `*/node/` 目录与 `*.node.*` 文件，入口为 `server.node.ts` 与 jobs 的 Node 引擎。

## Goals / Non-Goals

**Goals:** 删除后 Cloudflare 构建、测试、staging 与生产发布行为不变；仓库中不再有自托管入口。
**Non-Goals:** 不重构中立能力契约本身（`requireCapability` 等保留，便于测试注入）；不改业务逻辑。

## Decisions

1. **保留中立契约，删除 Node 实现**：`packages/platform` 中 Cloudflare 适配与契约类型保留；只被 Node 入口引用的实现、测试与依赖（如 `@sentry/node`、SMTP、S3 客户端、Valkey 客户端）一并删除。判断标准：删除后 `pnpm typecheck` 与 `pnpm build`（Cloudflare）通过，且 `pnpm check:deps`、`pnpm check:singletons` 不报错。
2. **存储**：R2 预签名仍通过 S3 API 生成，`aws4fetch`/S3 签名代码若被 Cloudflare 路径使用则保留，只删 SeaweedFS/外部 S3 Compose 夹具。
3. **CI**：删除 `node` job 与 selfhost workflow；`check`、`e2e-smoke`、staging/production 发布保留。
4. **分两步提交**：协调者先删交付层（任务 1.x，纯文件删除与引用修复）；Node 运行时与生成器删除由 Claude worker 完成（任务 2.x、3.x）。

## Risks / Trade-offs

- [误删 Cloudflare 路径共用代码] → 以 typecheck、全量测试、`pnpm build` 与 `wrangler deploy --dry-run` 作为门槛；不确定的文件保留并在 PR 中列出。
- [以后又需要自托管] → 可从 saas-template 重新获取，本仓库不保留。
