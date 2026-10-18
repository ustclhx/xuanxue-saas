# tool-pages Specification

## Purpose
为所有占卜与命理工具页（排盘、数字命理、抽牌）定义共同的访客体验契约：首屏即可输入、零等待出结果、不要求注册，并统一合规表述与行为数据采集。

## Requirements

### Requirement: 首屏零等待出结果
工具页首屏 SHALL 直接显示输入表单；提交后免费结果 SHALL 在浏览器本地计算并在同一页面展示，MUST NOT 跳转页面、要求注册或要求邮箱，计算 MUST NOT 依赖网络请求。

#### Scenario: 离线后提交
- **WHEN** 页面加载完成后网络断开，访客提交出生信息
- **THEN** 结果仍在当前页面显示

### Requirement: 工具页可被抓取
工具页的标题、说明文字、表单与各结果区块的解释文字 SHALL 存在于预渲染的 HTML 中；首屏渲染 MUST NOT 依赖数据库。

#### Scenario: 禁用 JavaScript 抓取
- **WHEN** 以禁用 JavaScript 的方式请求工具页
- **THEN** 返回的 HTML 含有页面 H1、表单字段标签与各区块的说明文字

### Requirement: 可分享结果链接
每个结果 SHALL 提供分享链接，打开后无需再次输入即可复现同一结果；分享链接页面 SHALL 带 `noindex` 且 canonical 指向不含参数的工具页。分享链接 MUST NOT 包含姓名等可识别个人身份的明文。

#### Scenario: 打开朋友分享的结果
- **WHEN** 访客打开他人分享的结果链接
- **THEN** 直接看到相同的结果，页面 head 含 noindex 与指向工具页的 canonical

### Requirement: 合规声明
每个工具页与每份结果 SHALL 显示当前语言的统一声明：「AI 辅助、仅供娱乐、不预测未来」；涉及健康的问题 SHALL 引导访客寻求专业医疗建议。页面标题与 H1 MUST NOT 以 AI 作为卖点。

#### Scenario: 结果区的声明
- **WHEN** 任一工具页显示结果
- **THEN** 结果区底部可见本语言的合规声明

### Requirement: 行为埋点
工具页 SHALL 记录以下匿名事件：表单提交、结果展示、结果区块展开/点击、站内工具互链点击、邮件订阅提交、付费解锁点击；事件 MUST NOT 包含出生日期、姓名或邮箱。

#### Scenario: 提交排盘
- **WHEN** 访客提交排盘表单
- **THEN** 记录一条不含出生信息的表单提交事件，带工具标识、站点与语言
