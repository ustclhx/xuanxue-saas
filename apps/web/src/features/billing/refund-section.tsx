import { useRouter } from '@tanstack/react-router'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, Textarea } from '@xuanxue/ui'
import { useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { type getCustomerRefunds, requestCustomerRefund } from './refund.functions.ts'

export function RefundSection({
  slug,
  page,
  readOnly,
  pendingPayments,
}: {
  slug: string
  page: Awaited<ReturnType<typeof getCustomerRefunds>>
  readOnly: boolean
  pendingPayments: string[]
}) {
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const paymentSelectId = useId()
  const reasonId = useId()
  const [paymentId, setPaymentId] = useState('')
  const [reason, setReason] = useState('')
  const [contactEmail, setContactEmail] = useState(page?.contactEmail ?? '')
  const [message, setMessage] = useState('')
  const router = useRouter()
  useEffect(() => setReady(true), [])
  if (!page) return null
  const payments = page.payments.filter((p) => !pendingPayments.includes(p.id))
  const selectedPayment = payments.find((payment) => payment.id === paymentId)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await requestCustomerRefund({
        data: { slug, paymentId, reason, contactEmail },
      })
      setMessage(
        result.ok
          ? m.refund_submitted()
          : result.error === 'REFUND_ALREADY_PENDING'
            ? m.refund_error_pending()
            : m.refund_error_reload(),
      )
      if (result.ok) {
        setPaymentId('')
        setReason('')
        await router.invalidate()
      }
    } catch {
      setMessage(m.refund_error_unknown())
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="grid gap-3 rounded-xl border p-6">
      <h3 className="font-semibold">{m.refund_title()}</h3>
      <p>{m.refund_window_notice({ days: page.windowDays })}</p>
      <p>{m.refund_contact_retention_notice()}</p>
      {payments.length > 0 ? (
        <form onSubmit={(e) => void submit(e)} aria-label={m.refund_title()} className="grid gap-3">
          <div className="grid gap-2">
            <label htmlFor={paymentSelectId}>{m.refund_payment()}</label>
            <Select
              required
              value={selectedPayment ? paymentId : ''}
              onValueChange={setPaymentId}
              disabled={readOnly || busy}
            >
              <SelectTrigger
                id={paymentSelectId}
                className="w-full"
                placeholder={m.refund_choose_payment()}
              />
              <SelectContent>
                {payments.map((p, index) => (
                  <SelectItem key={p.id} index={index} value={p.id}>
                    {p.provider} ·{' '}
                    {new Date(p.paidAt).toLocaleDateString('en-US', { timeZone: 'UTC' })} ·{' '}
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      p.remainingRefundable / 100,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label htmlFor={reasonId}>
            {m.refund_reason()}{' '}
            <Textarea
              id={reasonId}
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={readOnly || busy}
            />
          </label>
          <label>
            {m.refund_contact_email()}{' '}
            <input
              required
              type="email"
              maxLength={254}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={readOnly || busy}
            />
          </label>
          <Button
            type="submit"
            disabled={
              !ready || busy || readOnly || !selectedPayment || !reason.trim() || !contactEmail
            }
          >
            {m.refund_submit()}
          </Button>
        </form>
      ) : (
        <p>{m.refund_no_eligible_payments()}</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
