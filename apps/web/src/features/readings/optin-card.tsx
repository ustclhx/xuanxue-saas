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
  const [interacted, setInteracted] = useState(false)
  // 结果页只在访客使用订阅表单后联系验证服务，避免首屏的第三方请求。
  const turnstile = useTurnstile(interacted ? (options?.siteKey ?? null) : null, 'newsletter')
  const loading = !options || (interacted && !turnstile.ready)
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
      className="flex flex-col gap-4 rounded-object bg-surface p-6 sm:p-8"
    >
      <h2 id={id} className="m-0 font-bold font-heading text-ink text-subtitle">
        {m.optin_title()}
      </h2>
      <p className="m-0 text-body text-ink-muted">{m.optin_intro()}</p>
      <form
        className="grid gap-x-6 gap-y-4 sm:grid-cols-2"
        onFocus={(event) => {
          // 主题下拉是 @xuanxue/ui 的 Select，可聚焦的是 combobox 触发器
          if (event.target.matches('input, select, [role="combobox"]')) setInteracted(true)
        }}
        onInput={() => setInteracted(true)}
        onChange={() => setInteracted(true)}
        onSubmit={async (event) => {
          event.preventDefault()
          setInteracted(true)
          if (busy || !options || (options.siteKey && (!interacted || !turnstile.ready))) return
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
          onClick={() => setInteracted(true)}
          // 次级按钮（设计稿 btn-secondary）：药丸形、透明底、控件外框色的内描边；页面上的主按钮只留给工具表单
          className="min-h-12 self-end rounded-full bg-transparent px-7 font-medium text-body text-ink ring-1 ring-field-border ring-inset transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || loading}
          aria-busy={busy || loading}
        >
          {busy ? m.optin_busy() : loading ? m.optin_loading() : m.optin_submit()}
        </button>
        <div className="sm:col-span-2">{turnstile.widget}</div>
        <p className="m-0 text-caption text-ink-subtle sm:col-span-2">{m.optin_consent()}</p>
        <p role="status" className="m-0 text-caption text-ink-muted sm:col-span-2">
          {message}
        </p>
      </form>
    </section>
  )
}
