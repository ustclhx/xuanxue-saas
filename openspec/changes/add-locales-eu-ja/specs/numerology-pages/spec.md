## ADDED Requirements

### Requirement: 西方站各语言的数字命理页面
西方站每种已发布的新语言 SHALL 提供与英语对应的 Life Path 工具页、12 个数字页（1–9、11、22、33）、完整计算器、姓名数字页与相性计算器。路径段 SHALL 使用该语言的主关键词（去掉变音符、小写、连字符连接），各语言版本之间互为 hreflang。数字名称与术语 SHALL 按该语言的数字命理惯例（如西班牙语 número del camino de vida、德语 Lebenszahl、法语 chemin de vie）。

#### Scenario: 西班牙语数字页
- **WHEN** `es` 已发布，访客打开西班牙语 7 号数字页
- **THEN** 页面以西班牙语说明 7 号的性格、爱情、事业与相性，示例使用西语地区的人名与日期，hreflang 指向英文 `/life-path-number/7`

#### Scenario: 英文数字页声明西语版本
- **WHEN** 搜索引擎抓取 `/life-path-number/7`
- **THEN** hreflang 包含西班牙语对应页的绝对地址，不包含东方站地址

### Requirement: 非 ASCII 拉丁字母姓名
姓名数字计算 SHALL 接受欧洲语言常见的特殊字母：可拆分的变音符按基础字母计算，不能拆分的字母按约定映射（`ß` → `SS`、`ł` → `L`、`æ` → `AE`、`ø` → `O`、`œ` → `OE`），映射规则 SHALL 在页面说明中写明；无法映射的字符给出本语言错误提示。

#### Scenario: 德语姓名含 ß
- **WHEN** 访客在德语计算器输入「Weiß」
- **THEN** 计算按「WEISS」进行，结果与说明中写明的规则一致
