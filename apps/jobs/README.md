# Jobs

Cloudflare 入口为 `src/index.ts`，导出 `AiMediaWorkflow` 与 fetch/queue/scheduled。
Wrangler 的五条 UTC Cron、队列重试配置、工作流绑定和 Sentry 启用条件保持原样。
入口每次事件校验 env、显式挑选支付标量，装配 platform 的数据库/KV/Queue/WorkflowStep
适配器；不跨事件保存数据库客户端。Sentry CF SDK 只由入口及其 `src/sentry.ts` 目标辅助模块加载。

业务入口是 `src/handlers.ts` 的 `consumeJobsBatch`、`runJobsSchedule` 与
`registerJobsSchedules`。`JobsContext` 注入 `DatabaseAccess`、`KeyValueStore`、
`QueueProducer`、邮件 transport、文件清理能力和 `JobObserver`，不接收原始 bindings。
日维护的空间清理/指标汇总、十分钟维护的计费/文件清理继续使用 allSettled；一项失败仍运行
另一项，最后报告整组失败。删除失效重试成功后才记录五分钟心跳。

## 验证

- `pnpm --filter @xuanxue/jobs typecheck`：源码与测试类型检查。
- `pnpm --filter @xuanxue/jobs test`：单元用例（`*.unit.test.ts`）及 workerd 集成用例；集成需要本 worktree 或 CI 隔离数据库配置。
- `pnpm --filter @xuanxue/jobs build`：`wrangler deploy --dry-run` 输出 `dist`。
