import {
  createFileRoute,
  notFound as featureNotFound,
  Link,
  redirect,
} from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { confirmCustomerCheckout } from '../../../features/billing/customer.functions.ts'
import { safeReturnPath } from '../../../features/site/return-path.ts'
import { templateConfig } from '../../../server/template-config.ts'

type ReturnSearch = {
  provider?: string | undefined
  canceled?: string | undefined
  subscription_id?: string | undefined
  providerRef?: string | undefined
  token?: string | undefined
}

// PayPal 订阅回跳也携带 token，但只有一次性订单需要 capture。
function needsConfirm(search: ReturnSearch) {
  return (
    search.provider === 'paypal' &&
    search.canceled !== 'true' &&
    search.subscription_id === undefined &&
    Boolean(search.providerRef ?? search.token)
  )
}

/** 回到发起购买的本站页面（决策 4），`checkout` 告诉该页面支付结果尚待确认还是已取消 */
function returnHref(returnTo: string, canceled: boolean) {
  return `${returnTo}${returnTo.includes('?') ? '&' : '?'}checkout=${canceled ? 'canceled' : 'success'}`
}

export const Route = createFileRoute('/app/$slug/billing-return')({
  beforeLoad: ({ search }) => {
    if (!templateConfig.billing.enabled) throw featureNotFound()
    // 无需在本页确认的回跳直接回到发起页面；PayPal 一次性订单先在本页确认
    const returnTo = safeReturnPath(search.returnTo, templateConfig.i18n.locales)
    if (returnTo && !needsConfirm(search))
      throw redirect({ href: returnHref(returnTo, search.canceled === 'true') })
  },
  validateSearch: z.object({
    provider: z.enum(['stripe', 'paypal', 'creem', 'paddle', 'polar']).optional(),
    token: z.string().max(255).optional(),
    subscription_id: z.string().max(255).optional(),
    providerRef: z.string().max(255).optional(),
    canceled: z.union([z.string(), z.boolean()]).transform(String).optional(),
    returnTo: z.string().max(1024).optional(),
  }),
  component: BillingReturnPage,
})
function BillingReturnPage() {
  const search = Route.useSearch()
  const { slug } = Route.useParams()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => setReady(true), [])
  const providerRef = search.providerRef ?? search.token
  const canConfirm = needsConfirm(search)
  const returnTo = safeReturnPath(search.returnTo, templateConfig.i18n.locales)
  async function confirm() {
    if (!canConfirm || !search.provider || !providerRef) return
    setBusy(true)
    try {
      const result = await confirmCustomerCheckout({
        data: { slug, provider: search.provider, providerRef },
      })
      setConfirmed(result.ok)
      setMessage(
        result.ok
          ? 'Payment confirmation submitted. Your plan and credits update after payment is verified.'
          : 'Unable to confirm this payment. Return to billing or try again.',
      )
    } catch {
      setMessage('Unable to confirm payment. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid gap-4">
      <h2 className="text-2xl font-semibold">Checkout return</h2>
      <p>
        {search.canceled === 'true'
          ? 'Checkout was canceled. You can return to billing to try again.'
          : 'Your plan and credits update after payment is verified. Returning here does not confirm that payment succeeded.'}
      </p>
      {canConfirm && (
        <Button disabled={!ready || busy || confirmed} onClick={() => void confirm()}>
          Confirm payment
        </Button>
      )}
      {message && <p role="status">{message}</p>}
      {returnTo ? (
        // 发起页面可能带语言前缀，整页跳转交给服务端按该页语言渲染
        <a href={returnHref(returnTo, search.canceled === 'true')} className="underline">
          Return to previous page
        </a>
      ) : (
        <Link to="/app/$slug/billing" params={{ slug }} className="underline">
          Return to billing
        </Link>
      )}
    </div>
  )
}
