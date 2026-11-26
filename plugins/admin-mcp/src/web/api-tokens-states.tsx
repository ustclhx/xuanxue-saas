import { AdminPage } from '@web/features/admin/ui.tsx'
import { m } from '@web/paraglide/messages.js'
import { Button } from '@xuanxue/ui'
import { CircleAlert } from '@xuanxue/ui/icons'

export function ApiTokensError({ onRetry }: { onRetry: () => void }) {
  return (
    <AdminPage title={m.admin_mcp_title()} className="max-w-5xl">
      <div role="alert" className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        <span className="flex-1 text-body">{m.admin_mcp_load_failed()}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {m.admin_mcp_retry()}
        </Button>
      </div>
    </AdminPage>
  )
}
