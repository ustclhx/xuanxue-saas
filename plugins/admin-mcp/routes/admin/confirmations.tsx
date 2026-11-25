import { createFileRoute, useRouter } from '@tanstack/react-router'
import { adminListSearch } from '@web/features/admin/list.ts'
import { m } from '@web/paraglide/messages.js'
import { listAdminConfirmations } from '../../src/web/confirmations.functions.ts'
import { ConfirmationsError, ConfirmationsPage } from '../../src/web/confirmations-page.tsx'

// 后台待确认列表（openspec add-admin-step-up 任务 4.3）：守卫沿用 /admin 布局与 adminMiddleware。
// 项目不设 pendingComponent（与 api-tokens 页一致）：它不参与默认代码分割，会把列表页与 DataTable
// 带进每个页面的入口包（首页包预算）；后台布局统一显示加载提示
export const Route = createFileRoute('/admin/confirmations')({
  validateSearch: (search: Record<string, unknown>) => {
    const { offset, view } = adminListSearch(['view'])(search)
    return view === 'history' ? { offset, view: 'history' as const } : { offset }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listAdminConfirmations({ data: { view: deps.view ?? 'pending', offset: deps.offset } }),
  staleTime: 0,
  head: () => ({ meta: [{ title: m.admin_confirm_list_title() }] }),
  component: ConfirmationsRoute,
  errorComponent: ConfirmationsRouteError,
})

function ConfirmationsRoute() {
  const search = Route.useSearch()
  return (
    <ConfirmationsPage
      data={Route.useLoaderData()}
      view={search.view ?? 'pending'}
      offset={search.offset}
    />
  )
}

function ConfirmationsRouteError() {
  const router = useRouter()
  return <ConfirmationsError onRetry={() => void router.invalidate()} />
}
