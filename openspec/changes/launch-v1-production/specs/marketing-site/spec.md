# Spec Delta

## MODIFIED Requirements

### Requirement: 法律页
合规按语言而不是国家处理：两站为同一运营主体，只提供四个法律页 `/privacy`、`/terms`、`/disclaimer`、`/refund`，内容先只有英文一份。四页 SHALL 只从页脚进入，MUST NOT 出现在主导航或首屏；Cookie 条款并入隐私政策的「Cookies」一节。其他语言的同一路径 SHALL 显示英文正文并以该语言标注「目前仅提供英文」，页脚链接注明英文，且这些页面 MUST NOT 被索引或列入站点地图。MUST NOT 另建分国家的 GDPR/CCPA/LGPD 页、可访问性/DMCA/COPPA 页或 Cookie 设置中心。

隐私政策 SHALL 覆盖收集的数据（出生信息、邮箱、AI 提示词）、用途、第三方服务商（支付、AI 模型、分析）、保留期、删除渠道、18 岁以上、不出售数据；免责声明 SHALL 含仅供娱乐、不替代专业建议、不预测未来、不保证准确性四条；退款政策 SHALL 写明可退、不退的情形、处理时长与申请方式。每页底部 SHALL 标注「Last updated」日期与联系邮箱。条款以公开模板改写并经人工审阅，不自行编造。

隐私政策中的删除承诺 SHALL 与实现一致：删除单份报告时一并清除其 AI 对话正文；删除账号时清除个人空间的报告、AI 对话正文与订阅记录。

#### Scenario: 访问退款政策
- **WHEN** 访客打开 `/refund`
- **THEN** 页面说明可退与不退的情形、处理时长与申请途径，底部显示更新日期与联系邮箱

#### Scenario: 东方站访问隐私政策
- **WHEN** 访客在东方站打开 `/zh-hant/privacy`
- **THEN** 页面以繁中标注仅提供英文版并显示英文正文，且带 noindex

#### Scenario: 删除账号
- **WHEN** 用户删除账号
- **THEN** 个人空间的报告与 AI 对话正文被清除，订阅记录被删除
