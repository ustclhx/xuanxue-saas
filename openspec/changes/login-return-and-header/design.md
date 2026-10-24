## Context

- 登录入口分散：公共页头的「登录」按钮（`site-header.tsx`）不带回跳地址；只有解锁报告、账户删除、账户中心、接受邀请等入口带 `redirect`。
- 登录默认去向是 `AFTER_SIGN_IN_PATH = '/app'`（`auth-client.ts`），规格见 `openspec/specs/workspace-tenancy` 与 `docs/04-auth-and-tenancy.md` §3。
- 回跳校验已有 `safeReturnPath()`（`features/site/return-path.ts`），只接受本站相对路径，排除 `/api`、认证页与内部路径。
- 语言：locale 策略为 `url` + `baseLocale`（`scripts/i18n-project.ts`），`/login` 无前缀时服务端输出默认语言；Accept-Language 目前只用于客户端建议（`preference.ts` 的 `preferredLocale`）。
- 空间切换器 `WorkspaceSwitcher` 仅在 `multiTenant=true` 时渲染，且只存在于空间壳层。
- 空间壳层 `routes/app/$slug/route.tsx` 不使用站点页头。

## Goals / Non-Goals

- Goals：登录后回到发起页面，无发起页面时回首页；认证页首次访问无语言选择；页头右上角统一语言与账户/空间入口。
- Non-Goals：不改支付与套餐；不改后台侧栏；不新增语言；不改营销页语言建议浮层的判定规则；不做移动端汉堡菜单（openfate 的菜单图标本次不做，只保留语言与账户两个控件）。

## Decisions

### 1. 登录去向：回跳优先，否则首页
- `signInDestination()` 的顺序改为：`/account`、接受邀请 URL、`safeReturnPath(redirect)`，都没有时返回站点首页 `/`（当前语言前缀由 `localizeUrl` 处理）。
- 公共页头登录入口与其他无 `redirect` 的登录入口改为携带当前路径：`/login?redirect=<当前路径含语言前缀>`；`/login` 本身与注册页的「已有账号」链接保持一致。
- 替代方案：把登录去向写死为 `/`，用 `document.referrer` 判断来源。拒绝：referrer 在 HTTPS 跨站与隐私设置下不可靠，且 `redirect` 参数已经是项目内统一的回跳机制。
- `verify-email` 的「继续」入口同样使用首页，与登录去向一致。

### 2. 认证页首次访问的语言
- 判定「首次访问」：请求没有 `locale-preference` Cookie（即用户从未手动选择或关闭建议）。
- 首次访问的 `/login`、`/register` 等无前缀认证页：服务端按 Accept-Language 通过 `preferredLocale()` 决定语言，若与本站默认语言不同，以 **302 到带语言前缀的同一页面**（`/ko/login?…`）返回。认证页在无前缀地址上固定使用默认语言，且客户端 locale 策略只识别 URL 前缀，所以语言只能由地址决定；这样 SSR 与水合一致，没有语言闪烁。该跳转不写 Cookie，因此不记为用户选择。
- 替代方案：在服务端只改写渲染语言、保留无前缀地址。拒绝：客户端水合时 locale 只读 URL，会与服务端输出不一致。
- 不采用客户端 `navigator.language`：会在水合后替换文案，造成闪烁与 CLS。
- 只跳转到本站已配置的语言；其他站点的语言不跨站跳转。
- 认证页不再渲染语言建议浮层与选择器；用户通过页头语言图标手动切换后写入 Cookie 并记住。

### 3. 页头右上角控件
- 语言图标按钮（下拉）：列出当前站点的语言（`templateConfig.sites[site].locales`），当前语言标记为选中；选择后沿用现有 `saveLanguagePreference` + `rememberLocale` 流程，并导航到目标语言的同一页面。
- 账户图标按钮：
  - 未登录：直接链接到 `/login?redirect=<当前路径>`。
  - 已登录：下拉列出可进入的空间，个人空间始终在列；多租户开启时列出团队空间。选项是 `<Link to="/app/$slug">`，不走 `activateWorkspace` 的切换接口（进入空间只读取路径，不改会话的活跃空间）。
- 两个控件使用 `@xuanxue/ui` 现有的下拉组件；可点区域满足 44px 最小触控尺寸（视觉规范）。
- 空间壳层与公共页共用同一页头组件，移除空间壳层中单独的「首页」链接（上一轮的改动）。

### 4. 空间切换器
- `multiTenant=false` 时：隐藏团队空间的切换与创建，但个人空间入口保留（账户下拉始终可进入个人空间）。
- `WorkspaceSwitcher` 的 select 形式移入页头下拉，选择即导航。

## Risks / Trade-offs

- [首页 `/` 对东方站是语言入口页，已登录用户回到那里看不到工具] → 东方站 `/` 显示语言入口与工具列表（已有），登录后用户可从页头进入空间；本次不改东方站首页内容。
- [直接访问 `/login` 的老用户习惯落在 `/app`] → 这是 BREAKING；在发布说明中注明，页头账户下拉提供直达入口。
- [首次访问按 Accept-Language 渲染但不写 Cookie，用户改了浏览器语言后下次仍会变化] → 可接受：这正是「默认浏览器语言」的含义；用户一旦手动切换即固定。
- [页头 SSR 时拿不到用户会话] → 账户控件先按未登录渲染，水合后再根据会话切换为已登录下拉（与现有 `HydratedControls` 模式一致），避免服务端读取会话破坏营销页预渲染。
- [营销页预渲染不能依赖实时数据库] → 页头的会话读取只在客户端完成；未登录的预渲染页面结构不变。

## Migration Plan

- 无数据迁移。
- 发布后：验证登录回跳（工具页→登录→回原页）、直接登录→首页、首次访问认证页的语言、页头语言切换、已登录空间下拉。
- 回滚：恢复 `AFTER_SIGN_IN_PATH` 与原页头即可，不涉及数据。

## Open Questions

- 营销页语言建议浮层是否也改为页头控件触发（不再自动弹出）？本次不改，待你确认。
- 账户下拉在多团队空间较多时的列表长度与滚动，本次按最多 `maxWorkspacesPerUser` 条直接列出。
