import {
  createFileRoute,
  notFound as featureNotFound,
  Link,
  redirect,
} from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { SpacePage } from '../../../features/app-shell/space-frame.tsx'
import { confirmCustomerCheckout } from '../../../features/billing/customer.functions.ts'
import { prefixLocale } from '../../../features/i18n/url-prefix.ts'
import { safeReturnPath } from '../../../features/site/return-path.ts'
import { m } from '../../../paraglide/messages.js'
import { getLocale, locales } from '../../../paraglide/runtime.js'
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

// 拒付重试地址由服务端按环境拼出（design D2）；客户端仍只放行 PayPal 的 https 域名，
// 避免意外的返回值把用户带到第三方站点。
const PAYPAL_RETRY_HOSTS = new Set(['www.paypal.com', 'www.sandbox.paypal.com'])
function paypalRetryUrl(result: object): string | undefined {
  const value = 'retryUrl' in result ? result.retryUrl : undefined
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && PAYPAL_RETRY_HOSTS.has(url.hostname) ? url.href : undefined
  } catch {
    return undefined
  }
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

type Phase = 'confirming' | 'redirecting' | 'declined' | 'error'

const linkClass =
  'inline-flex min-h-11 items-center justify-self-start text-brand-ink underline underline-offset-4'

function BillingReturnPage() {
  const search = Route.useSearch()
  const { slug } = Route.useParams()
  const providerRef = search.providerRef ?? search.token
  const canConfirm = needsConfirm(search)
  const returnTo = safeReturnPath(search.returnTo, templateConfig.i18n.locales)
  // 页面语言跟随发起购买的页面（returnTo 的语言前缀）；没有前缀时沿用应用区语言（账号 / Cookie）
  const locale = (returnTo && prefixLocale(returnTo.split('?')[0] ?? '', locales)) || getLocale()
  const [phase, setPhase] = useState<Phase>('confirming')
  const started = useRef(false)

  const confirm = useCallback(async () => {
    if (!canConfirm || !search.provider || !providerRef) return
    setPhase('confirming')
    try {
      const result = await confirmCustomerCheckout({
        data: { slug, provider: search.provider, providerRef },
      })
      if (result.ok) {
        setPhase('redirecting')
        // replace：返回键不会回到本页再次 capture；解锁卡按 checkout=success 轮询余额并自动生成
        window.location.replace(returnTo ? returnHref(returnTo, false) : `/app/${slug}/billing`)
        return
      }
      const retryUrl =
        result.error === 'BILLING_PAYMENT_DECLINED' ? paypalRetryUrl(result) : undefined
      if (retryUrl) {
        setPhase('declined')
        window.location.assign(retryUrl)
        return
      }
      setPhase('error')
    } catch {
      setPhase('error')
    }
  }, [canConfirm, search.provider, providerRef, slug, returnTo])

  // 挂载后自动 capture（design D1：GET 不应产生扣款副作用，所以放在客户端）；
  // ref 防止 StrictMode 双调用或重渲染重复提交。重试沿用服务端同一幂等键，不会重复扣款。
  useEffect(() => {
    if (started.current || !canConfirm) return
    started.current = true
    void confirm()
  }, [canConfirm, confirm])

  const status = !canConfirm
    ? search.canceled === 'true'
      ? m.billing_return_canceled({}, { locale })
      : m.billing_return_pending({}, { locale })
    : {
        confirming: m.billing_return_confirming({}, { locale }),
        redirecting: m.billing_return_redirecting({}, { locale }),
        declined: m.billing_return_declined({}, { locale }),
        error: m.billing_return_error({}, { locale }),
      }[phase]
  const busy = canConfirm && phase !== 'error'

  return (
    <div lang={locale}>
      <SpacePage title={m.billing_return_title({}, { locale })}>
        <section
          aria-busy={busy}
          className="grid max-w-xl gap-4 rounded-xl border border-line bg-surface p-6"
        >
          <div className="flex items-start gap-3">
            {busy && (
              <span
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand motion-reduce:animate-none"
              />
            )}
            <p role="status" className="m-0 text-ink leading-relaxed">
              {status}
            </p>
          </div>
          {canConfirm && phase === 'error' && (
            <Button className="min-h-11 justify-self-start" onClick={() => void confirm()}>
              {m.billing_return_retry({}, { locale })}
            </Button>
          )}
          {!busy &&
            (returnTo ? (
              // 发起页面可能带语言前缀，整页跳转交给服务端按该页语言渲染
              <a href={returnHref(returnTo, search.canceled === 'true')} className={linkClass}>
                {m.billing_return_back({}, { locale })}
              </a>
            ) : (
              <Link to="/app/$slug/billing" params={{ slug }} className={linkClass}>
                {m.billing_return_billing({}, { locale })}
              </Link>
            ))}
        </section>
      </SpacePage>
    </div>
  )
}
