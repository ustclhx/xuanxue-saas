import { useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { shareUrl } from './share.ts'

type CopyState = 'idle' | 'copied' | 'failed'

/**
 * 分享结果链接：显示可选中的完整地址与复制按钮。地址在浏览器中按当前页面生成（`#r=` 片段），
 * 复制失败时提示手动选取；状态通过 aria-live 播报。
 */
export function ShareLink({ input }: { input: Readonly<Record<string, unknown>> }) {
  const fieldId = useId()
  const [href, setHref] = useState('')
  const [state, setState] = useState<CopyState>('idle')
  const encoded = JSON.stringify(input)
  useEffect(() => {
    setHref(shareUrl(window.location.href, JSON.parse(encoded)))
    setState('idle')
  }, [encoded])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href)
      setState('copied')
    } catch {
      setState('failed')
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-ink-muted text-sm">
        {m.tools_share_label()}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={fieldId}
          readOnly
          value={href}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 basis-60 rounded-lg border border-line-strong bg-surface px-3 text-base text-ink"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!href}
          className="min-h-11 rounded-lg border border-ink px-4 text-base text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {m.tools_share_copy()}
        </button>
      </div>
      <p aria-live="polite" className="m-0 text-ink-subtle text-xs">
        {state === 'copied'
          ? m.tools_share_copied()
          : state === 'failed'
            ? m.tools_share_failed()
            : m.tools_share_hint()}
      </p>
    </div>
  )
}
