import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { authClient } from '../auth/auth-client.ts'
import { removeAccount, removeWorkspace } from './deletion.functions.ts'

export function DeletionSection({
  workspace,
  supportEmail,
  refundReminder,
}: {
  workspace?: { id: string; name: string }
  supportEmail: string
  refundReminder?: { eligibleCount: number; pendingCount: number; billingHref: string }
}) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const [blocked, setBlocked] = useState<{ id: string; name: string; slug: string }[]>([])
  const label = workspace ? workspace.name : 'DELETE'
  async function submit() {
    setBusy(true)
    setError('')
    try {
      const result = workspace
        ? await removeWorkspace({ data: { workspaceId: workspace.id } })
        : await removeAccount()
      if (result.ok) {
        window.location.assign(workspace ? '/app' : '/login')
        return
      }
      setCompleted(result.deletionCompleted)
      setError(result.deletionCompleted ? m.deletion_completed_cleanup_pending() : result.message)
      setBlocked(result.workspaces)
    } catch {
      setError(m.deletion_error_unknown())
    } finally {
      setBusy(false)
    }
  }
  async function signInAgain() {
    setBusy(true)
    try {
      const result = await authClient().signOut()
      if (result.error) throw new Error(result.error.message)
      window.location.assign('/login?redirect=%2Faccount')
    } catch {
      setError(m.deletion_signout_error())
      setBusy(false)
    }
  }
  return (
    <section className="grid gap-3 rounded-lg border border-destructive p-6">
      <h2 className="font-semibold text-xl">
        {workspace ? m.deletion_team_title() : m.deletion_account_title()}
      </h2>
      <p>{workspace ? m.deletion_team_description() : m.deletion_account_description()}</p>
      <p>
        {m.deletion_refund_notice()}{' '}
        <a className="underline" href={`mailto:${supportEmail}`}>
          {m.deletion_contact_support()}
        </a>
        {m.deletion_support_suffix()}
      </p>
      {refundReminder && (
        <p>
          {m.deletion_refund_reminder({
            eligibleCount: refundReminder.eligibleCount,
            pendingCount: refundReminder.pendingCount,
          })}{' '}
          <a className="underline" href={refundReminder.billingHref}>
            {m.deletion_review_billing()}
          </a>
        </p>
      )}
      {!workspace && (
        <button
          type="button"
          className="underline text-left"
          disabled={!hydrated || busy || completed}
          onClick={signInAgain}
        >
          {m.deletion_signin_again()}
        </button>
      )}
      <label className="grid gap-2">
        {m.deletion_confirmation({ confirmation: label })}
        <input
          className="rounded border p-2"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          disabled={!hydrated || busy || completed}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {completed && (
        <a className="underline" href={workspace ? '/app' : '/login'}>
          {m.deletion_continue()}
        </a>
      )}
      {blocked.length > 0 && (
        <ul>
          {blocked.map((item) => (
            <li key={item.id}>
              <a className="underline" href={`/app/${item.slug}`}>
                {item.name}
              </a>
              {m.deletion_blocked_team_suffix()}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="rounded bg-destructive p-2 text-destructive-foreground disabled:opacity-50"
        disabled={!hydrated || busy || completed || confirmation !== label}
        onClick={() => void submit()}
      >
        {busy
          ? m.deletion_submitting()
          : workspace
            ? m.deletion_workspace_submit()
            : m.deletion_account_title()}
      </button>
    </section>
  )
}
