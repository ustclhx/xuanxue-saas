import { useEffect, useId, useRef, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import type { ShareCardModel } from './model.ts'

// 「保存分享图」操作（openspec redesign-home-chart-visuals tasks 7.2 / 7.3）：放在结果分享链接旁。
// 本组件进入结果页静态包，只能以 import() 引用 render.ts（首页包检查以 SHARE_CARD_MARKER 确认）。
// 结果出现后空闲时预取生成模块，之后断网也能生成；生成全部在本地完成，失败时提示重试，结果与分享链接不受影响。

type State =
  | { status: 'idle' }
  | { status: 'generating' }
  | { status: 'ready'; url: string; file: File }
  | { status: 'failed' }

let renderer: Promise<typeof import('./render.ts')> | null = null

/** 加载生成模块；失败（如离线时尚未预取）时清空缓存，重试可再次加载 */
function loadRenderer() {
  renderer ??= import('./render.ts').catch((error: unknown) => {
    renderer = null
    throw error
  })
  return renderer
}

const PREFETCH_DELAY_MS = 1500

const buttonClass =
  'min-h-11 rounded-lg border border-ink px-4 text-base text-ink transition-colors hover:bg-surface-2 disabled:opacity-50'

export function ShareCardAction({ build }: { build: () => ShareCardModel }) {
  const checkboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [includeBirth, setIncludeBirth] = useState(false)
  const [state, setState] = useState<State>({ status: 'idle' })
  const [canShare, setCanShare] = useState(false)
  const url = state.status === 'ready' ? state.url : null

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRenderer().catch(() => {}), PREFETCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  // 图片地址随状态切换或卸载时释放
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  const generate = async () => {
    const scope = rootRef.current
    if (!scope) return
    setState({ status: 'generating' })
    try {
      const { generateShareCard } = await loadRenderer()
      const model = build()
      const blob = await generateShareCard(model, { includeBirth }, scope)
      const file = new File([blob], `${model.fileName}.png`, { type: 'image/png' })
      setCanShare(Boolean(navigator.canShare?.({ files: [file] })))
      setState({ status: 'ready', url: URL.createObjectURL(blob), file })
    } catch {
      setState({ status: 'failed' })
    }
  }

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file] })
    } catch {
      // 访客取消系统分享或分享失败时保留下载入口，不视为生成失败
    }
  }

  return (
    <div ref={rootRef} data-share-card-action="" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={generate}
          disabled={state.status === 'generating'}
          aria-busy={state.status === 'generating' || undefined}
          className={buttonClass}
        >
          {state.status === 'generating' ? m.share_card_generating() : m.share_card_save()}
        </button>
        <label
          htmlFor={checkboxId}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-ink-muted text-sm"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={includeBirth}
            onChange={(event) => {
              setIncludeBirth(event.currentTarget.checked)
              // 已生成的图片与勾选不一致，回到初始状态重新生成
              if (state.status !== 'generating') setState({ status: 'idle' })
            }}
            className="size-4 accent-brand"
          />
          {m.share_card_include_birth()}
        </label>
      </div>
      {state.status === 'failed' && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-brand px-4 py-3 text-ink"
        >
          <p className="m-0 min-w-0 flex-1 basis-60 text-sm">{m.share_card_failed()}</p>
          <button type="button" onClick={generate} className={buttonClass}>
            {m.share_card_retry()}
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <div className="flex flex-wrap items-start gap-4" data-share-card-ready="">
          <img
            src={state.url}
            alt={m.share_card_preview_alt()}
            width={1080}
            height={1350}
            className="h-auto w-32 rounded-lg border border-line"
          />
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-2">
            <p role="status" className="m-0 text-ink-muted text-sm">
              {m.share_card_ready()}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={state.url}
                download={state.file.name}
                className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-base text-on-brand no-underline"
              >
                {m.share_card_download()}
              </a>
              {canShare && (
                <button type="button" onClick={() => share(state.file)} className={buttonClass}>
                  {m.share_card_share()}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
