import { useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { useTurnstile } from '../auth/turnstile.tsx'
import { getGrowthFormOptions } from '../growth/growth.functions.ts'
import { useSiteId } from '../site/context.tsx'
import { useTool } from '../tools/context.tsx'
import { SelectField, TextField } from '../tools/form.tsx'
import { shareableInput } from '../tools/share.ts'
import { OPTIN_TOPICS, type ReadingOptinData } from './optin-schema.ts'

export function ReadingOptinCard({ tool, data }: { tool: string; data: ReadingOptinData }) {
  if (!templateConfig.features.newsletter) return null
  return <EnabledOptinCard tool={tool} data={data} />
}

function EnabledOptinCard({ tool, data }: { tool: string; data: ReadingOptinData }) {
  const id = useId()
  const site = useSiteId()
  const { track } = useTool()
  const [options, setOptions] = useState<{ siteKey: string | null } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const turnstile = useTurnstile(options?.siteKey ?? null, 'newsletter')
  useEffect(() => {
    let active = true
    getGrowthFormOptions({ data: 'newsletter' })
      .then((value) => {
        if (active) setOptions(value)
      })
      .catch(() => {
        if (active) setMessage(m.optin_error())
      })
    return () => {
      active = false
    }
  }, [])
  const labels = [
    m.optin_love(),
    m.optin_career(),
    m.optin_money(),
    m.optin_reunion(),
    m.optin_growth(),
  ]
  return (
    <section
      data-slot="reading-optin"
      data-tool={tool}
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-6"
    >
      <h2 id={id} className="m-0 font-heading text-2xl text-ink">
        {m.optin_title()}
      </h2>
      <p className="m-0 text-sm text-ink-muted">{m.optin_intro()}</p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy || !options || !turnstile.ready) return
          const values = new FormData(event.currentTarget)
          const topic = String(values.get('topic'))
          setBusy(true)
          setMessage('')
          try {
            const response = await fetch('/api/newsletter', {
              method: 'POST',
              headers: { 'content-type': 'application/json', ...turnstile.headers() },
              body: JSON.stringify({
                email: values.get('email'),
                reading: {
                  name: values.get('name'),
                  sourceTool: tool,
                  topic,
                  site,
                  locale: getLocale(),
                  result: data.result,
                  share: shareableInput(data.share),
                },
              }),
            })
            setMessage(response.ok ? m.optin_success() : m.optin_error())
            if (response.ok) track('optin_submit', { topic })
          } catch {
            setMessage(m.optin_error())
          } finally {
            setBusy(false)
            turnstile.reset()
          }
        }}
      >
        <TextField label={m.optin_name()} name="name" autoComplete="name" maxLength={80} />
        <TextField
          label={m.optin_email()}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
        <SelectField
          label={m.optin_topic()}
          name="topic"
          defaultValue="growth"
          options={OPTIN_TOPICS.map((topic, index) => ({
            value: topic,
            label: labels[index] ?? topic,
          }))}
        />
        <button
          type="submit"
          className="min-h-12 self-end rounded-lg border border-brand bg-transparent px-5 py-2 font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !options || !turnstile.ready}
        >
          {busy ? m.optin_busy() : m.optin_submit()}
        </button>
        <div className="sm:col-span-2">{turnstile.widget}</div>
        <p className="m-0 text-xs text-ink-subtle sm:col-span-2">{m.optin_consent()}</p>
        <p role="status" className="m-0 text-sm text-ink-muted sm:col-span-2">
          {message}
        </p>
      </form>
    </section>
  )
}
