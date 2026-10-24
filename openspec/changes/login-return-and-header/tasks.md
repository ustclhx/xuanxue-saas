## 1. 登录去向

- [x] 1.1 `signInDestination()` 改为：`/account`、接受邀请、本站合法回跳，都没有时返回站点首页；`AFTER_SIGN_IN_PATH` 不再作为登录默认值。验证：单元测试覆盖四种输入（有效回跳、非法回跳、无回跳、`/account`）。
- [x] 1.2 `verify-email` 的「继续」入口改为站点首页。验证：邮箱验证成功页的链接指向首页。
- [x] 1.3 页头登录入口携带当前路径（`/login?redirect=<当前路径>`）。验证：浏览器 QA 中从 `/ko` 点击登录，登录后回到 `/ko`；e2e 用例未在本地运行。

## 2. 认证页语言

- [x] 2.1 认证页在没有 `locale-preference` Cookie 时，服务端按 Accept-Language 302 到带语言前缀的同一页面，不写 Cookie。验证：`auth-locale.test.ts` 覆盖四种情况；curl 确认东方站 `/login`（ko-KR）返回 302 到 `/ko/login?redirect=…`，带偏好 Cookie 时返回 200。
- [x] 2.2 认证页移除语言建议与语言选择器（`auth-layout.tsx` 的 footer 与 `LanguageControls` 的认证页用法）。验证：浏览器 QA 中 `/ko/login` 页面只在右上角有语言图标，底部无语言下拉。

## 3. 页头右上角控件

- [x] 3.1 新建页头组件：语言图标下拉（当前站点语言列表，选择后沿用 `saveLanguagePreference` 与 `rememberLocale`），账户图标（未登录链接到登录页；已登录的下拉在水合后显示）。验证：浏览器 QA 分别在未登录与已登录状态下检查两种图标；可点区域为 44px（`min-h-11 min-w-11`）。
- [x] 3.2 账户下拉列出空间：个人空间始终列出，多租户开启时列出团队空间，选项导航到 `/app/$slug`。验证：浏览器 QA 从首页账户下拉进入个人空间；多租户开启与关闭的分支由 `viewer.functions.ts` 的过滤逻辑保证，未单独做浏览器验证。
- [x] 3.3 空间壳层 `routes/app/$slug/route.tsx` 使用同一页头，移除其中的「首页」链接与原 `WorkspaceSwitcher` 的 select。验证：浏览器 QA 截图，空间页与首页的右上角控件位置一致。
- [x] 3.4 移除根布局中的底部固定语言选择器（营销页的建议浮层保留）。验证：营销页不再出现左下角语言控件，建议浮层行为不变。
- [x] 3.5 页头文案补全 zh-Hant、zh-Hans、en、ko（语言控件标签、账户下拉标签、「个人空间」与「团队空间」标签、「首页」）。验证：`pnpm typecheck` 的消息编译无缺失报告。

## 4. 验收与文档

- [x] 4.1 更新 `docs/04-auth-and-tenancy.md` §3，补充登录后的去向与空间入口。验证：文档与 `specs/user-auth` 的规则一致。`docs/runbooks/` 的验收步骤未改，随 4.3 一并更新。
- [x] 4.2 `pnpm check`、`pnpm typecheck`、`pnpm test` 通过；`openspec validate login-return-and-header` 通过。验证：命令输出无新增错误。
- [ ] 4.3 线上（staging）手工验收：工具页登录回原页、直接登录回首页、首次访问认证页语言、页头切换语言、空间下拉进入个人空间。验证：记录到 `docs/runbooks/` 的验收条目中。
