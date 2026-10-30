import { Link } from '@tanstack/react-router'
import type { SiteId } from '@xuanxue/config'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { useSiteId } from '../site/context.tsx'
import { AiDisclaimer } from '../tools/disclaimer.tsx'
import { TOOL_ROUTES, toolsForLocale } from '../tools/registry.ts'
import { toolHref } from '../tools/tool-href.ts'
import { toTraditional } from './hant.ts'
import { Markdown, parseMarkdown, sectionId } from './markdown.tsx'
import {
  deleteReading,
  getReading,
  listReadings,
  type ReadingListItem,
  type ReadingView,
} from './readings.functions.ts'
import { readingTitle } from './title.ts'

/**
 * 应用区的详批报告（add-reading-monetization tasks.md 3.2）：列表与阅读页。
 * 报告页带 noindex（路由 head）且只有空间成员可访问（withWorkspace，非成员 404）。
 * 生成中的报告每 3 秒刷新一次，显示已写入的部分正文，直到完成或失败。
 */

const POLL_MS = 3000

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

function StatusLabel({ status }: { status: ReadingView['status'] }) {
  const text =
    status === 'ready'
      ? m.readings_status_ready()
      : status === 'generating'
        ? m.readings_status_generating()
        : m.readings_status_failed()
  return (
    <span
      data-status={status}
      className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 text-ink-muted text-xs"
    >
      {text}
    </span>
  )
}

export function ReadingReportPage({ slug, initial }: { slug: string; initial: ReadingView }) {
  const [view, setView] = useState(initial)
  useEffect(() => setView(initial), [initial])
  useEffect(() => {
    if (view.status !== 'generating') return
    const timer = window.setTimeout(() => {
      getReading({ data: { slug, id: view.id } })
        .then(setView)
        .catch(() => {})
    }, POLL_MS)
    return () => window.clearTimeout(timer)
  }, [slug, view])

  // 生成中轮询到的是模型原文，与保存时同样把简体字换成繁体（已保存的正文不变）
  const content = toTraditional(view.content, view.locale)
  const headings = parseMarkdown(content).filter(
    (block): block is Extract<typeof block, { type: 'heading' }> =>
      block.type === 'heading' && block.level === 2,
  )
  return (
    <article
      lang={view.locale}
      data-testid="reading-report"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-12"
    >
      <Link
        to="/app/$slug/readings"
        params={{ slug }}
        className="inline-flex min-h-11 items-center self-start text-ink-muted text-sm"
      >
        ← {m.readings_report_back()}
      </Link>
      <header className="flex flex-col gap-2.5">
        <h1 className="m-0 font-heading font-bold text-[28px] text-ink leading-tight sm:text-[36px]">
          {readingTitle(view.kind, view.locale)}
        </h1>
        <p className="m-0 flex flex-wrap items-center gap-3 text-ink-subtle text-sm">
          <StatusLabel status={view.status} />
          {m.readings_report_created({ date: formatDate(view.createdAt) })}
        </p>
      </header>
      {view.status === 'generating' && (
        <p role="status" className="m-0 rounded-lg bg-surface-2 px-4 py-3 text-ink-muted text-sm">
          {m.readings_report_generating_note()}
        </p>
      )}
      {view.status === 'failed' && (
        <p role="alert" className="m-0 rounded-lg border border-brand px-4 py-3 text-ink">
          {m.readings_report_failed()}
        </p>
      )}
      {view.status === 'ready' && headings.length > 2 && (
        <nav
          aria-label={m.readings_report_contents()}
          className="rounded-xl border border-line bg-surface px-5 py-4 print:hidden"
        >
          <h2 className="m-0 mb-2 font-semibold text-ink-muted text-sm">
            {m.readings_report_contents()}
          </h2>
          <ol className="m-0 grid gap-x-6 gap-y-1 pl-5 text-[15px] sm:grid-cols-2">
            {headings.map((heading, index) => (
              <li key={heading.text}>
                <a href={`#${sectionId(heading.text, index)}`} className="text-brand-ink">
                  {heading.text.replaceAll('*', '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {content && (
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-8">
          <Markdown source={content} />
        </div>
      )}
      {view.status === 'ready' && (
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 self-start rounded-lg border border-line-strong px-5 text-ink print:hidden"
        >
          {m.readings_report_print()}
        </button>
      )}
      <AiDisclaimer />
    </article>
  )
}

/**
 * 报告列表空态的免费工具链接：只取当前站点的工具；当前语言不属于本站（应用区语言来自用户偏好）时
 * 退回本站默认语言，避免链到另一站。
 */
export function freeToolLinks(locale: string, site: SiteId) {
  const routes = TOOL_ROUTES.filter((route) => route.site === site)
  let linkLocale = locale
  let tools = toolsForLocale(linkLocale, routes)
  const fallback = templateConfig.sites[site].defaultLocale
  if (tools.length === 0 && fallback) {
    linkLocale = fallback
    tools = toolsForLocale(linkLocale, routes)
  }
  return tools.map((tool) => ({
    id: tool.id,
    title: tool.title,
    href: toolHref(tool.path, linkLocale),
  }))
}

/**
 * 空列表的提示（product-improve-ai-content tasks.md 2.6）：本站本语言至少一种详批可用时才说
 * 「可在免费结果下方解锁」，否则只给中性说明与免费工具链接，不承诺可解锁。
 */
function EmptyReadings({ unlockable }: { unlockable: boolean }) {
  const site = useSiteId()
  if (unlockable)
    return (
      <p data-testid="readings-empty" className="m-0 text-ink-muted">
        {m.readings_list_empty()}
      </p>
    )
  const links = freeToolLinks(getLocale(), site)
  return (
    <div data-testid="readings-empty" className="flex flex-col gap-3">
      <p className="m-0 text-ink-muted">{m.readings_list_empty_neutral()}</p>
      {links.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-ink text-sm no-underline hover:bg-surface-2"
              >
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ReadingsListPage({
  slug,
  initial,
  unlockable,
}: {
  slug: string
  initial: { items: readonly ReadingListItem[]; nextCursor: string | null }
  /** 当前站点与语言下至少一种详批可用；读取失败按不可用处理 */
  unlockable: boolean
}) {
  const [items, setItems] = useState(initial.items)
  const [cursor, setCursor] = useState(initial.nextCursor)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setItems(initial.items)
    setCursor(initial.nextCursor)
  }, [initial])

  const more = async () => {
    if (!cursor) return
    setBusy(true)
    try {
      const page = await listReadings({ data: { slug, cursor } })
      setItems((current) => [...current, ...page.items])
      setCursor(page.nextCursor)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id: string) => {
    if (!window.confirm(m.readings_delete_confirm())) return
    await deleteReading({ data: { slug, id } })
    setItems((current) => current.filter((item) => item.id !== id))
  }

  return (
    <section aria-labelledby="readings-title" className="flex flex-col gap-5">
      <h2 id="readings-title" className="m-0 font-heading font-semibold text-2xl text-ink">
        {m.readings_list_title()}
      </h2>
      {items.length === 0 ? (
        <EmptyReadings unlockable={unlockable} />
      ) : (
        <ul data-testid="readings-list" className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item) => (
            <li
              key={item.id}
              data-reading-id={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  to="/app/$slug/readings/$readingId"
                  params={{ slug, readingId: item.id }}
                  className="font-semibold text-ink"
                >
                  {readingTitle(item.kind, item.locale)}
                </Link>
                <span className="flex flex-wrap items-center gap-2 text-ink-subtle text-xs">
                  <StatusLabel status={item.status} />
                  {formatDate(item.createdAt)}
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/app/$slug/readings/$readingId"
                  params={{ slug, readingId: item.id }}
                  className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-ink text-sm"
                >
                  {m.readings_open()}
                </Link>
                {item.status !== 'generating' && (
                  <button
                    type="button"
                    onClick={() => void remove(item.id)}
                    className="min-h-11 rounded-lg px-4 text-ink-muted text-sm hover:bg-surface-2"
                  >
                    {m.readings_delete()}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <button
          type="button"
          onClick={() => void more()}
          disabled={busy}
          className="min-h-11 self-start rounded-lg border border-line-strong px-5 text-ink"
        >
          {m.readings_load_more()}
        </button>
      )}
    </section>
  )
}
