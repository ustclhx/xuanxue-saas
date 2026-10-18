# numerology Specification

## Purpose
定义数字命理计算的输入与各项数字的计算规则，保证结果可复现、大师数处理一致，并能为多语言姓名提供同一套规范化处理。

## Requirements

### Requirement: 生命灵数
生命灵数 SHALL 按「月、日、年分别归约后相加再归约」计算；归约过程中出现 11、22、33 时 SHALL 保留为大师数，结果 SHALL 附带可展示的计算步骤。

#### Scenario: 大师数
- **WHEN** 出生日期为 1987-11-29
- **THEN** 生命灵数为 11，步骤显示 11 + 11 + 7 → 29 → 11（月 11 保留，日 29→11，年 1987→25→7）

### Requirement: 姓名数字
表达数 SHALL 使用姓名全部字母，灵魂数使用元音，人格数使用辅音，字母按毕达哥拉斯表（A=1…I=9 循环）取值；`Y` 在其前后都不是元音字母时 SHALL 视为元音；带重音符号的字母 SHALL 规范化为基础字母，非拉丁字母 MUST 返回字段错误。

#### Scenario: 带重音的姓名
- **WHEN** 输入姓名「Hélène Dupont」
- **THEN** 按「HELENE DUPONT」计算

#### Scenario: 非拉丁字母
- **WHEN** 输入姓名含中文字符
- **THEN** 姓名字段提示只支持拉丁字母，其余基于日期的数字仍显示

### Requirement: 个人年与生日数
个人年 SHALL 为「出生月 + 出生日 + 当前公历年」归约（以访客本地日期为准）；生日数 SHALL 为出生日归约，11、22 保留。

#### Scenario: 跨年
- **WHEN** 访客本地日期为 2027-01-01
- **THEN** 个人年以 2027 计算

### Requirement: 相性
生命灵数相性 SHALL 接受两个生日，输出双方生命灵数与基于固定相性表的等级（high/medium/challenging）及说明 key。

#### Scenario: 相性等级
- **WHEN** 双方生命灵数为 1 与 5
- **THEN** 输出相性表中 1–5 对应的固定等级
