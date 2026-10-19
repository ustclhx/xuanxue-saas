# tarot-draw Specification

## Purpose
定义塔罗牌组、牌阵与抽牌过程的规则，保证抽牌真正随机、结果可通过分享链接复现，并为后续 Lenormand 等牌组留出扩展。

## Requirements

### Requirement: 牌组与牌阵
系统 SHALL 提供 78 张 RWS 牌及每日一张（1）、是/否（1）、三张牌（过去/现在/未来，3）、凯尔特十字（10）四种牌阵；每个牌位 SHALL 有本语言的名称与含义说明。

#### Scenario: 凯尔特十字
- **WHEN** 访客选择凯尔特十字并完成抽牌
- **THEN** 显示 10 张不重复的牌及各自牌位名称

### Requirement: 随机抽牌
洗牌 SHALL 使用加密安全随机数做 Fisher–Yates 洗牌；切牌位置由访客点选决定；每张牌逆位概率 SHALL 为 50%（访客可在设置中关闭逆位）。同一次抽牌中 MUST NOT 出现重复的牌。

#### Scenario: 关闭逆位
- **WHEN** 访客关闭逆位后抽三张牌
- **THEN** 三张牌均为正位

### Requirement: 是/否判定
是/否牌阵 SHALL 按固定映射表给出 Yes / No / Maybe，映射表对每张牌的正逆位都有定义，页面 SHALL 说明判定依据。

#### Scenario: 是否结果
- **WHEN** 抽到正位「太阳」
- **THEN** 结果为 Yes，并显示判定依据

### Requirement: 抽牌结果可复现
抽牌结果 SHALL 编码为牌阵 id + 牌 id + 正逆位，分享链接打开后 SHALL 显示同一组牌，且不重新抽牌。

#### Scenario: 打开分享的牌阵
- **WHEN** 访客打开他人分享的三张牌结果
- **THEN** 显示相同的三张牌与正逆位
