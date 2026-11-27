## MODIFIED Requirements

### Requirement: 一次性付款以回调为准入账
积分包等一次性购买 SHALL 只在收到平台确认付款成功的通知后发放积分。用户从支付页返回时的主动确认（如 PayPal capture）、后台补 capture 与平台回调 MUST 无论先后到达都只入账一次。PayPal 一次性订单的 capture SHALL 在用户回到站点时自动发起，MUST NOT 要求用户再点击确认按钮。

#### Scenario: 返回页先于回调
- **WHEN** 用户从 PayPal 返回触发 capture，随后平台的付款完成回调到达
- **THEN** 积分只发放一次

#### Scenario: 用户关闭返回页
- **WHEN** 用户付款后没有回到站点
- **THEN** 平台回调到达后积分仍正常发放

#### Scenario: 返回页自动 capture
- **WHEN** 用户在 PayPal 批准付款后回到站点的支付返回页
- **THEN** 页面自动发起 capture，页面上没有需要点击的确认按钮

## ADDED Requirements

### Requirement: 已批准未扣款订单的补 capture
用户批准 PayPal 一次性订单后，如果没有回到站点完成 capture，系统 SHALL 在后台补 capture。补 capture 与返回页 capture MUST 使用同一幂等标识，重复触发 MUST NOT 产生第二笔扣款。订单已过期、被取消或无法 capture 时，系统 SHALL 把该购买标记为失败，MUST NOT 发放积分。

#### Scenario: 批准后关闭页面
- **WHEN** 用户在 PayPal 批准付款后直接关闭浏览器，没有回到站点
- **THEN** 系统在后台完成 capture，付款完成回调到达后积分正常发放

#### Scenario: 返回页与后台同时 capture
- **WHEN** 返回页 capture 与后台补 capture 几乎同时发起
- **THEN** PayPal 只产生一笔扣款，积分只发放一次

#### Scenario: 订单从未批准
- **WHEN** 用户打开 PayPal 页面后取消，订单一直未批准
- **THEN** 系统不发起 capture，超时后购买标记为失败，不发放积分

### Requirement: 支付返回页的本地化与去向
支付返回页 SHALL 以用户发起购买时的站点语言显示。capture 成功提交后 SHALL 自动回到发起购买的本站页面，并告知该页面支付待确认；用户取消时 SHALL 回到发起页面并告知已取消。没有发起页面时 SHALL 回到账单页。

#### Scenario: 韩语用户付款成功
- **WHEN** 东方站韩语页面的用户完成 PayPal 付款并回到站点
- **THEN** 返回页以韩语显示进度，随后自动回到原结果页并继续生成详批

#### Scenario: 用户在 PayPal 取消
- **WHEN** 用户在 PayPal 页面点击取消返回
- **THEN** 浏览器回到发起页面，页面重新显示积分包选择，不发起 capture

### Requirement: 可恢复的付款失败
capture 因付款方式被拒等可恢复原因失败时，系统 SHALL 引导用户回到 PayPal 重新选择付款方式；其他失败 SHALL 显示可重试的本地化提示，MUST NOT 发放积分，也 MUST NOT 向用户展示平台原始错误。

#### Scenario: 银行卡被拒
- **WHEN** capture 返回付款方式被拒
- **THEN** 用户被带回 PayPal 页面重新选择付款方式，原订单不重复创建

#### Scenario: 平台暂时不可用
- **WHEN** capture 因网络或平台错误失败
- **THEN** 返回页显示本地化的重试提示，购买保持待付款状态，不发放积分

### Requirement: PayPal 订单的站点展示
PayPal 一次性订单 SHALL 携带发起站点的品牌名、发起页面的语言，以及描述所购积分数量和站点品牌的商品说明，使买家在 PayPal 页面和交易记录中能识别购买内容。MUST NOT 在订单中写入出生信息等用户输入。

#### Scenario: 东方站繁体中文购买
- **WHEN** 用户在 ganjiday.com 的繁体中文页面购买 100 积分包
- **THEN** PayPal 页面显示东方站品牌，界面语言为繁体中文，订单商品说明包含积分数量与东方站品牌

#### Scenario: 西方站英文购买
- **WHEN** 用户在 arcanumber.com 购买 500 积分包
- **THEN** PayPal 页面与交易记录显示 Arcanumber 品牌及 500 积分的商品说明

### Requirement: 单一支付方式时不显示选择器
可用支付方式只有一个时，账单页与积分包购买入口 SHALL 直接使用该方式发起结账，MUST NOT 显示支付方式选择器；有多个可用方式时 SHALL 按配置顺序显示选择器。

#### Scenario: 只启用 PayPal 的账单页
- **WHEN** 配置只启用 PayPal 且其凭据齐全，owner 打开账单页购买积分包
- **THEN** 页面不显示支付方式下拉，点击购买直接跳转 PayPal
