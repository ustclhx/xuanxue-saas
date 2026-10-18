# Spec Delta

## REMOVED Requirements

### Requirement: 可选 Node 服务端目标
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: Compose 顺序启动
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 单一安全 HTTP 入口
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 非 root 与运行边界
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 结构化滚动日志
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 可选 Turnstile
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 双目标 CI 与发布隔离
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 多架构不可变镜像交付
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 迁移受控的 Compose 发布
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 发布版本检查与可操作回滚
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 同一 Compose 的可选运维层
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 空白服务器单命令初始化
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

### Requirement: 主机重启后版本与持久状态恢复
**Reason**: 本项目只使用 Cloudflare Workers 部署（2026-10-19 用户决定），不再提供 Node/Docker Compose 自托管目标。
**Migration**: 生产与 staging 走 Cloudflare Workers + Neon（production-deployment、staging-deployment）；Turnstile 开关仍由 template.config.ts 与 user-auth 保证。

