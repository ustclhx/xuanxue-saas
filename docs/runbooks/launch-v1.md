# v1 上线与收录记录

2026-10-20 UTC。目标：Arcanumber（en）与 Ganjiday（zh-Hant / ko）以「付款即将开放」状态上线。

## 当前状态

| 项目 | 状态与证据 |
| --- | --- |
| 2.1 Worker 资源 / secrets / dry-run | 已完成本轮无支付上线配置的预检，见 [production runbook](production-xuanxue.md#本轮发布准备2026-10-20) 与 [证据](evidence/launch-v1/README.md) |
| GitHub production environment | 已建立；仅 `v*` tag，required reviewer 为 `ustclhx`；迁移 secret 已写入；Cloudflare 两项 CI secret 等待用户终端输入 |
| 2.2 迁移 → seed 确认 → jobs → web | 未执行本轮发布；已有生产迁移 14/14、seed 价格只读复核通过；等待 CI 凭据与修正工作流合入 main、同 SHA staging 成功 |
| 2.3 Lighthouse | 未运行；需先有可用生产部署，不以空站或失败请求作为性能审计 |
| 3.1 GSC / Bing | 未操作；部署暂停，尚无资源验证 / sitemap「成功」证据 |
| Cloudflare Web Analytics | 未创建；暂无公开 site token，未启用自动注入，未修改应用代码 |
| support 收件 | 既有两条 Cloudflare Routing Active、目标 Verified；仍需用户从其他邮箱实测两站 support 并确认收信 |
| Resend | 用户决定延后；邮件传输保持默认 `log`，不发信 |
| 支付 / 详批 / Sentry | 不配置任何支付、DeepSeek、Sentry secret；modelKey 默认空；不运行 billing:sync、不改价格 |

## 发布后的验收

- 两站 `/api/health`：HTTP 200、`db.status=up`、`version` 为部署完整 SHA；保存 Actions 链接及 jobs/web 版本。
- 两站 `https://www.<域名>/x?y=1`：301 到裸域，路径与查询保留。
- 西站 `/`、`/pricing`；东站 `/`、`/zh-hant`、`/ko`、`/zh-hant/pricing`、`/ko/pricing`；免费工具可计算，支付入口不可用、详批卡隐藏。
- 两站 `/privacy`、`/terms`、`/disclaimer`、`/refund` 及东方语言前缀法律页；`/sitemap.xml`、`/robots.txt`。普通规范页可索引；非英文法律页按已批准 spec 保留 noindex 且不进入 sitemap。
- 浏览器在西站用独立测试邮箱真实密码注册、进入个人空间后从应用删除账号；不要使用用户管理员邮箱。
- 用户本人使用 BOOTSTRAP_ADMIN_EMAILS 中的邮箱注册。当前实现另要求邮箱已验证才授予 admin；log 邮件模式下不能声称首次密码注册即成为管理员，见生产 runbook。

## Lighthouse 待执行清单

移动端，逐页保存原始 HTML / JSON 报告到本目录下 `evidence/launch-v1/`，记录测试 UTC、完整部署 SHA、Lighthouse / Chrome 版本、模拟网络与设备、performance 分数、LCP / CLS / TBT。实验室报告没有现场 INP 时，以 TBT 作为替代指标明确标注，不把 TBT 当成实测 INP。

| 站点 | 页面 | 分数 / LCP / CLS / INP 或 TBT |
| --- | --- | --- |
| 西方 | `https://arcanumber.com/` | 待部署 |
| 西方 | `https://arcanumber.com/tarot` | 待部署 |
| 西方 | `https://arcanumber.com/pricing` | 待部署 |
| 东方 | `https://ganjiday.com/zh-hant` | 待部署 |
| 东方 | `https://ganjiday.com/ko` | 待部署 |
| 东方 | `https://ganjiday.com/zh-hant/塔羅` | 待部署 |

门槛：LCP < 2.5s、CLS < 0.1、INP < 200ms。未达标只保存结果并暂停报告，不在本轮修改性能代码。

## GSC / Bing 待执行记录

| 域名 | GSC Domain 资源 / DNS TXT / 验证 | sitemap | Bing 从 GSC 导入 |
| --- | --- | --- | --- |
| `arcanumber.com` | 未操作 | `https://arcanumber.com/sitemap.xml`，尚未提交 | 未操作 |
| `ganjiday.com` | 未操作 | `https://ganjiday.com/sitemap.xml`，尚未提交 | 未操作 |

续跑时通过用户已登录浏览器建立 Domain 资源，只写对应 Cloudflare zone 的验证 TXT；验证后提交上述 sitemap，记录资源名、提交 UTC 与「成功」状态。Bing 从 GSC 导入；出现登录、审批、付费或接受条款时交用户处理。只有实际成功后勾选 3.1。

## Web Analytics 待执行记录

| 域名 | 手动 JS 片段站点 | 公开 site token |
| --- | --- | --- |
| `arcanumber.com` | 未创建 | 待创建后回填 |
| `ganjiday.com` | 未创建 | 待创建后回填 |

只选择手动 JS 片段，关闭自动注入；取得公开 token 后交协调者接入，不在本轮修改代码。
