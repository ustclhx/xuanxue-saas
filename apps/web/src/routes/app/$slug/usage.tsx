import { createFileRoute, notFound as featureNotFound } from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { SpacePage, SpacePanel } from '../../../features/app-shell/space-frame.tsx'
import { getCustomerUsage } from '../../../features/billing/customer.functions.ts'
import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'

export const Route = createFileRoute('/app/$slug/usage')({
  beforeLoad: () => {
    if (!templateConfig.credits.enabled) throw featureNotFound()
  },
  loader: ({ params }) => getCustomerUsage({ data: { slug: params.slug } }),
  staleTime: 0,
  component: UsagePage,
})
function UsagePage() {
  const initial = Route.useLoaderData()
  const { slug } = Route.useParams()
  const [page, setPage] = useState(initial)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => setReady(true), [])
  useEffect(() => setPage(initial), [initial])
  async function next(kind: 'ledger' | 'batches') {
    const cursor = kind === 'ledger' ? page.ledger.nextCursor : page.batches?.nextCursor
    if (!cursor) return
    setBusy(true)
    setMessage('')
    try {
      const result = await getCustomerUsage({ data: { slug, kind, cursor, limit: 25 } })
      setPage((old) =>
        kind === 'ledger'
          ? { ...old, ledger: result.ledger }
          : { ...old, batches: result.batches, balance: result.balance },
      )
    } catch {
      setMessage(m.billing_usage_error())
    } finally {
      setBusy(false)
    }
  }
  return (
    <SpacePage
      title={m.billing_usage_title()}
      description={
        page.balance
          ? m.billing_usage_balance({
              available: page.balance.available,
              held: page.balance.held,
              debt: page.balance.debt,
            })
          : m.billing_usage_own_activity()
      }
    >
      {page.batches && (
        <SpacePanel title={m.billing_usage_batches()}>
          <table className="w-full text-left text-sm [&_td]:border-line [&_td]:border-b [&_td]:py-3 [&_th]:border-line [&_th]:border-b [&_th]:py-2 [&_th]:font-semibold [&_th]:text-ink-muted">
            <thead>
              <tr>
                <th>{m.billing_usage_source()}</th>
                <th>{m.billing_usage_granted()}</th>
                <th>{m.billing_usage_remaining()}</th>
                <th>{m.billing_status()}</th>
                <th>{m.billing_usage_expiry()}</th>
              </tr>
            </thead>
            <tbody>
              {page.batches.items.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.source}</td>
                  <td>{batch.amount}</td>
                  <td>{batch.remaining}</td>
                  <td>{batch.status}</td>
                  <td>
                    {batch.expiresAt
                      ? new Date(batch.expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC' })
                      : m.billing_usage_no_expiry()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {page.batches.items.length === 0 && <p>{m.billing_usage_no_batches()}</p>}
          <Button
            disabled={!ready || busy || !page.batches.nextCursor}
            onClick={() => void next('batches')}
          >
            {m.billing_usage_older_batches()}
          </Button>
        </SpacePanel>
      )}
      <SpacePanel title={m.billing_usage_ledger()}>
        <table className="w-full text-left text-sm [&_td]:border-line [&_td]:border-b [&_td]:py-3 [&_th]:border-line [&_th]:border-b [&_th]:py-2 [&_th]:font-semibold [&_th]:text-ink-muted">
          <thead>
            <tr>
              <th>{m.billing_date()}</th>
              <th>{m.billing_usage_type()}</th>
              <th>{m.billing_usage_credits()}</th>
              <th>{m.billing_usage_reference()}</th>
              <th>{m.billing_usage_batch()}</th>
            </tr>
          </thead>
          <tbody>
            {page.ledger.items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })}</td>
                <td>{item.type}</td>
                <td>
                  {item.delta > 0 ? '+' : ''}
                  {item.delta}
                </td>
                <td>
                  {item.refType}
                  {item.refId ? ` · ${item.refId}` : ''}
                </td>
                <td>{item.grantId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {page.ledger.items.length === 0 && <p>{m.billing_usage_no_activity()}</p>}
        <Button
          disabled={!ready || busy || !page.ledger.nextCursor}
          onClick={() => void next('ledger')}
        >
          {m.billing_usage_older_activity()}
        </Button>
      </SpacePanel>
      {message && <p role="status">{message}</p>}
    </SpacePage>
  )
}
