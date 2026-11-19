import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { Button, DataTable, Input, Label } from '@xuanxue/ui'
import { useState } from 'react'
import { createKey, editKey, listKeys } from '../../../features/api-keys/functions.ts'
import { SpacePage } from '../../../features/app-shell/space-frame.tsx'
import { appTableLabels } from '../../../features/app-shell/table-labels.ts'
import { LocalDateTime } from '../../../features/shared/local-date-time.tsx'
import { DateField, TimeField } from '../../../features/tools/date-field.tsx'
import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'

export const Route = createFileRoute('/app/$slug/api-keys')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(0, Math.floor(Number(search.page) || 0)),
  }),
  beforeLoad: () => {
    if (!templateConfig.billing.enabled || !templateConfig.features.publicApi) throw notFound()
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ params, deps }) => listKeys({ data: { slug: params.slug, page: deps.page } }),
  component: ApiKeysPage,
})

/**
 * 过期时间（本地时间）→ ISO：未填日期为空串（永不过期），时间缺省为当天 00:00；
 * 日期或时间无效时返回 null。日期、时间分段输入代替 datetime-local，避免控件文字随浏览器语言显示。
 */
function expiresAt(date: string, time: string): string | null {
  if (!date) return time ? null : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (time && !/^\d{2}:\d{2}$/.test(time))) return null
  const value = new Date(`${date}T${time || '00:00'}`)
  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

function ApiKeysPage() {
  const { slug } = Route.useParams()
  const { page } = Route.useSearch()
  const data = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function action(run: () => Promise<unknown>) {
    setPending(true)
    setError('')
    try {
      await run()
      await router.invalidate()
    } catch (error) {
      setError(error instanceof Error ? error.message : m.api_keys_error())
    } finally {
      setPending(false)
    }
  }
  return (
    <SpacePage title={m.api_keys_title()}>
      <p>{m.api_keys_description()}</p>
      {error ? <p role="alert">{error}</p> : null}
      {secret ? (
        <div role="status" className="grid gap-2 rounded border p-4">
          <p>{m.api_keys_save_secret()}</p>
          <code className="break-all">{secret}</code>
          <Button onClick={() => setSecret(null)}>{m.api_keys_close_secret()}</Button>
        </div>
      ) : null}
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const values = new FormData(form)
          const expires = expiresAt(
            String(values.get('expiresDate') ?? ''),
            String(values.get('expiresTime') ?? ''),
          )
          setSecret(null)
          if (expires === null) {
            setError(m.api_keys_error())
            return
          }
          void action(async () => {
            const key = await createKey({
              data: {
                slug,
                name: String(values.get('name') ?? ''),
                ...(expires ? { expiresAt: expires } : {}),
              },
            })
            setSecret(key.key)
            form.reset()
          })
        }}
      >
        <Label htmlFor="key-name">{m.api_keys_name()}</Label>
        <Input id="key-name" name="name" required maxLength={80} />
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField label={m.api_keys_expires_label()} name="expiresDate" />
          <TimeField label={m.date_field_time()} name="expiresTime" />
        </div>
        <Button disabled={pending} type="submit">
          {m.api_keys_create()}
        </Button>
      </form>
      <DataTable
        label={m.api_keys_title()}
        labels={appTableLabels()}
        rows={data.rows}
        getRowId={(row) => row.id}
        page={{ pageIndex: page, pageSize: 20, hasMore: data.hasMore }}
        onPageChange={(page) => {
          void navigate({ search: { page } })
        }}
        columns={[
          {
            id: 'name',
            header: m.api_keys_name(),
            cell: (row) => (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const name = String(new FormData(event.currentTarget).get('name') ?? '')
                  void action(() => editKey({ data: { slug, id: row.id, name } }))
                }}
              >
                <Input
                  name="name"
                  aria-label={m.api_keys_key_name()}
                  defaultValue={row.name ?? ''}
                  required
                  maxLength={80}
                />
                <Button disabled={pending} type="submit">
                  {m.api_keys_save()}
                </Button>
              </form>
            ),
          },
          { id: 'prefix', header: m.api_keys_prefix(), cell: (row) => <code>{row.start}…</code> },
          {
            id: 'expiry',
            header: m.api_keys_expiry(),
            cell: (row) =>
              row.expiresAt ? <LocalDateTime value={row.expiresAt} /> : m.api_keys_never_expires(),
          },
          {
            id: 'status',
            header: m.api_keys_status(),
            cell: (row) =>
              !row.enabled
                ? m.api_keys_revoked()
                : row.expiresAt && new Date(row.expiresAt) <= new Date()
                  ? m.api_keys_expired()
                  : m.api_keys_active(),
          },
          {
            id: 'revoke',
            header: m.api_keys_actions(),
            cell: (row) => (
              <Button
                disabled={pending || !row.enabled}
                variant="destructive"
                onClick={() => {
                  void action(() => editKey({ data: { slug, id: row.id, revoke: true } }))
                }}
              >
                {m.api_keys_revoke()}
              </Button>
            ),
          },
        ]}
      />
    </SpacePage>
  )
}
