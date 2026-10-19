import type { BirthInput } from '@xuanxue/bazi'
import { type ReactNode, useEffect } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ShareLink } from '../share-link.tsx'
import { toolHref } from '../tool-href.ts'
import type { ToolLink } from '../tool-links.tsx'
import {
  type ConceptKey,
  conceptPath,
  EASTERN_PAGES,
  type EasternPageId,
} from './eastern-routes.ts'
import { loadBazi } from './engine.ts'
import type { ToolState } from './use-birth-tool.ts'

/** 「当前流年」取访客本地的当前年份；分享链接复算时可能跨年，属预期 */
export async function computeBaziChart(input: BirthInput) {
  const engine = await loadBazi()
  return engine.computeChart(input, { referenceYear: new Date().getFullYear() })
}

/** 首屏渲染后空闲时预取引擎 chunk，提交时通常已就绪；失败不影响之后按需加载 */
export function usePrefetch(load: () => Promise<unknown>) {
  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch(() => {}), 1200)
    return () => window.clearTimeout(timer)
  }, [load])
}

export function conceptHref(
  locale: string,
  key: Exclude<ConceptKey, 'base'>,
  hash?: string,
): string | undefined {
  const path = conceptPath(locale, key)
  return path ? `${toolHref(path, locale)}${hash ? `#${hash}` : ''}` : undefined
}

export function pageHref(id: EasternPageId | 'home', locale: string): string {
  if (id === 'home') return toolHref('/', locale)
  const page = EASTERN_PAGES.find((item) => item.id === id)
  return toolHref(`/${page?.slug ?? ''}`, locale)
}

/** 延伸阅读：同组件的其他入口与概念页（概念页由 tasks.md 4.x 提供） */
export function link(href: string | undefined, title: string, target: string): ToolLink[] {
  return href ? [{ href, title, target }] : []
}

/** 结果区的加载与失败状态；字段错误显示在表单内，这里不重复 */
export function ResultStatus<R>({
  state,
  children,
}: {
  state: ToolState<R>
  children: (result: R) => ReactNode
}) {
  if (state.status === 'loading')
    return (
      <p role="status" className="m-0 text-ink-muted">
        {m.tools_result_loading()}
      </p>
    )
  if (state.status === 'error')
    return (
      <p role="alert" className="m-0 rounded-lg border border-brand px-4 py-3 text-ink">
        {m.bazi_engine_error()}
      </p>
    )
  if (state.status === 'done') return <>{children(state.result)}</>
  return null
}

/** 结果末尾：分享链接与引擎版本（结果可复现，见 specs/bazi-chart「结果可复现」） */
export function ResultFooter({
  share,
  engineVersion,
}: {
  share: Readonly<Record<string, unknown>>
  engineVersion: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <ShareLink input={share} />
      <p className="m-0 text-ink-subtle text-xs">
        {m.bazi_engine_version({ version: engineVersion })}
      </p>
    </div>
  )
}

export { ReadingSlots } from '../reading-slots.tsx'

/** 结果区内的两栏网格；最小列宽不超过容器，避免窄屏横向滚动 */
export const twoColumns = 'grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5'
