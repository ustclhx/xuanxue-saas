## Why

登录后默认落在 `/app` 空间页，访客从工具页点击登录后无法回到原页面；空间页与公共页之间没有回站点的入口。认证页的语言选择打断首次访问，语言与空间入口分散在底部浮层和页脚里，没有统一的页头位置。

## What Changes

- 登录成功后的去向改为：带有合法回跳地址时回到该页面（保留语言前缀）；没有回跳地址时回到站点首页，不再默认进入 `/app`。**BREAKING**：直接访问 `/login` 登录的用户不再落在空间页，改为首页，需要从页头进入空间。
- 公共页头的登录入口携带当前页面作为回跳地址；注册、邮箱验证完成后的「继续」入口同样改为站点首页。
- 首次访问认证页（没有语言偏好记录）时不展示语言选择或建议浮层，直接按浏览器语言显示；用户手动切换后才记住选择。
- 站点页头右上角统一放置两个控件，参考 openfate 的布局：
  - 语言地球图标，下拉列出当前站点的语言，选择后切换；
  - 账户图标：未登录时进入登录页；已登录时下拉列出可进入的空间（个人空间始终存在），选择即进入对应 `/app/$slug`。
- 空间壳层（`/app/$slug`）使用同一页头，不再单独维护回站点的链接。
- 移除原底部固定语言选择器与认证页脚中的语言选择器；营销页的语言建议浮层保留，后台侧栏保留自己的语言控件。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `user-auth`：新增「登录后的去向」，规定回跳地址与默认首页的规则。
- `workspace-tenancy`：修改「团队空间开关」，多租户关闭时只隐藏团队空间的切换与创建，个人空间入口保留；新增「空间入口」，规定页头右上角的空间列表。
- `i18n`：修改「语言选择与记忆」，认证页首次访问直接采用浏览器语言，语言切换统一放在页头。
- `marketing-site`：新增「站点页头」，规定右上角的语言与账户控件在公共页面和空间页一致出现。

## Impact

- 代码：`apps/web/src/features/auth/auth-client.ts`（`AFTER_SIGN_IN_PATH`、`signInDestination`）、`apps/web/src/features/marketing/site-header.tsx`、`apps/web/src/features/i18n/language-controls.tsx`、`apps/web/src/features/auth/auth-layout.tsx`、`apps/web/src/routes/__root.tsx`、`apps/web/src/routes/app/$slug/route.tsx`、`apps/web/src/features/workspace/components.tsx`、`apps/web/src/features/i18n/preference.ts`、`(auth)/verify-email.tsx`。
- 文案：页头新增的图标按钮、下拉项、「首页」与空间相关文案需补全 zh-Hant / zh-Hans / en / ko。
- 测试：登录回跳的单元测试（`return-path` 已有），页头与空间入口的 e2e。
- 不涉及：数据库、支付、套餐、后台侧栏。
- 本次范围外：营销页上已有的语言建议浮层（`LanguageControls` 的 suggestion）保持不变，见 design.md 的待定事项。
