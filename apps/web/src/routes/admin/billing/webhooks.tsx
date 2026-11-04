import { createFileRoute, notFound as featureNotFound, useRouter } from '@tanstack/react-router'
import { Button, DataTable } from '@xuanxue/ui'
import { useState } from 'react'
import {
  adminListPage,
  adminListSearch,
  filtersToSearch,
  offsetOfPage,
} from '../../../features/admin/list.ts'
import { AllSitesNotice, siteFilter, siteLabel } from '../../../features/admin/site-ui.tsx'
import { AdminPage, adminTableLabels } from '../../../features/admin/ui.tsx'
import { getAdminWebhooks, replayAdminWebhook } from '../../../features/billing/admin.functions.ts'
import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'

const filters = ['workspaceId', 'site'] as const
export const Route = createFileRoute('/admin/billing/webhooks')({
  beforeLoad: () => {
    if (!templateConfig.billing.enabled) throw featureNotFound()
  },
  validateSearch: (search: Record<string, unknown>) => adminListSearch(filters)(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getAdminWebhooks({ data: { ...deps, site: deps.site === 'all' ? 'all' : undefined } }),
  component: Webhooks,
})
function Webhooks() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { admin } = Route.useRouteContext()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function replay(id: string) {
    setBusy(true)
    try {
      const result = await replayAdminWebhook({ data: { webhookEventId: id } })
      setMessage(result.ok ? result.status : m.admin_replay_unavailable({ error: result.error }))
      await router.invalidate()
    } catch {
      setMessage(m.admin_replay_unavailable_reload_to_check_the_saved_record())
    } finally {
      setBusy(false)
    }
  }
  return (
    <AdminPage
      title={m.admin_webhook_events()}
      description={m.admin_events_without_an_associated_workspace_appear_only_when()}
    >
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <AllSitesNotice site={search.site} />
      <DataTable
        labels={adminTableLabels()}
        label={m.admin_webhook_events()}
        rows={data.rows}
        getRowId={(row) => row.id}
        columns={[
          {
            id: 'site',
            header: m.admin_site(),
            // 无法关联空间的事件没有站点，两站后台都可重放
            cell: (row) =>
              row.sites.length ? row.sites.map(siteLabel).join(' / ') : siteLabel(null),
          },
          { id: 'provider', header: m.admin_provider(), cell: (row) => row.provider },
          { id: 'event', header: m.admin_event(), cell: (row) => row.providerEventId },
          { id: 'type', header: m.admin_type(), cell: (row) => row.type },
          { id: 'status', header: m.admin_status(), cell: (row) => row.status },
          { id: 'attempts', header: m.admin_attempts_label(), cell: (row) => row.attempts },
          {
            id: 'replay',
            header: m.admin_replay(),
            cell: (row) =>
              row.sites.some((site) => site !== admin.site) ? (
                <span className="text-muted-foreground">
                  {m.admin_other_site_billing_record({
                    site: row.sites.map(siteLabel).join(' / '),
                  })}
                </span>
              ) : row.status === 'failed' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !row.replayAvailable}
                  onClick={() => void replay(row.id)}
                >
                  {row.replayAvailable
                    ? m.admin_replay_failed_event()
                    : m.admin_replay_unavailable_provider_not_configured()}
                </Button>
              ) : (
                <span className="text-muted-foreground">
                  {m.admin_only_failed_events_can_be_replayed()}
                </span>
              ),
          },
        ]}
        page={adminListPage(search.offset, data)}
        filters={[{ id: 'workspaceId', label: m.admin_workspace_id() }, siteFilter(admin.site)]}
        filterValues={{ workspaceId: search.workspaceId, site: search.site }}
        onPageChange={(page) =>
          void navigate({ search: { ...search, offset: offsetOfPage(page) } })
        }
        onFiltersChange={(values) => void navigate({ search: filtersToSearch(filters, values) })}
      />
    </AdminPage>
  )
}
