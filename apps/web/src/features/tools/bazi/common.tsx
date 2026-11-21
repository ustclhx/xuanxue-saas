import type { BirthInput } from '@xuanxue/bazi'
import { type ReactNode, useEffect } from 'react'
import { m } from '../../../paraglide/messages.js'
import type { ShareCardModel } from '../share-card/model.ts'
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
  // 同一页面在各语言下 slug 不同（紫微斗數排盤 / 紫微斗数排盘）：先取该语言的 slug，避免简中页链到繁中 slug 而 404
  const page =
    EASTERN_PAGES.find((item) => item.id === id && item.locale === locale) ??
    EASTERN_PAGES.find((item) => item.id === id)
  return toolHref(`/${page?.slug ?? ''}`, locale)
}

/**
 * 只在该语言确有此页面时返回链接（没有对应页面时不回退到其他语言的 slug）：
 * 日语第一期没有命盤查詢（add-locales-eu-ja design 决策 4），链接不渲染。
 */
export function localPageHref(id: EasternPageId, locale: string): string | undefined {
  const page = EASTERN_PAGES.find((item) => item.id === id && item.locale === locale)
  return page ? toolHref(`/${page.slug}`, locale) : undefined
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
      <p role="status" className="m-0 text-caption text-ink-subtle">
        {m.tools_result_loading()}
      </p>
    )
  if (state.status === 'error')
    return (
      // 设计稿的 `.alert`：surface-2 底、6px 圆角，danger 色只用在图标上
      <p
        role="alert"
        className="m-0 flex items-start gap-2.5 rounded-field bg-surface-2 px-4 py-3 text-body text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="mt-1 shrink-0 text-danger"
        >
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6.5v4.5M10 13.6v.2" />
        </svg>
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
  card,
}: {
  share: Readonly<Record<string, unknown>>
  engineVersion: string
  /** 「保存分享图」的模型（八字、만세력、紫微结果提供） */
  card?: (() => ShareCardModel) | undefined
}) {
  return (
    <div className="flex flex-col gap-2">
      <ShareLink input={share} card={card} />
      <p className="m-0 text-caption text-ink-subtle">
        {m.bazi_engine_version({ version: engineVersion })}
      </p>
    </div>
  )
}

export { ReadingSlots } from '../reading-slots.tsx'
