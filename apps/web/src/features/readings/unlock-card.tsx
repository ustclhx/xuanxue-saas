import { cn } from '@xuanxue/ui'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { AskAiEntry } from '../ai/ask-ai-entry.tsx'
import { checkoutCustomer } from '../billing/customer.functions.ts'
import { useSiteId } from '../site/context.tsx'
import { siteOfLocale } from '../site/site.ts'
import { AiDisclaimer } from '../tools/disclaimer.tsx'
import { encodeShareInput, SHARE_PARAM, type ShareInput } from '../tools/share.ts'
import { FxAttribution } from './fx-attribution.tsx'
import { toTraditional } from './hant.ts'
import { Markdown } from './markdown.tsx'
import { formatPrice, LOCAL_CURRENCY, type LocalRates, usdCentsFor } from './price.ts'
import {
  createReadingUnlock,
  getReading,
  getReadingOffer,
  openReadingUnlock,
  type ReadingOffer,
  type ReadingPack,
  type ReadingView,
} from './readings.functions.ts'
import { readReadingStream } from './stream.ts'
import { readingTitle } from './title.ts'
import { PAYMENT_POLL_DELAYS, peekUnlockToken, UNLOCK_PARAM, unlockReturnPath } from './unlock.ts'

/**
 * 结果页的「完整分析」解锁卡（add-reading-monetization tasks.md 3.1，原型 Main.dc.html 付费卡）：
 * 反色块显示所需积分、当地货币估价与章节目录，位于免费结果与订阅卡之后，不以弹窗出现。
 *
 * 点击后：未登录 → 本语言登录页；积分不足 → 选择积分包并跳转 Checkout；否则直接生成并流式显示。
 * 登录与 Checkout 的回跳地址带签名的 `unlock` 参数（design 决策 5）。回到本页时：
 * 1. 挂载时把令牌中的分享输入写成 `#r=` 片段，工具页沿用分享链接的逻辑恢复输入并出结果；
 * 2. 令牌与本标签页 sessionStorage 中的待办一致且服务端验签通过时，自动 POST /api/readings。
 * 只有本标签页发起的解锁才会自动扣费，外部构造的 `unlock` 链接只会恢复输入。
 *
 * 组件须在页面首次渲染时即挂载（`request` 可以先为 null），第 1 步才会早于工具页读取片段。
 */

export interface UnlockRequest {
  /** `POST /api/readings` 的原始输入，可含姓名、问题等不放进地址的字段 */
  readonly input: unknown
  /** 与结果页 `#r=` 分享片段相同的输入，用于登录 / 支付回跳后恢复结果 */
  readonly share: ShareInput
}

const PENDING_KEY = 'xuanxue.readings.pending-unlock'

interface Pending {
  readonly token: string
  readonly kind: string
  readonly input: unknown
}

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

function savePending(pending: Pending) {
  try {
    sessionStore()?.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    // 存储不可用时回跳后不自动生成，用户可以再次点击
  }
}

function takePending(): Pending | null {
  const store = sessionStore()
  try {
    const raw = store?.getItem(PENDING_KEY)
    store?.removeItem(PENDING_KEY)
    const value: unknown = raw ? JSON.parse(raw) : null
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as Pending).token === 'string' &&
      typeof (value as Pending).kind === 'string'
    )
      return value as Pending
  } catch {
    // 损坏的记录视为没有
  }
  return null
}

/** 去掉 `unlock` 与 billing-return 追加的 `checkout`，保留其余查询串与片段 */
function cleanUnlockParams(): URLSearchParams {
  const url = new URL(window.location.href)
  const original = new URLSearchParams(url.search)
  url.searchParams.delete(UNLOCK_PARAM)
  url.searchParams.delete('checkout')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return original
}

type Phase =
  | { readonly name: 'idle' }
  | { readonly name: 'busy'; readonly label: string }
  | { readonly name: 'packs' }
  | { readonly name: 'streaming'; readonly id: string | null; readonly text: string }
  | { readonly name: 'done'; readonly id: string | null; readonly text: string }
  | { readonly name: 'failed' }
  | { readonly name: 'error' }
  | { readonly name: 'payment-pending' }

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** 流结束后等待报告同步出最终状态（后台结算可能稍晚于流）；读取失败时返回 null，按流的结果显示 */
async function settledStatus(slug: string, id: string): Promise<ReadingView['status'] | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const view = await getReading({ data: { slug, id } }).catch(() => null)
    if (!view) return null
    if (view.status !== 'generating') return view.status
    await wait(1000)
  }
  return null
}

type ReadingUnlockProps = {
  kind: string
  /** 结果出现前为 null，卡片不显示 */
  request: UnlockRequest | null
  /** 仅供本地演示页：使用固定报价，不读取服务端 */
  previewOffer?: ReadingOffer
}

/**
 * 解锁卡之后附上「用这个结果问 AI」（product-improve-ai-content 5.1）：与详批是否开放无关，
 * 有结果且站点开启计费与文本 AI 就显示；对话是否有可用模型由对话页处理。
 */
export function ReadingUnlock(props: ReadingUnlockProps) {
  // 随解锁卡一起在首次渲染时挂载，登录回跳才能读到 `?unlock=`；结果出现前入口自身不显示
  const askAi =
    !props.previewOffer && templateConfig.billing.enabled && templateConfig.ai.text.enabled
  return (
    <>
      <ReadingUnlockCard {...props} />
      {askAi ? <AskAiEntry kind={props.kind} request={props.request} /> : null}
    </>
  )
}

function ReadingUnlockCard({ kind, request, previewOffer }: ReadingUnlockProps) {
  const hostSite = useSiteId()
  const locale = getLocale()
  // 报告站点取语言归属：已登记 Host 上两者一致（gate 跨站重定向）；未登记的 workers.dev
  // staging 两站页面都按西方站外观渲染，若用 Host 站点，繁中/韩语详批会被服务端拒绝
  const site = siteOfLocale(locale, templateConfig) ?? hostSite
  const [offer, setOffer] = useState<ReadingOffer | null>(previewOffer ?? null)
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const resumeToken = useRef<string | null>(null)

  // 第 1 步：回跳地址只有 `?unlock=`，把其中的分享输入写成 `#r=`，早于工具页读取片段
  useLayoutEffect(() => {
    const token = new URLSearchParams(window.location.search).get(UNLOCK_PARAM)
    if (!token) return
    resumeToken.current = token
    const payload = peekUnlockToken(token)
    const hasShare = new URLSearchParams(window.location.hash.slice(1)).has(SHARE_PARAM)
    if (payload && payload.kind === kind && !hasShare)
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#${SHARE_PARAM}=${encodeShareInput(payload.share)}`,
      )
  }, [kind])

  const refresh = useCallback(async () => {
    if (previewOffer) return previewOffer
    const next = await getReadingOffer({ data: { kind, locale } })
    setOffer(next)
    return next
  }, [kind, locale, previewOffer])

  useEffect(() => {
    void refresh().catch(() => setOffer(null))
  }, [refresh])

  const returnPath = () => window.location.pathname

  const issueToken = async (input: unknown, share: ShareInput) => {
    const { token } = await createReadingUnlock({
      data: { kind, share: { ...share }, returnTo: returnPath() },
    })
    savePending({ token, kind, input })
    return unlockReturnPath(returnPath(), token)
  }

  const goLogin = async (input: unknown, share: ShareInput) => {
    setPhase({ name: 'busy', label: m.readings_unlock_redirecting() })
    const redirect = await issueToken(input, share)
    window.location.assign(
      localizeHref(`/login?redirect=${encodeURIComponent(redirect)}`, { locale }),
    )
  }

  const generate = async (input: unknown) => {
    setPhase({ name: 'busy', label: m.readings_generating() })
    const response = await fetch('/api/readings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, input, locale, site }),
    })
    if (response.status === 401 && request) return goLogin(input, request.share)
    if (response.status === 402) {
      await refresh()
      return setPhase({ name: 'packs' })
    }
    if (!response.ok || !response.body) return setPhase({ name: 'error' })
    const id = response.headers.get('x-reading-id')
    if (!id) {
      // 同一请求 10 分钟内已有报告：打开那一份，不重复扣费
      const existing = (await response.json().catch(() => null)) as {
        reading?: { id: string }
      } | null
      const slug = offer?.viewer?.slug ?? (await refresh()).viewer?.slug
      if (existing?.reading && slug)
        return window.location.assign(`/app/${slug}/readings/${existing.reading.id}`)
      return setPhase({ name: 'error' })
    }
    setPhase({ name: 'streaming', id, text: '' })
    const result = await readReadingStream(response.body, (progress) =>
      setPhase({ name: 'streaming', id, text: progress.text }),
    )
    // 章节不全等未完整完成的报告由服务端标记失败并退回积分：流结束后以保存的状态为准
    const slug = offer?.viewer?.slug
    const status = slug ? await settledStatus(slug, id) : null
    if (status === 'failed' || (result.failed && !result.text.trim())) {
      void refresh()
      return setPhase({ name: 'failed' })
    }
    setPhase({ name: 'done', id, text: result.text })
    void refresh()
  }

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action()
    } catch {
      setPhase({ name: 'error' })
    }
  }

  const unlock = () =>
    run(async () => {
      if (!request) return
      setPhase({ name: 'busy', label: m.readings_generating() })
      const current = await refresh()
      if (!current.viewer) return goLogin(request.input, request.share)
      // 付款确认超时后点击：仍未到账时留在当前提示，不回到积分包选择，避免重复付款
      if (current.viewer.balance < current.credits)
        return setPhase(phase.name === 'payment-pending' ? phase : { name: 'packs' })
      return generate(request.input)
    })

  const buy = (pack: ReadingPack) =>
    run(async () => {
      if (!request || !offer?.viewer) return
      setPhase({ name: 'busy', label: m.readings_unlock_redirecting() })
      const returnTo = await issueToken(request.input, request.share)
      const result = await checkoutCustomer({
        data: {
          slug: offer.viewer.slug,
          provider: pack.provider as 'stripe',
          planPriceId: pack.planPriceId,
          idempotencyKey: crypto.randomUUID(),
          returnTo,
        },
      })
      if (!result.ok) return setPhase({ name: 'error' })
      window.location.assign(result.result.url)
    })

  // 第 2 步：本标签页发起的解锁在登录 / 支付回跳后自动继续
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在挂载时处理一次回跳
  useEffect(() => {
    const token = resumeToken.current
    if (!token) return
    const params = cleanUnlockParams()
    const pending = takePending()
    if (!pending || pending.token !== token || pending.kind !== kind) return
    void run(async () => {
      setPhase({ name: 'busy', label: m.readings_generating() })
      const payload = await openReadingUnlock({ data: { token } })
      if (!payload || payload.kind !== kind) return setPhase({ name: 'idle' })
      let current = await refresh()
      if (!current.available || !current.viewer) return setPhase({ name: 'idle' })
      const checkout = params.get('checkout')
      if (checkout === 'canceled') return setPhase({ name: 'packs' })
      // 积分由支付 webhook 异步入账：付款成功回跳后按 PAYMENT_POLL_DELAYS 轮询余额，
      // 单次读取失败沿用上一次结果继续等待
      for (const delay of checkout === 'success' ? PAYMENT_POLL_DELAYS : []) {
        if (!current.viewer || current.viewer.balance >= current.credits) break
        setPhase({ name: 'busy', label: m.readings_unlock_confirming() })
        await wait(delay)
        const previous = current
        current = await refresh().catch(() => previous)
      }
      if (!current.viewer) return setPhase({ name: 'idle' })
      if (current.viewer.balance < current.credits)
        return setPhase(checkout === 'success' ? { name: 'payment-pending' } : { name: 'packs' })
      return generate(pending.input)
    })
  }, [])

  const generating = phase.name === 'streaming' || phase.name === 'done'
  if (offer?.comingSoon && request && phase.name === 'idle') return <ComingSoon kind={kind} />
  if (!offer?.available || (!request && !generating && phase.name === 'idle')) return null

  if (generating) {
    const slug = offer.viewer?.slug
    const href = phase.id && slug ? `/app/${slug}/readings/${phase.id}` : null
    return (
      <section
        aria-labelledby="reading-full-title"
        aria-busy={phase.name === 'streaming'}
        data-testid="reading-stream"
        className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-8"
      >
        <header className="flex flex-col gap-1.5">
          <h2 id="reading-full-title" className="m-0 font-heading font-semibold text-2xl text-ink">
            {readingTitle(kind)}
          </h2>
          <p role="status" className="m-0 text-ink-muted text-sm">
            {phase.name === 'streaming' ? m.readings_generating() : m.readings_report_saved()}
          </p>
        </header>
        {phase.text && <Markdown source={toTraditional(phase.text, locale)} />}
        {href && phase.name === 'done' && (
          <a
            href={href}
            className="inline-flex min-h-11 items-center self-start rounded-lg border border-line-strong px-5 text-ink no-underline hover:bg-surface-2"
          >
            {m.readings_open_report()} →
          </a>
        )}
      </section>
    )
  }

  // 支付未开通（没有可购买的积分包）且余额不够时不显示解锁入口，避免走到无法付款的一步
  if (offer.packs.length === 0 && (offer.viewer?.balance ?? 0) < offer.credits) return null
  const cents = usdCentsFor(offer.credits, offer.packs)
  const price = cents === null ? null : formatPrice(cents, locale, offer.rates)
  const busy = phase.name === 'busy'
  return (
    <section
      aria-labelledby="reading-unlock-title"
      data-testid="reading-unlock"
      className="flex flex-col gap-3.5 rounded-xl bg-inverse p-5 text-on-inverse sm:p-6"
    >
      <h2 id="reading-unlock-title" className="m-0 font-heading font-semibold text-[22px]">
        {readingTitle(kind)}
      </h2>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-normal text-on-inverse/75 text-sm">
          {m.readings_unlock_contents()}
        </h3>
        <ol className="m-0 pl-5 text-[15px] text-on-inverse/90 leading-[1.9]">
          {offer.sections.map((section) => (
            <li key={section}>{section}</li>
          ))}
        </ol>
      </div>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2.5" data-testid="reading-price">
        <span className="font-bold text-[28px]">
          {m.readings_unlock_credits({ credits: String(offer.credits) })}
        </span>
        {price && (
          <span className="text-on-inverse/75 text-sm">
            {price.approximate ? m.readings_unlock_approx({ price: price.text }) : price.text}
          </span>
        )}
        {price?.approximate && offer.rates.attribution && (
          <FxAttribution attribution={offer.rates.attribution} />
        )}
      </p>
      {phase.name === 'packs' ? (
        <PackChooser
          packs={offer.packs}
          locale={locale}
          rates={offer.rates}
          balance={offer.viewer?.balance ?? 0}
          onPick={buy}
        />
      ) : (
        <button
          type="button"
          onClick={unlock}
          disabled={busy || !request}
          data-testid="reading-unlock-button"
          className="min-h-12 rounded-lg bg-brand px-6 font-semibold text-[17px] text-on-brand transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-on-inverse focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy
            ? phase.label
            : phase.name === 'payment-pending'
              ? m.readings_unlock_payment_pending()
              : m.readings_unlock_cta()}
        </button>
      )}
      <PhaseMessage phase={phase} signedIn={Boolean(offer.viewer)} onRetry={unlock} />
      <p className="m-0 text-on-inverse/75 text-xs">{m.readings_unlock_note()}</p>
      <AiDisclaimer className="bg-transparent p-0 text-on-inverse/75 text-xs" />
    </section>
  )
}

/** 运营关闭时的占位：只显示名称与「即将开放」，不显示价格、解锁按钮或目录 */
function ComingSoon({ kind }: { kind: string }) {
  return (
    <section
      aria-labelledby="reading-coming-soon-title"
      data-testid="reading-coming-soon"
      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2
        id="reading-coming-soon-title"
        className="m-0 font-heading font-semibold text-xl text-ink"
      >
        {readingTitle(kind)}
      </h2>
      <p className="m-0 text-ink-muted text-sm">{m.readings_coming_soon()}</p>
    </section>
  )
}

function PhaseMessage({
  phase,
  signedIn,
  onRetry,
}: {
  phase: Phase
  signedIn: boolean
  onRetry: () => void
}) {
  const text =
    phase.name === 'failed'
      ? m.readings_generate_failed()
      : phase.name === 'error'
        ? m.readings_unlock_error()
        : null
  if (text)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span>{text}</span>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-lg border border-on-inverse/40 px-4 text-on-inverse"
        >
          {m.readings_retry()}
        </button>
      </div>
    )
  if (!signedIn && phase.name === 'idle')
    return <p className="m-0 text-on-inverse/75 text-sm">{m.readings_unlock_signin_note()}</p>
  return null
}

function PackChooser({
  packs,
  locale,
  rates,
  balance,
  onPick,
}: {
  packs: readonly ReadingPack[]
  locale: string
  rates: LocalRates
  balance: number
  onPick: (pack: ReadingPack) => void
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2 p-0 text-sm">
        {m.readings_unlock_need_credits()}{' '}
        <span className="text-on-inverse/75">
          {m.readings_unlock_balance({ balance: String(balance) })}
        </span>
      </legend>
      {packs.map((pack, index) => {
        const usd = formatPrice(pack.amount, 'en')
        const local = formatPrice(pack.amount, locale, rates)
        return (
          <button
            key={pack.planPriceId}
            type="button"
            onClick={() => onPick(pack)}
            data-testid="reading-pack"
            className={cn(
              'flex min-h-12 items-center justify-between gap-3 rounded-lg px-4 text-left font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-on-inverse focus-visible:outline-offset-2',
              index === 0
                ? 'bg-brand text-on-brand'
                : 'border border-on-inverse/40 bg-transparent text-on-inverse',
            )}
          >
            <span>{m.readings_pack_credits({ credits: String(pack.credits) })}</span>
            <span className="font-normal text-sm">
              {usd.text}
              {local.approximate && ` · ${m.readings_unlock_approx({ price: local.text })}`}
            </span>
          </button>
        )
      })}
      <p className="m-0 text-on-inverse/75 text-xs">{m.readings_pack_price_note()}</p>
      {LOCAL_CURRENCY[locale] && rates.attribution && (
        <FxAttribution attribution={rates.attribution} className="text-on-inverse/75" />
      )}
    </fieldset>
  )
}
