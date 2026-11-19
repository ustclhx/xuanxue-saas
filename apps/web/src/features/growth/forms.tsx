import { Input } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { useTurnstile } from '../auth/turnstile.tsx'
import { contentLinks } from '../marketing/content-links.ts'
import { inlineLinks } from '../marketing/content-page.tsx'
import { getGrowthFormOptions } from './growth.functions.ts'

type Feature = 'waitlist' | 'newsletter'

/**
 * 独立收集表单：首页只挂载组件，关闭功能时不请求公开配置或加载 Turnstile。
 * `headingLevel={1}` 是独立页面（/newsletter、/waitlist；设计稿 warm-refresh/Newsletter.dc.html）：
 * 页头由本组件输出，表单下方多一行隐私说明并链接隐私政策；嵌在其他页面里时（h2）不带这行链接。
 */
export function GrowthForm({
  feature,
  headingLevel = 2,
}: {
  feature: Feature
  headingLevel?: 1 | 2
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const standalone = headingLevel === 1
  // 表单在服务端直接输出，爬虫与无脚本访客也能看到；Turnstile 配置在水合后补充。
  const [options, setOptions] = useState<{ siteKey: string | null } | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    getGrowthFormOptions({ data: feature })
      .then((value) => {
        if (active) setOptions(value)
      })
      .catch(() => {
        if (active) setUnavailable(true)
      })
    return () => {
      active = false
    }
  }, [feature])
  return (
    <section
      className={
        standalone
          ? 'flex w-full flex-col gap-8 sm:gap-10'
          : 'mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-8 sm:px-6'
      }
    >
      <div
        className={standalone ? 'flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10' : 'contents'}
      >
        <Heading className="m-0 text-balance font-heading text-ink text-title">
          {feature === 'waitlist' ? m.growth_waitlist_title() : m.growth_newsletter_title()}
        </Heading>
        {feature === 'newsletter' && (
          <p className="m-0 text-body text-ink-muted">{m.growth_newsletter_intro()}</p>
        )}
      </div>
      <EmailForm
        feature={feature}
        siteKey={options?.siteKey ?? null}
        configured={options !== null}
        unavailable={unavailable}
        standalone={standalone}
      />
    </section>
  )
}

type Outcome = { kind: 'success' | 'error'; text: string } | null

function EmailForm({
  feature,
  siteKey,
  configured,
  unavailable,
  standalone,
}: {
  feature: Feature
  siteKey: string | null
  /** 配置已读取；此前按钮可见但不可提交，避免绕过人机验证 */
  configured: boolean
  unavailable: boolean
  standalone: boolean
}) {
  const [email, setEmail] = useState('')
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [busy, setBusy] = useState(false)
  const turnstile = useTurnstile(siteKey, feature)
  const errorId = `${feature}-email-error`
  const error = outcome?.kind === 'error' ? outcome.text : unavailable ? m.growth_unavailable() : ''

  // 提交成功：表单换成一条确认信息（设计稿的成功态），不再显示输入框
  if (outcome?.kind === 'success')
    return (
      <p
        role="status"
        className="m-0 w-full max-w-130 rounded-field bg-surface-2 px-4 py-3 text-body text-ink"
      >
        {outcome.text}
      </p>
    )

  return (
    <form
      className="flex w-full max-w-130 flex-col gap-4 rounded-object bg-surface p-6 shadow-raise sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        try {
          const response = await fetch(`/api/${feature}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...turnstile.headers() },
            body: JSON.stringify({ email }),
          })
          const data = (await response.json()) as { error?: { message: string } }
          setOutcome(
            response.ok
              ? {
                  kind: 'success',
                  text:
                    feature === 'waitlist'
                      ? m.growth_waitlist_success()
                      : m.growth_newsletter_success(),
                }
              : { kind: 'error', text: data.error?.message ?? m.growth_retry() },
          )
        } catch {
          setOutcome({ kind: 'error', text: m.growth_submit_failed() })
        } finally {
          turnstile.reset()
          setBusy(false)
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${feature}-email`} className="text-caption text-ink-muted">
          {m.growth_email_label()}
        </label>
        <Input
          id={`${feature}-email`}
          type="email"
          autoComplete="email"
          className="min-h-12 bg-background"
          required
          maxLength={254}
          value={email}
          aria-invalid={outcome?.kind === 'error' ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        {/* 失败态（设计稿）：danger 色的图标与说明；role="status" 让读屏播报结果 */}
        <p
          id={errorId}
          role="status"
          className="m-0 flex items-start gap-1.5 text-caption text-danger empty:hidden"
        >
          {error && (
            <>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-4 shrink-0">
                <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="10" cy="10" r="7" />
                  <path d="M10 6.5v4.5M10 13.6v.2" />
                </g>
              </svg>
              {error}
            </>
          )}
        </p>
      </div>
      {turnstile.widget}
      {/* 主按钮：药丸形、文字色填充；手机占满一行，桌面按内容宽度靠左（与工具表单的提交按钮一致） */}
      <button
        type="submit"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-7 font-medium text-body text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56 sm:self-start"
        disabled={busy || !configured || !turnstile.ready}
      >
        {busy
          ? m.growth_submitting()
          : feature === 'waitlist'
            ? m.growth_waitlist_submit()
            : m.growth_newsletter_submit()}
      </button>
      {standalone && (
        <p className="m-0 text-caption text-ink-subtle">
          {inlineLinks(m.growth_privacy_note(), contentLinks(getLocale()))}
        </p>
      )}
    </form>
  )
}
