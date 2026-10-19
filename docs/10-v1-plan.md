# 10 · v1 上线计划（塔罗 / 命理 AI 工具站）

需求来源：`doc/design.md`（SEO 交接文档 v1.1）。2026-10-19 用户决定：模板单仓 + 预渲染；v1 范围 = 双站骨架 + 台湾八字 + 韩国만세력 + 英语生命灵数 + 塔罗抽牌 + L1 邮件 + L2 付费详批；生成到本仓库并新建私有 GitHub 仓库；域名暂用占位。
视觉规范：[design/visual-system.md](design/visual-system.md)。并行规则沿用 [09 §2–§3、§6](09-parallel-plan.md)，本文只给出 v1 的任务拆分与波次。

## 0. 进度（2026-10-19 长任务结束时）

| change | 状态 |
|---|---|
| `remove-selfhost-target` | 4/4，已归档 |
| `add-dual-site-foundation` | 12/12，已归档 |
| `add-bazi-saju-chart` | 13/13，已归档（含 10 例公开排盘交叉抽查） |
| `add-numerology-tools` | 5/5，已归档 |
| `add-tarot-reading` | 8/8，已归档 |
| `add-reading-monetization` | 10/11：剩 5.1（staging 真实模型抽检），D1 已定测试用 DeepSeek `deepseek-flash`（本地已真实调用验证），待 staging 启用 |
| `launch-v1-production` | 1/6：剩 2.1–3.2，需要域名与各平台账号（见 [v1-decisions.md](v1-decisions.md)） |

额外完成：本地 Lighthouse 预检与首屏修复（CLS 全部 < 0.1；LCP 需在生产 Brotli/HTTP2 下复测，见 `docs/runbooks/evidence/perf-audit/2026-10-19.md`）、结果页 Turnstile 懒加载、staging 发布开关。

## 1. OpenSpec change

| change | 内容 | 任务数 |
|---|---|---|
| `add-dual-site-foundation` | 双站点、zh-Hant/ko、跨域 hreflang、站点地图、跨站认证、工具页外壳与主题 | 12 |
| `add-bazi-saju-chart` | `@xuanxue/bazi` 引擎、繁中八字/紫微/命盤、韩语만세력/궁합、16 个概念页 | 13 |
| `add-numerology-tools` | `@xuanxue/numerology`、西方站首页、计算器、12 数字页 | 5 |
| `add-tarot-reading` | `@xuanxue/tarot`、四种牌阵三语页、78×3 牌义页 | 8 |
| `add-reading-monetization` | L1 结果后订阅 + 个性化邮件；L2 付费完整分析（积分 + AI） | 11 |
| `launch-v1-production` | 法律/免责、生产部署、Lighthouse、GSC/Bing、AI 目录 | 6 |
| `remove-selfhost-target` | 删除自托管交付层、Node 运行时、模板生成器与旧验收证据，只保留 Cloudflare 路径 | 4 |

## 2. 波次与执行者

按用户全局规则（`~/.claude/CLAUDE.md`「Development workflow for larger projects」）分工：**Claude** 负责复杂开发、UI/视觉与代码审阅；**Codex** 负责简单代码、内容批量页、部署与浏览器操作；协调者（Claude）写 spec、监控、审阅 PR、合并。每波最多 3 个 worker。

记法同 09 §5：每个反引号名称是一个 Orca 任务（worktree / 分支 `wt/<名称>`）；`→` 表示等前一步合并进 main。

| 波次 | 任务（change 编号） | 执行者 | 依赖 |
|---|---|---|---|
| W0 | `rm-node-runtime`（remove-selfhost-target 2.1、2.2、3.1；1.1 由协调者完成） | Claude | main |
| W1 | `fd-sites-i18n`（foundation 1.1–1.3） | Claude | `rm-node-runtime` |
| W1 | `bazi-engine`（bazi 1.1–1.5） | Claude | main |
| W1 | `pkg-num-tarot`（numerology 1.1–1.2、tarot 1.1–1.3） | Codex | main |
| W2 | `fd-shell`（foundation 4.1–4.3） | Claude | `fd-sites-i18n` |
| W2 | `fd-auth`（foundation 3.1–3.2） | Claude | `fd-sites-i18n` |
| W2 | `fd-seo`（foundation 2.1–2.4） | Codex | `fd-sites-i18n` |
| W3 | `bazi-pages`（bazi 2.1–2.3、3.1–3.2） | Claude | W2 + `bazi-engine` |
| W3 | `num-pages`（numerology 2.1–2.3） | Claude | W2 + `pkg-num-tarot` |
| W3 | `tarot-pages`（tarot 2.1–2.3） | Claude | W2 + `pkg-num-tarot` |
| W4 | `readings-core`（monetization 1.1–1.2、2.1–2.3） | Claude | `fd-auth`、`bazi-engine` |
| W4 | `bazi-longtail`（bazi 4.1–4.3） | Codex | `bazi-pages` |
| W4 | `tarot-meanings`（tarot 3.1–3.2） | Codex | `tarot-pages` |
| W5 | `readings-ui`（monetization 2.4、3.1–3.2） | Claude | `readings-core` |
| W5 | `readings-optin`（monetization 4.1–4.2） | Codex | `readings-core` |
| W5 | `legal-pages`（launch 1.1） | Codex | W2 |
| W6 | staging 部署 + monetization 5.1 抽检；decision gate 后 launch 2.1–3.2 | Codex（部署/浏览器），协调者审阅 | 全部 |

W0 与 W1 的 `bazi-engine`、`pkg-num-tarot` 同时运行（后两者只新增独立包，不冲突）；`fd-sites-i18n` 等 `rm-node-runtime` 合并后再开始。待用户决策的事项统一记录在 [v1-decisions.md](v1-decisions.md)。

季节峰优先级：东方站页面（`bazi-pages` / `bazi-longtail`）在资源冲突时优先排期；`fd-auth` 不阻塞免费工具上线。AI 详批的模型在骨架完成后由用户选定（高性价比），`readings-core` 先用 fake provider 测试，不写死模型。

## 3. 共享文件约定（v1 补充）

- 文案：每个工具一个文件 `messages/<locale>/{bazi,numerology,tarot,readings,readings-email,site}.json`。
- 新包：`packages/{bazi,numerology,tarot}`，各自在 `scripts/check-deps.rules.json` 加规则；冲突时保留两边条目。
- 工具路由注册：`apps/web/src/features/tools/registry.ts` 的 `TOOL_ROUTES` 每个工具一行，冲突时合并两边。
- schema：只有 `readings-core` 新增 `packages/db/src/schema/readings.ts` 并修改 growth 列，按 09 §3 不提交迁移。
- 本地 PG：本项目容器 `xuanxue-pg` 映射宿主机 **5433**（5432 被 `saas-template-pg` 占用）。

## 4. Worker 启动

按 09 §6 的步骤，第 2 步终端命令按执行者选择：

```
# Claude worker
claude --dangerously-skip-permissions --model claude-opus-5-5
# Codex worker（本机 Codex 配置的默认模型）
codex --dangerously-bypass-approvals-and-sandbox
```

Claude worker 的 spec 第一行用「执行 /opsx:apply <change>」，Codex 用「按 .agents/skills/openspec-apply-change/SKILL.md 的流程实施」。

Task spec 模板：

```
你是 <名称> worker。在本 worktree 中按 .agents/skills/openspec-apply-change/SKILL.md 的流程实施 change <change>，只做 tasks.md 中的 <编号>。
先完整阅读该 change 的 proposal/design/specs/tasks、docs/10-v1-plan.md 与 docs/design/visual-system.md（涉及 UI 时同时阅读 docs/design/prototypes/ 中对应原型）。
遵守 docs/09-parallel-plan.md §3 与 docs/10-v1-plan.md §3 的共享文件规则。
每个检查点执行 orca worktree set --worktree path:<路径> --workspace-status in-progress --comment "<一句中文进度>"；阻塞时 comment 写「阻塞：<原因>」并停下等待协调者。
密钥只放本地被忽略的 .dev.vars / .env.local 或 Wrangler/GitHub secrets，绝不提交到仓库（仓库是公开的）；开 PR 前按 .agents/skills/security-scan/SKILL.md 扫描本次变更。
完成标准：pnpm check、pnpm typecheck、pnpm check:deps、相关测试通过；只勾选上述编号；推送分支 wt/<名称> 并开 PR 到 main（描述含验证结果与未完成验收），然后把状态改为 in-review。
```

协调者按用户全局约定监控：每约 45 秒 `orca terminal read`，连续两次尾部不再出现 `Working (` / `esc to interrupt` 即视为停止，再检查 PR 与终端尾部并答复。合并后同时确认 main 的 CI 与部署流水线成功。

## 5. 不在 v1

法语（量待重核）、荷兰/德语/意大利语站与 Lenormand、52 张扑克牌义、angel numbers、60 일주页、古籍/文章库、L3 联盟入口、土耳其（建议砍）。
