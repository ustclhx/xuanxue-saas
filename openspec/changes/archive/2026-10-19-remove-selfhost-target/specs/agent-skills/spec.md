# Spec Delta

## MODIFIED Requirements

### Requirement: 双目录技能入口
系统 SHALL 提供 deploy-cloudflare、new-page、new-module、new-static-page、add-ai-model、security-scan；每个技能 SHALL 有 name/description 和可执行步骤、真实命令、验收条件、常见故障，两处目录内容 MUST 完全一致。

#### Scenario: 两种 agent 使用同一技能
- **WHEN** 使用者分别读取 `.agents/skills` 与 `.claude/skills` 下同名技能
- **THEN** 获得逐字节一致的指导，且引用能在项目中解析

### Requirement: 部署先预检再授权
部署技能 SHALL 默认只读预检并支持 --env/--domain/--admin-email 输入。任何资源创建、配置写入、secret、迁移或部署 MUST 先列出具体动作并取得覆盖这些动作的明确确认；重复执行 SHALL 复核已有资源并跳过匹配项，冲突 MUST 停止。

#### Scenario: 默认请求部署
- **WHEN** 使用者调用部署技能但未批准具体写入动作清单
- **THEN** 只报告资源、配置缺口和 dry-run 结果，不创建资源、不迁移、不写 secrets、不发布

#### Scenario: 已有资源重复执行
- **WHEN** 名称、ID、环境和用途与已确认的部署清单一致
- **THEN** 复用资源；不同或无法核实时请求处理冲突，不覆盖或删除

### Requirement: 安全审查与真实验证证据
security-scan SHALL 复用工程检查、敏感路径/凭据扫描与 diff 审查，报告范围且不输出真值。技能交付 MUST 包含最小页面和模块样例以及部署只读/dry-run 的结果；样例代码 MUST 丢弃，未完成外部验收 MUST 明示。

#### Scenario: 提交前扫描
- **WHEN** 使用者要求检查当前变更
- **THEN** 报告鉴权、注入、Webhook、SSRF、账本边界与敏感文件的审查结果，定位问题但不展示密钥值

#### Scenario: 离线交付
- **WHEN** 本次没有执行线上部署和真实服务调用
- **THEN** 验证记录仅声明真实完成的离线检查，不将 dry-run 记为部署成功

## REMOVED Requirements

### Requirement: 启动选项与配置归属
**Reason**: quick-start 只用于从模板生成新项目，本仓库已是生成后的业务项目。
**Migration**: 本地启动步骤保留在 README「本地开发」与 docs/07-infrastructure.md。
