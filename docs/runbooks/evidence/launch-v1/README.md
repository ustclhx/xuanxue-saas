# launch-v1-production 预检证据

2026-10-20 UTC。前半为历史发布准备证据；最新生产实测见文末。

## 目标与范围

- 源码基线：`b6ae303bdbf3f6c099f776d90efae30cedb99be6`，加本 PR 工作流/冒烟/checker/Cron 改动；不声称这些未提交改动已部署。
- 目标 Worker：`xuanxue-web-production` / `xuanxue-jobs-production`；两域 `ganjiday.com` / `arcanumber.com`。
- [build-target.json](build-target.json)：从 web 构建生成的扁平 Wrangler 配置抽取非敏感目标，核对双 custom domain、APP_URL、KV 与 Hyperdrive。
- [database-preflight.json](database-preflight.json)：生产只读 SELECT 的迁移计数、seed 价格与模型状态；没有凭据、用户数据或模型正文。
- [secrets-preflight.json](secrets-preflight.json)：仅 secret 名称与缺项；Worker 必需项齐全，GitHub CI Cloudflare 两项仍待用户输入。

## 本地验证

| 命令 / 检查 | 结果 |
| --- | --- |
| `node --test scripts/production/production.test.mjs` | 12/12 通过 |
| `node scripts/production/check-wrangler-envs.mjs` | 退出 0；项目资源名、双域名、环境隔离通过 |
| `actionlint .github/workflows/deploy-production.yml` | 通过 |
| `pnpm check` | 退出 0；保留既有 lint warnings，无错误 |
| `pnpm typecheck` | 退出 0；17/17 tasks 成功 |
| `git diff --check` | 通过 |
| Playwright production `--list` | 西方 3 项、东方 6 项；仅发现用例，未冒充线上通过 |
| jobs `wrangler deploy --env production --dry-run --outdir dist --var APP_VERSION:<完整SHA>` | 退出 0，明确 `--dry-run: exiting now` |
| web `CLOUDFLARE_ENV=production APP_VERSION=<完整SHA> APP_URL/WEST_URL=https://arcanumber.com EAST_URL=https://ganjiday.com pnpm --filter @xuanxue/web build` | 退出 0；两个 local Hyperdrive 连接均为不可达 `127.0.0.1:1/unused`，未加载 Neon 凭据 |
| web `wrangler deploy --config dist/server/wrangler.json --dry-run` | 退出 0，明确 `--dry-run: exiting now` |

构建中的公开数据读取使用既有降级，保留既有 Server Function API 弃用警告；未上传 source map、未启用 Sentry。SSR dist 可能包含本地预览 dotenv，不提交或公开分享。本机完整日志保留于 `/tmp/xuanxue-launch-{jobs-dry-run,web-build,web-dry-run,check,typecheck}.log`，此目录仅提交脱敏结果。

## 尚未验收

生产发布等待：用户安全输入两项 CI 凭据；协调者合入工作流修正；同 SHA CI 与 staging 成功；tag 发布时由用户审批 production。其后才能记录双站完整 SHA、真实注册/删号、六页 Lighthouse、GSC sitemap「成功」、Bing 导入和 Web Analytics 手动片段 token。不会用 dry-run、用例发现或旧 staging 的结果替代这些验收。


## v0.1.0 最新实测（2026-10-20 UTC）

- [production-actions.json](production-actions.json)：完整 SHA、workflow 与各步骤 success，含东方 6 / 西方 3 只读冒烟。
- [production-heartbeat.json](production-heartbeat.json)：17:00 UTC 健康复查仍为 db.up / 同 SHA，jobs.lastCronAt 暂为 null，尚未观察到 Cron 心跳。
- [production-http.json](production-http.json)：双域 28 个 HTTP 验收，全部通过。
- [production-browser.json](production-browser.json)：注册/重新登录通过，删号失败；Google 授权待确认；GSC 两站成功、Bing 待登录、Analytics 待处理。
- [lighthouse-summary.json](lighthouse-summary.json)：六页移动端审计条件与指标；[lighthouse/](lighthouse/) 含逐页 ZIP 内原始 HTML/JSON。西方首页 LCP 未达标；无现场 INP，不用 TBT 冒充 INP。

最新待办以 [上线记录](../../launch-v1.md) 为准；上文凭据和部署尚未执行仅为历史记录。此轮只提交运维证据与文档，不修改应用、工作流、支付、价格或模型。

Lighthouse 每页 ZIP 包含该次未改写的 `.report.html` 与 `.report.json`；归档后逐字节核验一致，解压 HTML 可查看完整报告。
