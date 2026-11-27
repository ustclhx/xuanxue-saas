# payments Specification

## Purpose
定义用户如何通过各支付平台购买订阅与积分包，以及系统在发起结账前必须做的检查，使不同平台对用户呈现一致的购买行为。

## Requirements

### Requirement: 可配置的支付平台
定价页 SHALL 按模板配置 `billing.providers` 的顺序展示可用的支付方式；未在配置中的平台 MUST NOT 出现，其结账接口 MUST 拒绝请求。

#### Scenario: 只启用 PayPal
- **WHEN** 配置 `billing.providers=['paypal']`
- **THEN** 定价页只显示 PayPal，直接调用 Stripe 结账接口返回错误

### Requirement: 结账权限
只有空间的 owner SHALL 能为该空间发起结账（购买订阅或积分包）。

#### Scenario: 非 owner 结账
- **WHEN** 空间 admin 或 member 发起结账
- **THEN** 请求返回 403

### Requirement: 订阅结账前置检查
空间已有「会续费的」订阅时：若与目标为同一平台且该平台支持订阅内换套餐，系统 MUST 拒绝新建订阅并引导走换套餐；否则系统 SHALL 在用户确认后先将旧订阅设为周期末取消，成功后才创建新的结账。

#### Scenario: 同平台已有订阅
- **WHEN** 空间已有 Stripe 的有效订阅，再次发起 Stripe 订阅结账
- **THEN** 结账被拒绝，提示使用换套餐功能

#### Scenario: 换平台
- **WHEN** 空间已有 Stripe 的有效订阅，用户确认后发起 PayPal 订阅结账
- **THEN** 旧订阅被设为周期末取消，然后返回 PayPal 结账地址

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

### Requirement: 订阅管理入口
账单页 SHALL 为订阅提供取消与恢复操作；平台提供客户门户时 SHALL 提供跳转门户的入口。

#### Scenario: Stripe 订阅
- **WHEN** owner 打开账单页且订阅来自 Stripe
- **THEN** 页面提供打开 Stripe 客户门户的入口

#### Scenario: PayPal 订阅取消
- **WHEN** owner 在账单页取消 PayPal 订阅
- **THEN** 订阅被设为周期末取消，周期结束前权益保留

### Requirement: 共存套餐目录
定价数据 SHALL 分别提供订阅与一次性积分包；订阅价格 SHALL 按月付与年付区分，切换周期 MUST NOT 隐藏积分包。权益展示清单 SHALL 来自套餐 features 数据。公开定价读取失败 SHALL 保留既有快照降级。

#### Scenario: 两类套餐同时存在
- **WHEN** 目录包含月付、年付订阅和一次性积分包
- **THEN** 两类均有独立数据，订阅切换周期不改变积分包，权益清单反映套餐配置

### Requirement: 订阅用户追加积分包
已有有效订阅的空间 owner SHALL 能购买积分包；积分包付款 SHALL 只增加积分，不取消订阅或改变其权益，重复付款投递 MUST NOT 重复入账。

#### Scenario: Stripe 订阅空间购买积分包
- **WHEN** 同一空间先完成订阅首付，再完成积分包付款，并重复投递两个付款事件
- **THEN** 订阅保持有效，两类付款各入账一次，订阅与购买来源的积分分别可用

### Requirement: 结账币种锁定
系统创建的结账 MUST 以平台价格的币种（当前为 USD）向买家扣款，MUST 关闭服务商按买家所在地自动换算币种的功能。收到币种与价格不一致的付款通知时，系统 SHALL 以可区分的错误码记录该通知为失败、不再重试，并发出运营告警供人工处理；MUST NOT 发放积分或权益。

#### Scenario: 海外买家结账
- **WHEN** 一位欧元区买家通过 Stripe 结账购买积分包
- **THEN** 结账页以 USD 计价扣款，付款回调正常入账

#### Scenario: 收到非 USD 付款
- **WHEN** 因平台配置异常收到一笔 EUR 付款通知
- **THEN** 通知被记录为币种不符的失败，不发放积分，运营渠道收到告警

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

### Requirement: 账单页只展示可购买价格
账单页的购买选项 SHALL 只包含当前有效、已同步到支付平台且平台可用的价格；已停用的价格 MUST NOT 作为购买选项（含禁用状态）出现。空间的现有订阅关联已停用价格时，该价格 SHALL 只在订阅信息中显示。不可用原因的提示 SHALL 使用当前语言。

#### Scenario: 存在停用的旧价格
- **WHEN** 系统中有已停用的 $0.99 与 $3.99 价格，用户打开账单页
- **THEN** 购买选项只显示 $1.99 与 $6.99

#### Scenario: 旧价格的现有订阅
- **WHEN** 空间仍有关联已停用价格的订阅
- **THEN** 该价格出现在订阅信息中，不出现在购买选项中

### Requirement: 订阅只在启用订阅的平台提供
订阅结账 SHALL 只在已为订阅套餐配置了有效价格的支付平台上提供。对没有订阅价格的平台，定价页、账单页与余额不足弹窗 MUST NOT 显示该平台的订阅选项，直接调用其订阅结账 MUST 被拒绝。同一平台的积分包购买不受影响。

#### Scenario: PayPal 只卖积分包
- **WHEN** 只有 Stripe 配置了订阅价格，用户在账单页选择订阅
- **THEN** 支付方式只提供 Stripe；选择积分包时 Stripe 与 PayPal 都可选

#### Scenario: 直接调用 PayPal 订阅结账
- **WHEN** 客户端直接以 PayPal 发起订阅结账
- **THEN** 请求被拒绝，返回价格不可用错误
