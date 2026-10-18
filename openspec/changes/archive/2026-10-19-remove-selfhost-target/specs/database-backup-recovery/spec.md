# Spec Delta

## REMOVED Requirements

### Requirement: 每日基础备份与连续归档
**Reason**: 该能力只服务自托管 Compose 内的 Postgres；Cloudflare 生产使用 Neon。
**Migration**: 生产恢复依赖 Neon 时间点恢复与 production-deployment 中的每日逻辑备份。

### Requirement: 可配置的安全分层保留
**Reason**: 该能力只服务自托管 Compose 内的 Postgres；Cloudflare 生产使用 Neon。
**Migration**: 生产恢复依赖 Neon 时间点恢复与 production-deployment 中的每日逻辑备份。

### Requirement: 每日逻辑备份
**Reason**: 该能力只服务自托管 Compose 内的 Postgres；Cloudflare 生产使用 Neon。
**Migration**: 生产恢复依赖 Neon 时间点恢复与 production-deployment 中的每日逻辑备份。

### Requirement: 新环境指定时间点恢复
**Reason**: 该能力只服务自托管 Compose 内的 Postgres；Cloudflare 生产使用 Neon。
**Migration**: 生产恢复依赖 Neon 时间点恢复与 production-deployment 中的每日逻辑备份。

### Requirement: 隔离恢复演练证明
**Reason**: 该能力只服务自托管 Compose 内的 Postgres；Cloudflare 生产使用 Neon。
**Migration**: 生产恢复依赖 Neon 时间点恢复与 production-deployment 中的每日逻辑备份。

### Requirement: 独立凭据恢复副本
**Reason**: 该能力只服务自托管 Compose 内的 Postgres；Cloudflare 生产使用 Neon。
**Migration**: 生产恢复依赖 Neon 时间点恢复与 production-deployment 中的每日逻辑备份。

