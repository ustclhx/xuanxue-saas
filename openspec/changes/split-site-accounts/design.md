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
- 每个存量用户在两站各有一个账户；原有空间与数据按明确规则留在其中一站，不拆分。

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
- **实施（2.2 / 2.3）**：三层各自校验，不一致时按未登录处理并记录 `auth.cross_site_session`（字段 `layer` 为 `cookie` / `kv` / `database`）：
  - **KV 键带站点命名空间**：`kvSecondaryStorage` 把所有键写成 `auth:<site>:<key>`（`authCacheKey`），一个站点写入的会话副本在另一站根本读不到；读出的会话副本再核对一次 `user.site`。验证值（`verification:` 键）仍然只存数据库，删号依赖这一点。删号清理清单（`verification` 行）记录站点，jobs 重试时按该列删除对应命名空间的键。上线前写入的旧键（`auth:<key>`）不再被读取：读会话时 KV 未命中，回退数据库后按新键重建，旧键随 TTL 过期，不需要迁移。
  - **Cookie 缓存**：Cookie 本来按域名隔离；兜底用 Better Auth 的 `session.cookieCache.version`：本站用户的版本为 `site:<site>`，另一站用户的版本每次随机，缓存因版本不符被丢弃，改读 KV / 数据库。
  - **数据库**：Better Auth 经 site-adapter 读取（关联行被剔除即未登录）；应用侧直接查库的 `requireFreshSession` / `checkSessionInDatabase` 带上站点核对。web 没有单独的 `getSession` 封装，服务端页面与接口都经 `requireFreshSession`，因此核对放在这里。

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

### 决策 8：存量迁移：每个老用户拆成两站各一个账户

Owner 已定（2026-11-03）：现有用户都是测试用户，全部拆成两站各自独立的用户。

迁移分三步：

1. **只读预检**：新脚本 `scripts/production/split-accounts-preflight.mjs`，只用 readonly 连接。
   - 按决策 9 的规则，算出每个用户的原始账户留在哪个站（以下称「主站点」）；
   - 输出汇总数字：用户数、将新建的副本账户数、各站分到的空间数，以及付款、购买、详批报告、积分批次的计数；
   - 「两站都有活动」的用户单列出来，仅供核对，不需要 Owner 逐个决定；
   - 结果写到仓库外的证据目录，不写入数据库。
2. **迁移 SQL**：
   - 先给 `user`、`account`、`verification`、`organization` 加可空的 `site` 列；
   - 按决策 9 回填：原用户、其 `account` 行和其拥有的空间都写入主站点；
   - 为每个原用户在另一站新建一个副本用户：
     - 新的 UUIDv7 id，复制邮箱、姓名、头像、邮箱验证状态、locale 与角色；
     - 复制登录方式：`account` 行（密码哈希、Google 关联）各复制一份，`site` 为另一站；两步验证如有，同样复制；
     - 新建一个空的个人空间（id 等于副本用户 id，副本为 owner），不复制积分、订单、付款、退款申请、报告或团队成员关系；
     - 不复制会话；
   - 改为 `not null`；
   - 去掉旧的唯一约束，建立 `(site, email)` 唯一约束；
   - 删除全部 `verification` 行：作废现有的验证码与重置链接，用户重新申请即可。
   - **实施（2.1，`0018_split_site_accounts.sql`）**：
     - 副本主键在 SQL 中按 RFC 9562 生成 UUIDv7（`clock_timestamp()` 毫秒 + `gen_random_uuid()` 随机位，版本位改为 7），与 `newId()` 同为时间有序；PG 17 没有 `uuidv7()`，也不在迁移中建函数。副本与原用户的对应关系在同一条语句的 CTE 中完成；
     - 密码账户的 `account_id` 改为副本用户 id（Better Auth 以用户 id 作为密码账户的 account_id），第三方账户保留提供方标识；
     - 已删号（匿名化）的账户也生成副本以保持「用户数翻倍」，副本同样匿名、封禁，不建空间；
     - 团队空间取最早的 owner 成员（创建者）所在站点；已软删、没有成员的团队取删除审计中的原 owner；原用户在另一站团队中的成员关系转给该站的副本，保证团队成员同站；
     - 付款证据同时指向两站的用户（预检的 `unresolvedUsers`）会让迁移报错中止，等 Owner 决定后再执行，不自行猜测；
     - 迁移不标注 `rollback-safe`：迁移完成即出现两站同邮箱账户，下文「回滚」的窗口实际为零，只能向前修复；迁移与 web 发布之间旧 web 写入不带站点会失败，需放在发版窗口内。
3. **会话**：现有会话保留，属于原用户。原用户在主站点继续登录；另一站的旧会话会因为决策 3 失效，用户在另一站用原来的密码或 Google 重新登录，进入副本账户。

**预演**：先在 staging 上执行，再在生产的 Neon 分支（从生产复制的临时分支）上预演一次，对比预检报告和迁移后的计数：用户数应为原来的两倍，副本空间余额为 0，原有空间与数据计数不变。生产执行要等 Owner 批准，并放在发版窗口内。

**数据不拆分**：积分批次并不记录来源站点，拆分无法保证正确，所以原有空间整体留在主站点。两站都有活动的用户，在另一站看到的是空账户；这些都是测试用户，接受这个结果。

### 决策 9：主站点判定规则（迁移用）

按以下顺序判定，命中即停：

1. 用户有详批报告：八字、紫微、四柱、宫合判为 `east`，灵数判为 `west`。塔罗两站都有，不作为依据。两类都有时，按报告较多的一方，相等时判为 `west`，并列入「两站都有活动」清单；
2. 有付款或购买：看付款时的 locale 与订单描述；
3. `user.locale`：zh-Hant、zh-Hans、ko 判为 `east`，en 判为 `west`；
4. 以上都没有：判为 `west`（staging 预览 Host 也按西方站处理）。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| Better Auth 升级后 adapter 调用形状变化，包装漏掉某个方法 | 可能跨站查出用户 | 包装层对未知方法直接报错，不透传；新增隔离测试覆盖注册、登录、OTP、magic link、重置、OAuth、改邮箱、删号；`check:singletons` 锁定 better-auth 版本，升级时必须重跑 |
| 应用层漏改按邮箱的查询 | 后台或回调操作到另一站的用户 | 决策 6 的检查脚本纳入 `pnpm check`；单测断言两站同邮箱各自独立 |
| 原有数据留错站 | 用户在原来使用的站点只看到空的副本账户 | 先只读预检核对主站点分布；迁移前对生产做快照（Neon 分支）；现有用户均为测试用户，影响有限 |
| 用户困惑：在另一站用同一邮箱登录失败 | 支持负担 | 登录失败页提示「两站账户分开，需要分别注册」，文案不透露该邮箱是否在另一站存在；FAQ 与法律页说明 |
| 管理员需要在两站各注册一次 | 运维多一步 | 写入发布清单；引导名单两站通用 |
| KV 中缓存的旧会话 | 迁移后短时间内仍可在错误站点使用 | 决策 3 的读取校验立即生效，不依赖缓存过期 |

## Migration Plan

1. 合并实现 PR，并在 staging 跑隔离验收：两站同邮箱注册、余额隔离、会话跨站失效、重置链接跨站失效、后台筛选。
2. 对生产执行只读预检，产出报告交 Owner 核对。
3. 在生产的 Neon 分支上预演迁移，计数与预检一致。
4. Owner 批准后发版（迁移 → jobs → web），复核两站 `/api/health` 与隔离冒烟。
5. 合并 #93 法律页，并复核两站法律页文案与行为一致。

**回滚**：迁移保留旧数据，只新增列并调整约束。如需回滚应用代码，`(site, email)` 唯一约束可以保留，不影响旧代码读写；但如果两站已经产生了同邮箱账户，旧代码登录会出现歧义。因此回滚窗口只在「上线后、出现第一个同邮箱双站注册之前」，超过这个窗口就只能前滚修复。

## Open Questions / 决策记录

| # | 问题 | 选项 | 建议 | 状态 |
|---|---|---|---|---|
| D0 | 隔离层级 | 分站身份 / 共用登录 + 分站空间 | — | **已定：分站身份** |
| D1 | 存量用户怎么分站 | 只分到一个站 / 拆成两站各一个账户 | — | **已定（2026-11-03）：拆成两站各一个账户**，原有数据留在主站点（决策 8、9） |
| D2 | 两站都有活动的存量用户怎么处理 | 整体留在主站点 / 手工拆分 | — | **已定**：整体留在主站点，另一站为空的副本账户 |
| D3 | 登录失败时是否提示「两站账户分开」 | 提示 / 不提示 | 提示，但不透露该邮箱是否在另一站存在 | 建议 |
| D4 | 后台「全部站点」视图是否保留 | 保留只读 / 只看当前站 | 保留只读，方便排查同一人的两个账户 | 建议 |
