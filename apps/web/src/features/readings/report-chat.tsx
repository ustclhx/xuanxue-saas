import { Link } from '@tanstack/react-router'
import { cn } from '@xuanxue/ui'
import { type ReactNode, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { ChatCostPrefixHint } from '../ai/chat-cost.tsx'
import { getPickerModels } from '../ai/model-picker.functions.ts'
import type { PickerModel } from '../ai/model-picker.ts'
import { getSubjectChat, startSubjectConversation } from '../ai/subject-chat.functions.ts'
import type { SubjectChatData } from '../ai/subject-chat.server.ts'
import { SubjectChatView } from '../ai/subject-chat.tsx'
import { FormAlert } from '../auth/auth-layout.tsx'
import { READING_SUBJECT_TYPE } from './subject-type.ts'

/**
 * 报告页内追问的对话区（adopt-subject-chat-readings tasks.md 5.1，设计稿 roadmap/ReportChat 与 States）。
 *
 * 与模板 `<SubjectChat>` 同一数据流（getSubjectChat + getPickerModels → `SubjectChatView`，模板 0.5.0 起为
 * `EmbeddedChat` 外壳：≥ 768px 为正文中的卡片，< 768px 为悬浮按钮 + 底部抽屉），不修改模板文件；项目在外层多做两件事：
 * - 空间没有可用对话模型且还没有追问时，整块显示报告专用空态与购买入口，不显示输入框；
 * - 还没有对话时服务端尚未写入上下文前缀，以报告正文长度作为「预计 · 余额」的前缀估算（ChatCostPrefixHint）。
 * 由报告页经 React.lazy 加载（默认导出），不进入报告页首屏 bundle。
 */

type Loaded = SubjectChatData & { readOnly: boolean; models: readonly PickerModel[] }

/** 标题与隐私说明；对话就绪时手机上不显示（对话在悬浮按钮打开的底部抽屉中） */
function ReportChatHeader({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1', className)}>
      <h2 id="reading-chat-title" className="m-0 font-heading font-bold text-ink text-xl">
        {m.readings_chat_title()}
      </h2>
      <span className="text-ink-subtle text-sm">{m.readings_chat_note()}</span>
    </div>
  )
}

/** 读取中、出错与没有模型时的卡片 */
function ReportChatPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <ReportChatHeader />
      {children}
    </div>
  )
}

export default function ReportChat({
  slug,
  readingId,
  content,
}: {
  slug: string
  readingId: string
  /** 报告正文：新建对话前估算上下文前缀 */
  content: string
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; notFound: boolean }
    | { status: 'ready'; data: Loaded }
  >({ status: 'loading' })
  const subject = { type: READING_SUBJECT_TYPE, id: readingId }

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    Promise.all([
      getSubjectChat({ data: { slug, subject: { type: READING_SUBJECT_TYPE, id: readingId } } }),
      getPickerModels({ data: { slug, kind: 'text' } }),
    ])
      .then(([chat, models]) => {
        if (!cancelled) setState({ status: 'ready', data: { ...chat, models } })
      })
      .catch((error: unknown) => {
        // 越权、不存在与未就绪的报告都以 404（router notFound）返回
        const notFound = typeof error === 'object' && error !== null && 'isNotFound' in error
        if (!cancelled) setState({ status: 'error', notFound })
      })
    return () => {
      cancelled = true
    }
  }, [slug, readingId])

  if (state.status === 'loading')
    return (
      <ReportChatPanel>
        <ReportChatSkeleton />
      </ReportChatPanel>
    )
  if (state.status === 'error')
    return (
      <ReportChatPanel>
        <FormAlert
          message={state.notFound ? m.subject_chat_not_found() : m.subject_chat_load_failed()}
        />
      </ReportChatPanel>
    )
  const { data } = state
  if (data.models.length === 0 && data.conversation === null)
    return (
      <ReportChatPanel>
        <ReportChatUnavailable slug={slug} />
      </ReportChatPanel>
    )
  return (
    <div className="flex flex-col gap-3">
      <ReportChatHeader className="max-md:hidden" />
      <ChatCostPrefixHint value={[...content].length}>
        <SubjectChatView
          variant="inline"
          slug={slug}
          data={data}
          models={data.models}
          start={async () => {
            const result = await startSubjectConversation({ data: { slug, subject } })
            if (!result.ok) throw new Error(result.error)
            return result.result.id
          }}
          loadConversation={(conversationId) =>
            getSubjectChat({ data: { slug, subject, conversationId } })
          }
        />
      </ChatCostPrefixHint>
    </div>
  )
}

/** 读取中：固定高度骨架，避免版面位移（设计稿 States「加载态」） */
export function ReportChatSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={m.subject_chat_loading()}
      data-testid="report-chat-loading"
      className="flex min-h-40 flex-col gap-3"
    >
      <div className="h-10 w-3/4 rounded-full bg-surface-2" />
      <div className="h-10 w-2/3 rounded-full bg-surface-2" />
      <div className="h-24 rounded-lg bg-surface-2" />
    </div>
  )
}

/** 没有可用对话模型（设计稿 States「錯誤態」）：报告照常阅读，给出购买积分入口，不显示输入框 */
export function ReportChatUnavailable({ slug }: { slug: string }) {
  return (
    <div data-testid="report-chat-unavailable" className="flex flex-col gap-2.5">
      <strong className="text-base text-ink">{m.readings_chat_unavailable_title()}</strong>
      <p className="m-0 text-ink-muted text-sm leading-relaxed">
        {m.readings_chat_unavailable_body()}
      </p>
      <Link
        to="/app/$slug/billing"
        params={{ slug }}
        hash="credit-packs"
        className="inline-flex min-h-11 items-center self-start rounded-lg bg-brand px-5 font-semibold text-on-brand no-underline hover:opacity-90"
      >
        {m.ai_chat_unavailable_cta()}
      </Link>
    </div>
  )
}
