# Spec Delta

## ADDED Requirements

### Requirement: 订阅只在启用订阅的平台提供
订阅结账 SHALL 只在已为订阅套餐配置了有效价格的支付平台上提供。对没有订阅价格的平台，定价页、账单页与余额不足弹窗 MUST NOT 显示该平台的订阅选项，直接调用其订阅结账 MUST 被拒绝。同一平台的积分包购买不受影响。

#### Scenario: PayPal 只卖积分包
- **WHEN** 只有 Stripe 配置了订阅价格，用户在账单页选择订阅
- **THEN** 支付方式只提供 Stripe；选择积分包时 Stripe 与 PayPal 都可选

#### Scenario: 直接调用 PayPal 订阅结账
- **WHEN** 客户端直接以 PayPal 发起订阅结账
- **THEN** 请求被拒绝，返回价格不可用错误
