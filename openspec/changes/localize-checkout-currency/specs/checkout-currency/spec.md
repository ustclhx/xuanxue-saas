# Spec Delta

## Purpose

按界面语言决定一次结账以哪种币种扣款，并保证页面价格、平台扣款、入账与退款在同一币种下一致；本地价格来自固定汇率换算后取整的可维护价目表。

## ADDED Requirements

### Requirement: 按界面语言决定结算币种
结账的扣款币种 SHALL 由服务端根据发起结账时的界面语言和支付平台决定，规则如下：

| 界面语言 | Stripe | PayPal |
|---|---|---|
| zh-Hant | TWD | TWD |
| ko | KRW | USD |
| zh-Hans | USD | USD |
| en 及其他语言 | USD | USD |

客户端提交的币种或金额 MUST NOT 影响扣款币种。

#### Scenario: 繁体用户用 Stripe 购买
- **WHEN** 用户在 `/zh-hant/` 界面用 Stripe 购买单次详批积分包
- **THEN** Stripe Checkout 以 TWD 显示并扣款，金额等于价目表中该积分包的 TWD 价格

#### Scenario: 韩语用户用 PayPal 购买
- **WHEN** 用户在 `/ko/` 界面选择 PayPal 购买同一积分包
- **THEN** PayPal 订单以 USD 创建，金额等于该积分包的 USD 价格

#### Scenario: 篡改币种参数
- **WHEN** 客户端在 `/zh-hant/` 的结账请求中附带 USD 价格 ID 或币种参数
- **THEN** 服务端仍按 zh-Hant + 所选平台选出 TWD 价格

### Requirement: 本地价格缺失时回退美元
所选币种的价格未同步到支付平台或已停用时，系统 SHALL 改用该套餐的 USD 价格结账，MUST NOT 阻断付款；此时页面 SHALL 显示 USD 价格，使展示与扣款一致。

#### Scenario: TWD 价格尚未同步
- **WHEN** 某积分包只有可用的 USD Stripe 价格，繁体用户发起 Stripe 结账
- **THEN** 结账以 USD 扣款，定价页对该积分包显示 USD 价格

### Requirement: 固定汇率价目表
每个在售套餐在每个启用币种下的价格 SHALL 来自一份随代码发布的价目表。表中记录换算所用的汇率快照日期和取整规则：TWD 取整到元，KRW 取整到百韩元。价格 MUST NOT 随实时汇率自动变化；调价 SHALL 通过修改价目表并同步出新的价格对象完成，已存在的平台价格对象 MUST NOT 被改价。

#### Scenario: 汇率波动
- **WHEN** 市场汇率较价目表快照变化了 5%
- **THEN** 定价页与结账金额都不变

#### Scenario: 调整 TWD 价格
- **WHEN** 运营在价目表中把某积分包的 TWD 价格从 65 改为 69 并完成同步
- **THEN** 系统新建一个 TWD 价格对象并停用旧对象，之后的结账使用 69，历史付款记录仍为 65

### Requirement: 币种金额的最小单位
所有金额 SHALL 以付款币种的最小单位整数记录，并遵循各平台对该币种的约定：

- KRW 为零小数币种，1 表示 ₩1；
- TWD 在 Stripe 中以 1/100 元记录，且 MUST 为 100 的倍数；在 PayPal 中只能以整元传递；
- USD 以美分记录。

金额在显示、导出或发送分析事件前 MUST 按币种换算，MUST NOT 统一除以 100。

#### Scenario: 韩元付款入账
- **WHEN** 一笔 ₩2,800 的 Stripe 付款回调到达
- **THEN** 付款记录的金额为 2800、币种为 KRW；后台显示 ₩2,800；分析事件中的收入为 2800 KRW

#### Scenario: 新台币价格校验
- **WHEN** 价目表中某个 TWD 价格的最小单位金额不是 100 的倍数
- **THEN** 种子或同步在写入任何数据或调用平台之前失败

### Requirement: 入账币种必须与价格一致
回调入账时，付款币种 SHALL 属于启用的币种（USD、TWD、KRW），并且 MUST 与关联价格行的币种和金额一致。不一致时，该次投递 SHALL 整体不入账、不发积分，并按不可重试的币种错误记录与告警。

#### Scenario: 买家所在地导致换币
- **WHEN** 一笔关联 TWD 价格的付款以 USD 金额回调
- **THEN** 不入账也不发积分，回调记为不可重试的币种错误，运营收到告警

### Requirement: 退款以原付款币种计算
退款申请、审批金额、平台退款与部分退款的积分回收比例 SHALL 都以原付款的币种和最小单位计算。后台输入退款金额时 SHALL 按该币种的显示单位输入，例如 TWD 和 KRW 只能输入整元。

#### Scenario: 新台币部分退款
- **WHEN** 管理员对一笔 NT$227 的付款批准退款 NT$100
- **THEN** 平台退款金额为 10000（TWD 的最小单位），积分按 (227−100)/227 的比例保留

### Requirement: 价格展示格式
页面上的价格 SHALL 使用与结算一致的币种，按界面语言本地化格式显示，并去掉不存在的小数位。zh-Hant 以 `NT$` 前缀显示，以区分美元；ko 显示 `₩` 加千分位；zh-Hans 显示 USD 价格，并附带标注为参考价的人民币金额（来自价目表的固定汇率），该参考价 MUST NOT 标示为可支付的金额。

#### Scenario: 简体定价页
- **WHEN** 访客打开 `/zh-hans/pricing`
- **THEN** 积分包显示 `US$1.99`，旁边是「约 ¥13（参考价，以美元结算）」，页面不请求实时汇率服务

#### Scenario: 繁体定价页
- **WHEN** 访客打开 `/zh-hant/pricing`，且 TWD 价格可用
- **THEN** 积分包显示 `NT$65`，不显示美元价格或「约」字样

### Requirement: 本地价格的公开展示可缓存
定价页与解锁卡显示的本地价格 SHALL 来自公开价格快照或缓存，与现有定价缓存的刷新周期相同。读取失败时 SHALL 降级为构建期快照，MUST NOT 为显示本地价格而在访客请求中实时查询数据库或外部汇率服务。

#### Scenario: 数据库不可达
- **WHEN** 数据库暂时不可达，访客打开韩语定价页
- **THEN** 页面以构建期快照显示 KRW 价格
