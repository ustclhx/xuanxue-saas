import { createFileRoute, useRouter } from '@tanstack/react-router'
import { m } from '@web/paraglide/messages.js'
import { getAdminApiTokens } from '../../src/web/api-tokens-list.functions.ts'
import { ApiTokensPage } from '../../src/web/api-tokens-page.tsx'
import { ApiTokensError } from '../../src/web/api-tokens-states.tsx'

// 后台 API 令牌页：守卫沿用 /admin 布局与 adminMiddleware，非管理员与其他后台页面一样 404。
// 项目不设 pendingComponent（与其他后台页一致）：它不参与按路由拆包，会进入每个页面的入口包
export const Route = createFileRoute('/admin/api-tokens')({
  loader: () => getAdminApiTokens(),
  staleTime: 0,
  head: () => ({ meta: [{ title: m.admin_mcp_title() }] }),
  component: TokensRoute,
  errorComponent: TokensError,
})

function TokensRoute() {
  return <ApiTokensPage data={Route.useLoaderData()} />
}

function TokensError() {
  const router = useRouter()
  return <ApiTokensError onRetry={() => void router.invalidate()} />
}
