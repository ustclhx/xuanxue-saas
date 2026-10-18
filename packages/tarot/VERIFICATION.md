# 包级验收与本地安全扫描

比较基准：`225dbeb`（已 rebase `origin/main`）；范围为本分支新增 numerology/tarot 包、静态图片、下载脚本、依赖边界规则、lockfile 与两个 change 的指定复选框。由 Codex 实施与核验。

## 验证结果

- `pnpm check`：退出 0；已有 4 条 Biome 环境变量警告。首次并发运行时 staging 健康测试的 100ms 时限断言失败，独立重跑全部检查通过，未修改测试。
- `pnpm typecheck`：退出 0，16/16 任务通过；本地空库缺少 plan 表，预渲染按原设计使用示例定价降级。
- `pnpm check:deps`：退出 0，8/8 测试通过（含新增纯包依赖边界）。旧命名空间检查器故障已通过 rebase main 的 `225dbeb` 修复。
- `pnpm --filter @xuanxue/numerology --filter @xuanxue/tarot test`：退出 0，6 个数字命理 + 4 个塔罗用例通过；包含 100,000 次十张抽牌，全部 78 张频率偏差 < 5%，逆位比例 49%–51%。
- `pnpm check:singletons`、`pnpm dedupe --check`、`git diff --check`：退出 0。
- `node scripts/tarot-images.mjs`：退出 0，156 个文件、78 条来源与许可记录；逐文件 `webpinfo` 解码检查通过，240w/480w 尺寸正确；总大小 10,189,200 字节（约 9.72 MiB）。抽查太阳牌视觉正确，保留扫描纹理。

## 安全扫描与边界审阅

按 `.agents/skills/security-scan/SKILL.md` 实际运行脱敏扫描：1490 文件、126 个候选、0 读取错误；扫描退出 1 表示候选待分类，**本次新增/修改文件候选为 0**。126 个候选全部来自基线；下表标记为测试/探针假值或本地数据库/文档占位连接。两个位于 src/node 的 HTTP 文件实际导入 Vitest 并创建测试身份，S3 错误密钥用于故障断言；动态 pg.endpoint 来自本地测试容器。

- 日期、数字、姓名和分享编码在导出入口校验；非法姓名不抹除日期结果，分享编码不携带姓名或问句。
- 新包不访问网络、数据库、账本或身份状态；不涉及租户鉴权、Webhook 或 AI 计费。
- 下载脚本仅使用 Commons 1909 扫描，核对作者/年代/许可和上传域名；使用参数数组调用 cwebp，不拼接 shell，临时目录在 finally 清理，429 有上限退避。
- 无新增日志中的隐私字段、密钥文件、迁移 SQL 或线上配置写入。
- 未覆盖 Git 历史、被忽略的本地 secret 文件、远端环境；未生成 web/jobs 生产构建产物，因本次是未接入页面的纯包与静态资源任务。

## 未完成验收

数字命理 2.1–2.3 和塔罗 2.1–3.2 页面、长文、SEO/e2e 由后续任务负责；本次不勾选。三语短义与相性表是娱乐性编辑规则，母语内容审阅随后续页面/牌义任务进行。图片总大小高于 proposal 中单套图片约 3MB 的粗估；页面需按设计使用 srcset、翻牌时加载和懒加载。

## 基线候选分类（不含匹配值）

| 位置 | 规则 | 分类 |
| --- | --- | --- |
| `.agents/skills/deploy-cloudflare/SKILL.md:39` | credential-url | 既有本地数据库/文档占位连接 |
| `.agents/skills/deploy-cloudflare/SKILL.md:40` | credential-url | 既有本地数据库/文档占位连接 |
| `.claude/skills/deploy-cloudflare/SKILL.md:39` | credential-url | 既有本地数据库/文档占位连接 |
| `.claude/skills/deploy-cloudflare/SKILL.md:40` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:35` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:36` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:44` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:98` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:99` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:106` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:148` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:149` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:150` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/ci.yml:156` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/deploy-production.yml:72` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/deploy-production.yml:73` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/deploy-staging.yml:64` | credential-url | 既有本地数据库/文档占位连接 |
| `.github/workflows/deploy-staging.yml:65` | credential-url | 既有本地数据库/文档占位连接 |
| `apps/jobs/test/media-hold-sweep.test.ts:138` | literal-secret | 既有测试/探针假值 |
| `apps/jobs/test/node-entry.unit.test.ts:62` | literal-secret | 既有测试/探针假值 |
| `apps/jobs/test/node-media-http.unit.test.ts:11` | literal-secret | 既有测试/探针假值 |
| `apps/jobs/test/node-observer-shutdown.integration.test.ts:79` | literal-secret | 既有测试/探针假值 |
| `apps/jobs/test/node-production.integration.test.ts:30` | literal-secret | 既有测试/探针假值 |
| `apps/jobs/test/node-smtp.integration.test.ts:47` | literal-secret | 既有测试/探针假值 |
| `apps/jobs/test/node-wire.integration.test.ts:33` | literal-secret | 既有测试/探针假值 |
| `apps/jobs/vitest.config.ts:11` | credential-url | 既有测试/探针假值 |
| `apps/jobs/vitest.config.ts:14` | credential-url | 既有测试/探针假值 |
| `apps/jobs/wrangler.jsonc:18` | credential-url | 既有本地数据库/文档占位连接 |
| `apps/jobs/wrangler.jsonc:23` | credential-url | 既有本地数据库/文档占位连接 |
| `apps/web/e2e/admin-users.spec.ts:163` | literal-secret | 既有测试/探针假值 |
| `apps/web/e2e/auth.spec.ts:13` | literal-secret | 既有测试/探针假值 |
| `apps/web/e2e/fixtures.ts:10` | literal-secret | 既有测试/探针假值 |
| `apps/web/e2e/i18n-preference.spec.ts:4` | literal-secret | 既有测试/探针假值 |
| `apps/web/e2e/staging-acceptance/fault-local-media.ts:13` | literal-secret | 既有测试/探针假值 |
| `apps/web/scripts/local-acceptance-admin.test.ts:25` | literal-secret | 既有测试/探针假值 |
| `apps/web/scripts/local-acceptance-admin.test.ts:28` | literal-secret | 既有测试/探针假值 |
| `apps/web/scripts/test-node-storage.mjs:167` | credential-url | 既有测试/探针假值 |
| `apps/web/scripts/test-node-storage.mjs:168` | credential-url | 既有测试/探针假值 |
| `apps/web/src/node/observability.test.ts:196` | credential-url | 既有测试/探针假值 |
| `apps/web/src/node/sentry-http.node.ts:76` | literal-secret | 既有测试/探针假值 |
| `apps/web/src/node/storage-http.node.ts:59` | literal-secret | 既有测试/探针假值 |
| `apps/web/src/node/storage-http.node.ts:262` | literal-secret | 既有测试/探针假值 |
| `apps/web/src/server/cloudflare/env.test.ts:18` | credential-url | 既有测试/探针假值 |
| `apps/web/src/server/cloudflare/env.test.ts:32` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/admin-action.test.ts:20` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/admin-and-account.test.ts:14` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/admin-users.test.ts:26` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/admin-users.test.ts:83` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/ai-media-tasks.test.ts:36` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/ai-media-tasks.test.ts:42` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/ai-media-tasks.test.ts:64` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/ai-media-tasks.test.ts:71` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/auth-email.test.ts:90` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/auth-email.test.ts:126` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/fixtures/ai-chat.suite.ts:49` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/fixtures/production-node/http.node.ts:23` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/fixtures/production-node/http.node.ts:82` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/fixtures/production-node/http.node.ts:99` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/fixtures/production-node/http.node.ts:317` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/node/auth-smtp.integration.node.ts:115` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/node/auth-smtp.integration.node.ts:116` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/node/auth-smtp.integration.node.ts:132` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/public-api.test.ts:58` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/public-api.test.ts:65` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/public-media.test.ts:79` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/public-media.test.ts:86` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/public-media.test.ts:170` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/public-media.test.ts:260` | literal-secret | 既有测试/探针假值 |
| `apps/web/test/workspace-context.test.ts:16` | literal-secret | 既有测试/探针假值 |
| `apps/web/vitest.config.ts:14` | credential-url | 既有测试/探针假值 |
| `apps/web/vitest.config.ts:17` | credential-url | 既有测试/探针假值 |
| `apps/web/vitest.config.ts:49` | credential-url | 既有测试/探针假值 |
| `apps/web/vitest.config.ts:50` | credential-url | 既有测试/探针假值 |
| `apps/web/wrangler.jsonc:19` | credential-url | 既有本地数据库/文档占位连接 |
| `apps/web/wrangler.jsonc:24` | credential-url | 既有本地数据库/文档占位连接 |
| `docs/runbooks/restore.md:51` | credential-url | 既有本地数据库/文档占位连接 |
| `packages/ai/src/text/model.test.ts:125` | credential-url | 既有测试/探针假值 |
| `packages/auth/probe/auth-cpu.probe.ts:71` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/account-settings.test.ts:116` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/account-settings.test.ts:145` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/account-settings.test.ts:189` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/email-verification.test.ts:125` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/fresh-session.test.ts:125` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/helpers.ts:21` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/helpers.ts:22` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/helpers.ts:37` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/node/auth.integration.test.ts:15` | credential-url | 既有测试/探针假值 |
| `packages/auth/test/node/auth.integration.test.ts:18` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/node/auth.integration.test.ts:149` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/password.test.ts:59` | literal-secret | 既有测试/探针假值 |
| `packages/auth/test/password.test.ts:84` | literal-secret | 既有测试/探针假值 |
| `packages/auth/vitest.config.ts:11` | credential-url | 既有测试/探针假值 |
| `packages/auth/vitest.config.ts:14` | credential-url | 既有测试/探针假值 |
| `packages/auth/vitest.config.ts:32` | credential-url | 既有测试/探针假值 |
| `packages/billing/src/paypal/recorded.test.ts:48` | literal-secret | 既有测试/探针假值 |
| `packages/billing/src/runtime.test.ts:90` | literal-secret | 既有测试/探针假值 |
| `packages/billing/src/runtime.test.ts:91` | literal-secret | 既有测试/探针假值 |
| `packages/billing/src/runtime.test.ts:199` | literal-secret | 既有测试/探针假值 |
| `packages/billing/src/runtime.test.ts:200` | literal-secret | 既有测试/探针假值 |
| `packages/billing/src/stripe/adapter.test.ts:139` | literal-secret | 既有测试/探针假值 |
| `packages/billing/src/stripe/recorded.test.ts:227` | literal-secret | 既有测试/探针假值 |
| `packages/config/src/email-env.test.ts:6` | credential-url | 既有测试/探针假值 |
| `packages/config/src/env.test.ts:14` | credential-url | 既有测试/探针假值 |
| `packages/config/src/env.test.ts:45` | literal-secret | 既有测试/探针假值 |
| `packages/config/src/env.test.ts:94` | literal-secret | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:16` | credential-url | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:142` | credential-url | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:180` | literal-secret | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:189` | literal-secret | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:193` | literal-secret | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:239` | literal-secret | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:265` | credential-url | 既有测试/探针假值 |
| `packages/config/src/node.test.ts:443` | literal-secret | 既有测试/探针假值 |
| `packages/db/drizzle.config.ts:7` | credential-url | 既有本地数据库/文档占位连接 |
| `packages/db/vitest.config.ts:10` | credential-url | 既有测试/探针假值 |
| `packages/db/vitest.config.ts:13` | credential-url | 既有测试/探针假值 |
| `packages/email/src/node/smtp.validation.test.ts:26` | literal-secret | 既有测试/探针假值 |
| `packages/email/src/node/test/smtp.test.ts:21` | literal-secret | 既有测试/探针假值 |
| `packages/shared/src/errors.test.ts:26` | credential-url | 既有测试/探针假值 |
| `packages/storage/test/wrangler.jsonc:10` | credential-url | 既有测试/探针假值 |
| `scripts/orca/setup.sh:47` | credential-url | 既有本地数据库/文档占位连接 |
| `scripts/orca/setup.sh:48` | credential-url | 既有本地数据库/文档占位连接 |
| `scripts/probes/latency/README.md:40` | credential-url | 既有本地数据库/文档占位连接 |
| `scripts/probes/latency/README.md:60` | credential-url | 既有本地数据库/文档占位连接 |
| `scripts/production/production.test.mjs:107` | credential-url | 既有测试/探针假值 |
| `scripts/production/production.test.mjs:120` | credential-url | 既有测试/探针假值 |
