## ADDED Requirements

### Requirement: 牌义页的语言惯例
新语言的牌义页与抽牌页 SHALL 使用该语言的塔罗惯例：牌名、花色与正逆位术语取自该语言的术语表（如日语「正位置／逆位置」「ワンド・カップ・ソード・ペンタクル」，西班牙语「Arcanos Mayores」「Bastos・Copas・Espadas・Oros」，德语「Stäbe・Kelche・Schwerter・Münzen」）。牌义页 URL 的牌标识 SHALL 沿用现有英文 slug，路径段使用本语言关键词（如 `/ja/タロット/カード/the-sun`、`/es/tarot/cartas/the-sun`）。

#### Scenario: 日语牌义页
- **WHEN** 访客打开 `/ja/タロット/カード/the-sun`
- **THEN** 页面标题使用「太陽」，正逆位小标题为「正位置」「逆位置」，hreflang 指向东方站其他语言的太阳牌页

#### Scenario: 西班牙语花色
- **WHEN** 访客打开西班牙语「金币王牌」牌义页
- **THEN** 牌名为「As de Oros」，同花色相邻牌链接使用相同的花色名
