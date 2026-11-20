## ADDED Requirements

### Requirement: 新语言的结算币种
Stripe 结算币种 SHALL 按界面语言扩展为：`ja` → JPY，`pt-BR` → BRL，`fr`、`de`、`it` → EUR，`es` → USD；PayPal 对所有新语言 SHALL 以 USD 结算。新币种的金额 SHALL 写入固定汇率价目表（JPY 为零小数币种，按 10 日元取整；EUR、BRL 按整数或 .99 规则取整，规则写在价目表中），回调入账只接受与价格行一致的币种。新币种价格未同步或已停用时 SHALL 回退到 USD，且定价页显示的价格与实际扣款一致。

#### Scenario: 日语访客用 Stripe 购买
- **WHEN** 界面语言为 `ja` 的访客在东方站用 Stripe 购买积分包，JPY 价格已同步
- **THEN** 结账以日元扣款，定价页与结账页显示相同的日元金额，金额没有小数

#### Scenario: 欧元价格尚未同步
- **WHEN** 界面语言为 `fr`，但该套餐的 EUR 价格行未同步
- **THEN** 以 USD 结账，定价页同时显示 USD 价格

#### Scenario: 西班牙语访客用 PayPal
- **WHEN** 界面语言为 `es` 的访客选择 PayPal
- **THEN** 以 USD 结账
