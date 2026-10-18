# 平台能力

`packages/platform` 提供目标中立契约与 Cloudflare 适配。部署目标只有 Cloudflare Workers；中立契约保留，便于业务模块与测试注入能力。

## 入口与装配

业务仅从 `@xuanxue/platform` 导入中立类型、`NonRetryableError` 和 `requireCapability`。composition root（web `src/server.ts`、jobs `src/index.ts`）显式导入 `@xuanxue/platform/cloudflare`，不使用条件导出或万能 bindings env。中立入口不读取 process.env、不加载 `cloudflare:*`。

| 能力 | 中立契约 | CF 装配 |
| --- | --- | --- |
| env | `PlatformEnv<C>`，只读已校验标量配置及能力表 | `createCloudflareEnv` 接收 app schema 校验后挑选的标量，binding 引用留在入口 |
| db | `DatabaseAccess.business()/public()`，返回现有 `Database` | `createCloudflareDatabase` 在每请求/事件内创建，分别使用 HYPERDRIVE / HYPERDRIVE_CACHED，闭包限于该次调用，不结束 workerd 客户端 |
| KV | `KeyValueStore`，text/JSON get、string put、秒 TTL、delete | `createCloudflareKv` 使用原 KV binding，TTL 至少 60 秒 |
| 限流 | `RateLimiter.limit('auth'|'ai'|'api', key)` | 原 RL_AUTH / RL_AI / RL_API；保留 key 与限额，缺 binding 拒绝执行 |
| 延续 | `BackgroundTasks.waitUntil(promise)` | `createCloudflareBackgroundTasks(ctx)` 保留 ctx receiver 和原 Promise，CF 继续管理生命周期 |
| 请求 | `RequestMetadata`，应用 requestId、可空 clientIp、可选 cfRay | `createCloudflareRequestMetadata(request)` 仅由可信 CF 入口调用；cf-ray 只是附加字段 |

适配器不能放在模块全局并缓存请求资源；入口每次请求/事件创建适配器并注入业务上下文。

## 任务契约

`packages/platform/test/contracts.ts` 是中立类型夹具，随中立类型检查执行。

| 文件 / 导出 | 行为 | 实现约束 |
| --- | --- | --- |
| `src/queue.ts` / `QueueProducer<T>` | send(body,{delaySeconds?})、sendBatch([{body,delaySeconds?}])，返回 Promise<void> | 持久投递，retry/backoff/concurrency/rate 由队列配置决定 |
| `QueueMessage<T>` / `QueueBatch<T>` | 稳定 id、body、attempts、timestamp，逐条/整批 ack/retry | 至少一次投递；未 ack 重投；耗尽后保留死信 |
| `TransactionalEnqueue<T>` / `DatabaseTransaction` | enqueue(tx,body)，事务类型取自现有 db.transaction 回调参数 | 同一 PG 事务或 outbox，回滚不投递；CF 当前不提供（available:false） |
| `DeadLetterSink<T>` / `QueueFailure` | failed(message,{code,retryable})，与 ack/retry 分开 | 对有效消息的不可重试/耗尽失败持久记录，完成后才确认；CF 不装配，邮件消费者保留 ack/drop |
| `src/workflow.ts` / `Workflow<P,R>` | create({id?,params})、get(id)，instance.status/terminate/sendEvent | 业务稳定 id；参数、事件、步骤结果只用 JSON；缺实例/终态发事件明确报错 |
| `WorkflowStatus` | queued/running/paused/waiting/completed/failed/terminated | 引擎状态映射到中立枚举，不向业务暴露原生对象 |
| `WorkflowStep` | do(name,callback) 或 do(name,{retries:{limit,delayMs,backoff},timeoutMs},callback)，sleep(name,durationMs)，waitForEvent(name,{type,timeoutMs}) | 成功步骤持久化、重启续跑；事件按 type FIFO 单次消费，早到事件至少保留 60 分钟 |
| `NonRetryableError` | 共享的不可重试异常，CF 转换为原引擎异常；引擎拒绝时还原为共享类型并保留 `code`（引擎 rejection 放在 `cause`） | 不重试该步骤 |
| `src/scheduler.ts` / `Scheduler` | register({id,cron,timeZone,missedRun:'skip'|'once'},handler)，handler 收到 scheduledAt:Date；health() | jobs 内调度、锁互斥、补跑策略、心跳；健康读取最近成功 cron 时间 |
| `src/capabilities.ts` / `TaskHealth` | queue() → {status}；scheduler() → {status,lastCronAt}，status 为 up/down/unavailable，lastCronAt 为 UTC ISO 或 null | 实时 backend/consumer readiness 和 scheduler heartbeat，不能用 DB 可达推断 queue up |

`Workflow<P,R>` 的 P/R 受 `JsonValue` 约束；结构性参数对象使用 type alias（如 `type MediaParams = { taskId: string; requestId?: string }`），避免 interface 缺少 JSON 索引签名。步骤结果的 `JsonValue` 类型禁止流、Date 和二进制进入持久化结果。现有媒体 runner 中使用的 `10 seconds` / `2 minutes` / `15 minutes` 在迁移时分别写为 `10_000` / `120_000` / `900_000` 毫秒。业务超时、终态检查、提交幂等规则不变。

`Workflow<P,R>` 的 P/R 受 `JsonValue` 约束；结构性参数对象使用 type alias（如 `type MediaParams = { taskId: string; requestId?: string }`），避免 interface 缺少 JSON 索引签名。步骤结果的 `JsonValue` 类型禁止流、Date 和二进制进入持久化结果。retry delay/timeout 以毫秒表示（如 `10_000` / `120_000` / `900_000`）。

Cloudflare Workflow 将 complete 映射到 completed、errored 映射到 failed，waitingForPause/rollingBack 视为 running；unknown 明确返回 WORKFLOW_NOT_FOUND。get 验证原生 handle 是否存在，终态事件返回 WORKFLOW_TERMINAL；发送时发生的原生错误继续传播。step adapter 原样转发毫秒 retry/backoff/timeout、sleep 和事件等待，转换共享 NonRetryableError。邮件消费者的有效消息最终失败保留 ack/drop。

CF `cloudflareTransactionalEnqueue()` 返回 available:false。`requireCapability` 在调用方副作用前抛 CAPABILITY_UNAVAILABLE（503），不提供假成功或内存后端。

## Cloudflare Cron

`createCloudflareScheduler` 接收 Wrangler 已部署的 crons，注册仅接受 UTC + missedRun:skip。任意时区、once 补跑或未部署 cron 均明确拒绝。相同 cron 可注册不同 id 的独立任务，scheduled handler 用原 controller.scheduledTime 生成 scheduledAt，allSettled 保证一项失败不阻止其他项；成功时间由既有业务心跳写库，适配器不伪造 lastCronAt。`createCloudflareTaskHealth` 组合明确传入的队列探测与 scheduler.health；CF 没有原生队列 ping，不假装验证消费者就绪。

当前 jobs 的五条 UTC triggers 保持原配置和分派：

| Cron | 既有分派 |
| --- | --- |
| `*/5 * * * *` | 删除清理后记录心跳 |
| `0 3 * * *` | 空间清理与日指标，独立执行 |
| `0 * * * *` | 每小时计费维护 |
| `*/10 * * * *` | 计费补偿与文件清理，独立执行 |
| `0 4 * * *` | 每日计费维护 |

## 导入边界

业务目录不允许 `cloudflare:*`。检查器解析静态/动态 import、export、require 与 type import，明确登记的目标入口/夹具和平台 CF 目录才允许对应导入（[项目结构 §1](02-project-structure.md#1-monorepo-目录)）。web 的 `server/cloudflare/env.ts` 与 `server/cloudflare/sentry.ts` 是显式 CF composition 辅助入口；绑定声明和只含目标类型的测试逐文件登记。

`apps/web/tsconfig.neutral.json` 在默认 typecheck 中检查整个中立 src，不加载 Workers 全局声明，排除 CF entry、绑定声明和 CF composition 辅助文件；CF 另行检查完整 src 和目标夹具。

## web 请求 runtime

`apps/web/src/server/runtime.ts` 导出中立 `WebRuntime`、`getWebRuntime()` 和 `withWebRuntime(runtime, handler)`。AsyncLocalStorage 隔离每个请求，`apps/web/src/server.ts` 在环境校验后装配；同一个 requestId 用于日志与响应。数据库和认证使用请求内惰性 getter，公开页面不会因建立上下文而提前连接数据库。

| runtime 字段 | 使用方式 |
| --- | --- |
| `config` | 已校验的认证标量与 Turnstile site key；不含 bindings，不能整个返回前端 |
| `db` / `auth` | 本请求的业务 facade 与认证实例；实时守卫继续查数据库 |
| `cache` / `rateLimiter` | 平台 KV / 限流契约，限流传入 auth、ai、api policy |
| `requestMeta` | 入口解析的可信 clientIp、应用 requestId 和可选 cfRay |
| `createAuth(db, cache?)` | 为后台事务 facade 与延后提交缓存创建认证实例 |
| `handleAuthRequest(request)` | 保留后台 HTTP 白名单、模拟限制、实时守卫与事务审计 |

`createWebAuth(config, db, deps)` 是中立认证工厂。composition 注入发信 sender、注册准入和删除步骤；CF 发信使用 EMAIL_QUEUE，仅等待入队。Server Function / API handler 使用 `const runtime = getWebRuntime()` 获取 db、auth、config；已有事务或其他 facade 时用 `runtime.createAuth(db)`。审计取 `runtime.requestMeta.clientIp`，防刷调用 `runtime.rateLimiter.limit('ai'|'api', key)`，不重新读取 CF/XFF 头。

`WebRuntime.files` 注入 `Capability<Storage>`，`publicDb` 为惰性的公开读 facade。文件 HTTP 与 RPC 在副作用前检查文件能力，媒体提交 POST 也先检查存储。Cloudflare storage 工厂在 web/jobs entry 装配，接口见 [storage README](../packages/storage/README.md)。公开定价读取接受借用的 Database；公开页沿用数据库不可达降级。

## 验证

- `pnpm --filter @xuanxue/platform typecheck`：中立类型无 Workers 声明，另行检查 CF 适配器和测试类型。
- `pnpm --filter @xuanxue/platform test`：CF batch 确认/重试，Workflow 状态与事件边界，step 参数与异常转换，UTC Cron 独立执行，KV JSON/TTL。
- `pnpm check:deps`：工程扫描加检查器正反例。
