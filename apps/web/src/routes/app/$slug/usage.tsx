import { createFileRoute, notFound as featureNotFound } from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { SpacePage, SpacePanel } from '../../../features/app-shell/space-frame.tsx'
import { getCustomerUsage } from '../../../features/billing/customer.functions.ts'
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
      setMessage('Unable to load usage. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <SpacePage
      title="Credit usage"
      description={
        page.balance
          ? `Available: ${page.balance.available} · Held: ${page.balance.held} · Debt: ${page.balance.debt}`
          : 'Your own credit activity is shown below.'
      }
    >
      {page.batches && (
        <SpacePanel title="Credit batches">
          <table className="w-full text-left text-sm [&_td]:border-line [&_td]:border-b [&_td]:py-3 [&_th]:border-line [&_th]:border-b [&_th]:py-2 [&_th]:font-semibold [&_th]:text-ink-muted">
            <thead>
              <tr>
                <th>Source</th>
                <th>Granted</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Expiry</th>
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
                      : 'No expiry'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {page.batches.items.length === 0 && <p>No credit batches yet.</p>}
          <Button
            disabled={!ready || busy || !page.batches.nextCursor}
            onClick={() => void next('batches')}
          >
            Older batches
          </Button>
        </SpacePanel>
      )}
      <SpacePanel title="Credit ledger">
        <table className="w-full text-left text-sm [&_td]:border-line [&_td]:border-b [&_td]:py-3 [&_th]:border-line [&_th]:border-b [&_th]:py-2 [&_th]:font-semibold [&_th]:text-ink-muted">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Credits</th>
              <th>Reference</th>
              <th>Batch</th>
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
        {page.ledger.items.length === 0 && <p>No credit activity yet.</p>}
        <Button
          disabled={!ready || busy || !page.ledger.nextCursor}
          onClick={() => void next('ledger')}
        >
          Older activity
        </Button>
      </SpacePanel>
      {message && <p role="status">{message}</p>}
    </SpacePage>
  )
}
