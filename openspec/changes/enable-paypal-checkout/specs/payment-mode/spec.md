## ADDED Requirements

### Requirement: 生产环境显式 live 与凭据预检
生产 web 与 jobs SHALL 显式配置 `PAYMENT_MODE=live`。生产发布前的 secret 检查 SHALL 按模板启用的支付平台派生必需凭据：启用 PayPal 时 web 与 jobs 都 MUST 具备 `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_WEBHOOK_ID`。缺项时检查 MUST 失败，只输出变量名，MUST NOT 输出值。

#### Scenario: 生产缺少 PayPal webhook ID
- **WHEN** 模板启用 PayPal，生产 jobs Worker 缺少 `PAYPAL_WEBHOOK_ID`
- **THEN** 生产 secret 检查失败并列出缺少的变量名，不显示任何密钥值

#### Scenario: 未启用的平台不要求凭据
- **WHEN** 模板只启用 PayPal
- **THEN** 生产检查不要求 Stripe 凭据

### Requirement: live 环境积分包映射激活
系统 SHALL 提供在 live 环境激活 PayPal 积分包价格映射的操作。该操作 MUST 只处理积分包，MUST NOT 发起任何 PayPal 远端请求，MUST NOT 创建或修改订阅价格，重复执行 SHALL 不产生变化。完整目录同步（含远端 Product/Plan）仍 MUST 只允许在 test/Sandbox 执行。

#### Scenario: 首次激活生产积分包
- **WHEN** 生产已完成目录 seed，运维执行 live 积分包激活
- **THEN** PayPal 积分包价格变为可用，定价页与解锁卡显示可购买，期间没有 PayPal 网络请求

#### Scenario: 重复执行
- **WHEN** 已激活后再次执行
- **THEN** 报告无变化，价格映射保持不变

#### Scenario: 尝试 live 完整同步
- **WHEN** 运维以 live 凭据执行完整目录同步
- **THEN** 命令拒绝执行，不修改数据库或远端资源
