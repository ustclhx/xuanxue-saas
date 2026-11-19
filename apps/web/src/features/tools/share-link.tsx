import { useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { shareUrl } from './share.ts'
import type { ShareCardModel } from './share-card/model.ts'
import { ShareCardAction } from './share-card/share-card-action.tsx'

type CopyState = 'idle' | 'copied' | 'failed'

/**
 * 分享结果链接：显示可选中的完整地址与复制按钮。地址在浏览器中按当前页面生成（`#r=` 片段），
 * 复制失败时提示手动选取；状态通过 aria-live 播报。
 * 样式（设计稿 warm-refresh/ToolBazi.dc.html 结果区末尾）：地址框与表单输入同款，复制是次要按钮（药丸形、细线框），提示为 caption。
 * 传入 `card` 时在下方提供「保存分享图」（redesign-home-chart-visuals tasks 7.3），按点击生成模型。
 */
export function ShareLink({
  input,
  card,
}: {
  input: Readonly<Record<string, unknown>>
  card?: (() => ShareCardModel) | undefined
}) {
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
      <label htmlFor={fieldId} className="text-caption text-ink-muted">
        {m.tools_share_label()}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={fieldId}
          readOnly
          value={href}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-12 min-w-0 flex-1 basis-60 rounded-field border border-field-border bg-background px-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!href}
          className="min-h-12 rounded-full px-7 font-medium text-body text-ink ring-1 ring-field-border ring-inset transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-50 print:hidden"
        >
          {m.tools_share_copy()}
        </button>
      </div>
      <p aria-live="polite" className="m-0 text-caption text-ink-subtle print:hidden">
        {state === 'copied'
          ? m.tools_share_copied()
          : state === 'failed'
            ? m.tools_share_failed()
            : m.tools_share_hint()}
      </p>
      {card && <ShareCardAction build={card} />}
    </div>
  )
}
