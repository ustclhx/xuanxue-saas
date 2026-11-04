import { createFileRoute, Link } from '@tanstack/react-router'
import { DataTable } from '@xuanxue/ui'
import {
  adminListPage,
  adminListSearch,
  filtersToSearch,
  offsetOfPage,
} from '../../../features/admin/list.ts'
import { AllSitesNotice, siteFilter, siteLabel } from '../../../features/admin/site-ui.tsx'
import { AdminPage, adminTableLabels } from '../../../features/admin/ui.tsx'
import { getAdminUsers } from '../../../features/admin/users.functions.ts'
import { m } from '../../../paraglide/messages.js'

const filters = ['q', 'site'] as const
export const Route = createFileRoute('/admin/users/')({
  validateSearch: (search: Record<string, unknown>) => adminListSearch(filters)(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getAdminUsers({ data: { ...deps, site: deps.site === 'all' ? 'all' : undefined } }),
  component: Users,
})
function Users() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { admin } = Route.useRouteContext()
  return (
    <AdminPage title={m.admin_users()}>
      <AllSitesNotice site={search.site} />
      <DataTable
        labels={adminTableLabels()}
        label={m.admin_users()}
        rows={data.rows}
        getRowId={(row) => row.id}
        columns={[
          {
            id: 'email',
            header: m.admin_email(),
            cell: (row) => (
              <Link to="/admin/users/$id" params={{ id: row.id }} className="underline">
                {row.email}
              </Link>
            ),
          },
          { id: 'site', header: m.admin_site(), cell: (row) => siteLabel(row.site) },
          { id: 'name', header: m.admin_name(), cell: (row) => row.name },
          { id: 'id', header: m.admin_id(), cell: (row) => row.id },
          { id: 'role', header: m.admin_role(), cell: (row) => row.role ?? 'user' },
          {
            id: 'ban',
            header: m.admin_ban_status(),
            cell: (row) => (row.banned ? m.admin_banned() : m.admin_active()),
          },
        ]}
        page={adminListPage(search.offset, data)}
        filters={[
          { id: 'q', label: m.admin_search_users(), placeholder: m.admin_email_name_or_id() },
          siteFilter(admin.site),
        ]}
        filterValues={{ q: search.q, site: search.site }}
        onPageChange={(page) =>
          void navigate({ search: { ...search, offset: offsetOfPage(page) } })
        }
        onFiltersChange={(values) => void navigate({ search: filtersToSearch(filters, values) })}
      />
    </AdminPage>
  )
}
