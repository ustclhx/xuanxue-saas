// 令牌页的加载与错误状态（项目扩展）：路由的 pendingComponent 不参与按路由拆包，
// 单独成模块，避免它把整页（弹窗、表格与 UI 组件）带进每个页面的入口包（首页包预算）。
import { AdminPage } from '@web/features/admin/ui.tsx'
import { m } from '@web/paraglide/messages.js'
import { Button } from '@xuanxue/ui'
import { CircleAlert } from '@xuanxue/ui/icons'

export function ApiTokensSkeleton() {
  return (
    <AdminPage title={m.admin_mcp_title()} className="max-w-5xl">
      <div
        role="status"
        aria-label={m.admin_mcp_loading()}
        className="grid gap-3 rounded-xl p-4 inset-ring inset-ring-border"
      >
        <span className="h-4 w-2/5 animate-pulse rounded-md bg-active" />
        <span className="h-4 w-2/3 animate-pulse rounded-md bg-active" />
        <span className="h-4 w-1/2 animate-pulse rounded-md bg-active" />
      </div>
    </AdminPage>
  )
}

export function ApiTokensError({ onRetry }: { onRetry: () => void }) {
  return (
    <AdminPage title={m.admin_mcp_title()} className="max-w-5xl">
      <div role="alert" className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        <span className="flex-1 text-sm">{m.admin_mcp_load_failed()}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {m.admin_mcp_retry()}
        </Button>
      </div>
    </AdminPage>
  )
}
