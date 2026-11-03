# Design

## Context

- **部署结构**：一个 web Worker 同时服务 ganjiday.com（东方站）与 arcanumber.com（西方站），两站共用一个 Postgres 数据库，站点由请求 Host 解析（`apps/web/src/features/site/site.ts` 的 `resolveSite`）。staging 的 workers.dev 地址属于预览 Host，按西方站渲染。
- **认证**：使用 Better Auth 1.7.7 和 drizzle adapter，实例按请求创建（`packages/auth/src/auth.ts` 的 `createAuth`）。会话有三层存储：Cookie 缓存、KV、数据库。Cookie 按域名分开，所以两站本来就不共享登录状态。
- **数据归属**：
  - `user.email` 全局唯一（`packages/db/src/schema/auth.ts`）；
  - 注册时创建个人空间，`organization.id = user.id`（`packages/auth/src/personal-workspace.ts`）；
  - 积分、购买、付款、退款申请、报告、文件与 API key 都挂在空间或用户下，并且都不记录站点。
- **按邮箱查找用户的入口**：除 Better Auth 之外，应用里直接按邮箱查用户的地方约有 30 个文件。主要是后台用户搜索、团队邀请、管理员引导、删号、计费回调、设置页与指标 Cron。
- **生产现状**：生产（v0.1.10）还没有接通 PayPal（`enable-paypal-checkout` 的 6.2 尚未完成），因此预计没有真实付款。存量数据主要是注册用户、赠送或后台发放的积分，以及详批报告。

## Goals / Non-Goals

**Goals**

- 同一邮箱在两站是两个完全独立的账户：密码、两步验证、第三方登录关联、资料、空间、积分与全部记录都互相独立。
- 一个站点的会话、验证码、重置链接与 OAuth 关联，在另一个站点一律无效。隔离由数据层保证，不依赖每个调用点自己记得加条件。
- 后台能按站点查看用户和空间。
- 存量数据有明确、可审阅的归属规则；有歧义的数据交 Owner 决定。

**Non-Goals**

- 不拆分数据库，也不拆分 Better Auth 密钥、R2、PayPal 商户或 Worker。
- 不提供跨站合并或迁移账户的功能。
- 电子报订阅与等候名单不是账户，本 change 不改它们的邮箱唯一规则（电子报已有 `site` 列）。

## Decisions

### 决策 1：账户站点只来自请求 Host

- server 入口先用 `resolveSite` 得到当前站点，再传给 `createAuth`。
- 预览 Host（staging、localhost 未知 Host）一律视为 `west`。
- 站点不来自请求体、查询参数或 Cookie，客户端无法指定。
- jobs 不经过 Host。需要站点时，从 `user.site` 或 `organization.site` 读取。

**备选**：用 locale 推断站点。否决：西方站用户也可能使用中文浏览器，Host 才是唯一可靠的来源。

### 决策 2：在 adapter 层按站点隔离 Better Auth 的读写

- `createAuth` 接收 `site`，把 drizzle adapter 包一层：
  - 对 `user`、`account`、`verification` 三个模型，`findOne`、`findMany`、`count`、`update`、`updateMany`、`delete`、`deleteMany`、`consumeOne`、`incrementOne` 的 `where` 自动追加 `site = 当前站点`；
  - `create` 自动写入 `site`；`update`、`updateMany`、`incrementOne` 不允许修改 `site`；
  - `transaction` 交给回调的 adapter 也同样包装。本项目的 drizzle adapter 没有开启真实事务，Better Auth 会把未包装的内层 adapter 交给回调，注册、OTP 与重置都走这条路径，所以必须显式包装；
  - `advanced.database.joins` 保持关闭：关闭时关联行在包装层之外读取，包装层在结果中剔除其他站点的关联行；
  - 1.7.7 的 adapter 成员以外的方法，在构建包装时直接报错。
- 三张表增加 `site` 列，并在 Better Auth 中声明为 `additionalFields`（`input: false`），让 adapter 的字段映射认得这一列，客户端也不能写入。
- `session`、`twoFactor`、`apikey` 通过 `userId` 关联到已经按站点隔离的用户，因此不需要 `site` 列。读会话时取到的用户不属于当前站点，就视为未登录（见决策 3）。

**理由**：Better Auth 内部按邮箱查用户的路径很多，包括登录、注册、找回密码、OTP、magic link、OAuth 关联与改邮箱。在 adapter 层统一追加条件，可以一次覆盖全部路径，升级时也只需要重跑隔离测试。

**备选与否决**：
- 每站一个 Postgres schema：迁移与运维成本高，后台也无法统一查询。
- 给 identifier 和 accountId 加站点前缀：会改写 Better Auth 的语义，读出时还要剥离前缀，更脆弱。

**实施前置**：第一项任务是一个 spike，在 1.7.7 上确认以下几点，再动其他任务。
- `user`、`account`、`verification` 三个模型都支持 `additionalFields`；
- 包装后，adapter 的 `where` 能使用这个字段；
- 事务路径（注册时在事务中创建 user 和 account）也被覆盖。

如果 `verification` 不支持 `additionalFields`，降级方案是在包装层给 `identifier` 加 `<site>:` 前缀：写入时加上，查询时把条件里的值也加上前缀。这条路径只在包装层里出现，而且要有测试覆盖。

**spike 结论（1.1，PR #103）**：三个模型都支持 `additionalFields`（`required` 字段必须有 `defaultValue`，取当前站点，create 时由包装层覆盖），`where` 与事务路径均可覆盖，不需要 identifier 前缀降级。另有三点：

- **验证值不走 KV**：Better Auth 读验证值时先查 KV，KV 不经过 adapter，spike 中东方站发起的 OAuth state 能被西方站回调接受。`kvSecondaryStorage` 对 `verification:` 键一律不读写，验证值只以数据库为准。`deletion.ts` 原本想以插件 `init` 达到同样效果，但 Better Auth 合并插件 options 时已有配置优先，那段代码不生效，在 2.2 中删除。
- **原生 SQL 写验证值**：`verification-reservation.ts`（插入与加锁）和 `deletion.ts`（清理时的插入与查询）绕过 adapter，2.2 中要补上 `site`，预约的唯一性判断也要带站点。
- Better Auth 的 drizzle schema 校验挂在内层 adapter 上，包装后不执行；目前未开启运行时 schema 校验，暂不处理。

### 决策 3：会话读取再校验一次站点

- Cookie 缓存与 KV 二级存储可能不经过 adapter，直接返回会话和用户。
- 在 web 侧取会话的统一入口（`getSession` 封装）中校验：`session.user.site !== 当前站点` 时按未登录处理，并写一条 `auth.cross_site_session` 日志。
- 这层校验是兜底。正常情况下，Cookie 按域名隔离，跨站请求根本带不上对方的会话。
- spike 证实这层不能省：Cookie 缓存与 KV 会话不经过 adapter，带着东方站缓存 Cookie 的请求在西方站仍会读到东方站用户；从数据库读取时，包装层剔除关联行后会按未登录处理。

### 决策 4：邮箱唯一改为 `(site, email)`

- `user_email_unique` 改为 `user_site_email_unique (site, email)`。
- 删号后的占位邮箱 `deleted+<id>@invalid` 本身就唯一，不受影响。
- 改邮箱时的唯一校验交给 Better Auth，经 adapter 包装后自动带上站点。

### 决策 5：空间归属站点

- `organization` 增加 `site` 列（not null）。个人空间创建时写入用户所在站点；团队空间写入创建者所在站点。
- `organization.id = user.id` 的约定保持不变：每个站点账户本来就是不同的 user。
- `withWorkspace` 与 `/app/<slug>` 的空间解析校验 `organization.site = 当前站点`，不一致时返回 404。
- 积分、计费、报告、文件、Chat 等按空间限定的数据因此自动按站点隔离，这些表都**不增加** `site` 列。

### 决策 6：应用层按邮箱的查询必须带站点

- 按 Context 中的清单逐个改造：凡是「已知邮箱、要找用户」的查询，都加 `site` 条件。
- 「已知 userId、读取 email」的查询不需要改。
- 新增 `scripts/check-site-scope.mjs`，纳入 `pnpm check`：
  - 扫描 `apps`、`packages` 中把 `user.email`（drizzle 写法）或 `"user"`/`u.email`（SQL 写法）用作查询条件的语句；
  - 同一条语句里没有 `site` 条件就报错；
  - 例外写在脚本内的白名单里，并注明理由。

### 决策 7：后台按站点

- 后台在两站都可以访问。管理员是各站点自己的账户（见 admin-bootstrap 规格）。
- 用户、空间与审计列表增加「站点」列与筛选（当前站点 / 全部站点），默认显示当前站点。
- 后台的「全部站点」视图是唯一允许跨站读取的入口，只读；写操作（封禁、调整积分、恢复空间）只能作用于选中记录所在的站点。
- 模拟登录只允许当前站点的用户，因为会话 Cookie 写在当前域名下，跨站模拟会立刻被决策 3 拦截。
- 指标 Cron 按站点分别统计用户数与付费数。

### 决策 8：存量迁移

迁移分三步：

1. **只读预检**：新脚本 `scripts/production/split-accounts-preflight.mjs`，只用 readonly 连接。
   - 按决策 9 的规则，算出每个用户的建议站点；
   - 输出汇总数字，以及「两站都有活动」和「无任何依据」两份清单；
   - 结果写到仓库外的证据目录，不写入数据库。
2. **迁移 SQL**：
   - 先给 `user`、`account`、`verification`、`organization` 加可空的 `site` 列；
   - 按规则回填，Owner 指定的例外取自一份覆盖表（迁移内的 `values` 列表，只含 userId 与站点，不含邮箱）；
   - 改为 `not null`；
   - 去掉旧的唯一约束，建立 `(site, email)` 唯一约束；
   - 删除全部 `verification` 行：作废现有的验证码与重置链接，用户重新申请即可。
3. **会话**：现有会话保留。用户被分到 A 站后，B 站的旧会话会因为决策 3 自动失效，用户需要在 B 站重新注册。

**预演**：先在 staging 上执行，再在生产的 Neon 分支（从生产复制的临时分支）上预演一次，对比预检报告和迁移后的计数是否一致。生产执行要等 Owner 批准，并放在发版窗口内。

**跨站活动用户不自动拆分**：这类用户的积分与报告混在同一个空间里，而积分批次并不记录来源站点，拆分无法保证正确。默认把整个空间留在主站点，由 Owner 逐个确认；需要拆分时，另行手工处理（新建另一站账户，再由后台调整积分）。

### 决策 9：站点判定规则（迁移用）

按以下顺序判定，命中即停：

1. Owner 覆盖表中有该用户；
2. 用户有详批报告：八字、紫微、四柱、宫合判为 `east`，灵数判为 `west`。塔罗两站都有，不作为依据。两类都有时，列入「两站都有活动」清单，并按报告较多的一方给出建议；
3. 有付款或购买：看付款时的 locale 与订单描述；
4. `user.locale`：zh-Hant、zh-Hans、ko 判为 `east`，en 判为 `west`；
5. 以上都没有：使用 D1 的默认站点。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| Better Auth 升级后 adapter 调用形状变化，包装漏掉某个方法 | 可能跨站查出用户 | 包装层对未知方法直接报错，不透传；新增隔离测试覆盖注册、登录、OTP、magic link、重置、OAuth、改邮箱、删号；`check:singletons` 锁定 better-auth 版本，升级时必须重跑 |
| 应用层漏改按邮箱的查询 | 后台或回调操作到另一站的用户 | 决策 6 的检查脚本纳入 `pnpm check`；单测断言两站同邮箱各自独立 |
| 存量用户被分错站 | 用户在原来使用的站点找不到积分或报告 | 先只读预检，再由 Owner 审阅清单；保留覆盖表；迁移前对生产做快照（Neon 分支） |
| 用户困惑：在另一站用同一邮箱登录失败 | 支持负担 | 登录失败页提示「两站账户分开，需要分别注册」，文案不透露该邮箱是否在另一站存在；FAQ 与法律页说明 |
| 管理员需要在两站各注册一次 | 运维多一步 | 写入发布清单；引导名单两站通用 |
| KV 中缓存的旧会话 | 迁移后短时间内仍可在错误站点使用 | 决策 3 的读取校验立即生效，不依赖缓存过期 |

## Migration Plan

1. 合并实现 PR，并在 staging 跑隔离验收：两站同邮箱注册、余额隔离、会话跨站失效、重置链接跨站失效、后台筛选。
2. 对生产执行只读预检，产出报告，Owner 审阅并给出覆盖表与 D1、D2 的决定。
3. 在生产的 Neon 分支上预演迁移，计数与预检一致。
4. Owner 批准后发版（迁移 → jobs → web），复核两站 `/api/health` 与隔离冒烟。
5. 合并 #93 法律页，并复核两站法律页文案与行为一致。

**回滚**：迁移保留旧数据，只新增列并调整约束。如需回滚应用代码，`(site, email)` 唯一约束可以保留，不影响旧代码读写；但如果两站已经产生了同邮箱账户，旧代码登录会出现歧义。因此回滚窗口只在「上线后、出现第一个同邮箱双站注册之前」，超过这个窗口就只能前滚修复。

## Open Questions / 决策记录

| # | 问题 | 选项 | 建议 | 状态 |
|---|---|---|---|---|
| D0 | 隔离层级 | 分站身份 / 共用登录 + 分站空间 | — | **已定：分站身份** |
| D1 | 没有任何依据的存量用户默认分到哪个站 | east / west / 按预检数字再定 | 先跑预检，看数量与注册时间再定；预计数量很少 | 待 Owner（看预检后） |
| D2 | 两站都有活动的存量用户怎么处理 | 整体留在主站点 / 手工拆分 | 整体留在主站点，个别手工拆分 | 待 Owner（看预检后） |
| D3 | 登录失败时是否提示「两站账户分开」 | 提示 / 不提示 | 提示，但不透露该邮箱是否在另一站存在 | 建议 |
| D4 | 后台「全部站点」视图是否保留 | 保留只读 / 只看当前站 | 保留只读，方便排查同一人的两个账户 | 建议 |
