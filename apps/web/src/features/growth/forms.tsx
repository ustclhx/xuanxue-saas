import { Button, Input } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { useTurnstile } from '../auth/turnstile.tsx'
import { getGrowthFormOptions } from './growth.functions.ts'

/** 独立收集表单：首页只挂载组件，关闭功能时不请求公开配置或加载 Turnstile。 */
export function GrowthForm({
  feature,
  headingLevel = 2,
}: {
  feature: 'waitlist' | 'newsletter'
  headingLevel?: 1 | 2
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const [options, setOptions] = useState<{ siteKey: string | null } | null>(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    getGrowthFormOptions({ data: feature })
      .then(setOptions)
      .catch(() => setMessage(m.growth_unavailable()))
  }, [feature])
  return (
    <section className="mx-auto grid w-full max-w-lg gap-4 px-4 py-8 sm:px-6">
      <Heading
        className={`m-0 font-heading font-semibold text-ink ${headingLevel === 1 ? 'text-4xl' : 'text-2xl'}`}
      >
        {feature === 'waitlist' ? m.growth_waitlist_title() : m.growth_newsletter_title()}
      </Heading>
      {feature === 'newsletter' && (
        <p className="m-0 text-ink-muted leading-relaxed">{m.growth_newsletter_intro()}</p>
      )}
      {options ? (
        <EmailForm feature={feature} siteKey={options.siteKey} />
      ) : (
        <p role="status">{message || m.growth_loading()}</p>
      )}
    </section>
  )
}

function EmailForm({
  feature,
  siteKey,
}: {
  feature: 'waitlist' | 'newsletter'
  siteKey: string | null
}) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const turnstile = useTurnstile(siteKey, feature)
  return (
    <form
      className="grid gap-3"
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
          setMessage(
            response.ok
              ? feature === 'waitlist'
                ? m.growth_waitlist_success()
                : m.growth_newsletter_success()
              : (data.error?.message ?? m.growth_retry()),
          )
        } catch {
          setMessage(m.growth_submit_failed())
        } finally {
          turnstile.reset()
          setBusy(false)
        }
      }}
    >
      <label htmlFor={`${feature}-email`} className="grid gap-2">
        {m.growth_email_label()}
        <Input
          id={`${feature}-email`}
          type="email"
          autoComplete="email"
          className="min-h-11"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {turnstile.widget}
      <Button type="submit" className="min-h-11" disabled={busy || !turnstile.ready}>
        {busy
          ? m.growth_submitting()
          : feature === 'waitlist'
            ? m.growth_waitlist_submit()
            : m.growth_newsletter_submit()}
      </Button>
      <p role="status">{message}</p>
    </form>
  )
}
