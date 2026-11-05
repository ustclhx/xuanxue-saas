import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { Button, DataTable, Input, Label } from '@xuanxue/ui'
import { useState } from 'react'
import { createKey, editKey, listKeys } from '../../../features/api-keys/functions.ts'
import { SpacePage } from '../../../features/app-shell/space-frame.tsx'
import { appTableLabels } from '../../../features/app-shell/table-labels.ts'
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
          const expires = String(values.get('expires') ?? '')
          setSecret(null)
          void action(async () => {
            const key = await createKey({
              data: {
                slug,
                name: String(values.get('name') ?? ''),
                ...(expires ? { expiresAt: new Date(expires).toISOString() } : {}),
              },
            })
            setSecret(key.key)
            form.reset()
          })
        }}
      >
        <Label htmlFor="key-name">{m.api_keys_name()}</Label>
        <Input id="key-name" name="name" required maxLength={80} />
        <Label htmlFor="key-expires">{m.api_keys_expires_label()}</Label>
        <Input id="key-expires" name="expires" type="datetime-local" />
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
              row.expiresAt ? new Date(row.expiresAt).toLocaleString() : m.api_keys_never_expires(),
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
