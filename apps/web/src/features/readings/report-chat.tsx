import { Link } from '@tanstack/react-router'
import { estimateInputTokens } from '@xuanxue/ai/client'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { ChatCost } from '../ai/chat-cost.tsx'
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
 * 与模板 `<SubjectChat>` 同一数据流（getSubjectChat + getPickerModels → `SubjectChatView`），
 * 不修改模板文件；项目在外层多做两件事：
 * - 空间没有可用对话模型且还没有追问时，整块显示报告专用空态与购买入口，不显示输入框
 *   （已有追问时仍显示历史，由 ChatPage 以空态取代输入框）；
 * - 还没有对话时，模板视图不显示预计消耗，这里按默认模型与报告正文长度补上「预计 · 余额」，
 *   新建对话后改由 ChatPage 内的 ChatCost（计入服务端写入的上下文前缀）显示。
 * 由报告页经 React.lazy 加载（默认导出），不进入报告页首屏 bundle。
 */

type Loaded = SubjectChatData & { readOnly: boolean; models: readonly PickerModel[] }

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
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [started, setStarted] = useState(false)
  const subject = { type: READING_SUBJECT_TYPE, id: readingId }

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    Promise.all([
      getSubjectChat({
        data: {
          slug,
          subject: { type: READING_SUBJECT_TYPE, id: readingId },
          ...(conversationId ? { conversationId } : {}),
        },
      }),
      getPickerModels({ data: { slug, kind: 'text' } }),
    ])
      .then(([chat, models]) => {
        if (cancelled) return
        setStarted(chat.conversation !== null)
        setState({ status: 'ready', data: { ...chat, models } })
      })
      .catch((error: unknown) => {
        // 越权、不存在与未就绪的报告都以 404（router notFound）返回
        const notFound = typeof error === 'object' && error !== null && 'isNotFound' in error
        if (!cancelled) setState({ status: 'error', notFound })
      })
    return () => {
      cancelled = true
    }
  }, [slug, readingId, conversationId])

  if (state.status === 'loading') return <ReportChatSkeleton />
  if (state.status === 'error')
    return (
      <FormAlert
        message={state.notFound ? m.subject_chat_not_found() : m.subject_chat_load_failed()}
      />
    )
  const { data } = state
  if (data.models.length === 0 && data.conversation === null)
    return <ReportChatUnavailable slug={slug} />
  const model =
    data.models.find((item) => item.key === data.subject.defaultModelKey) ?? data.models[0]
  return (
    <div className="flex flex-col gap-3">
      <SubjectChatView
        slug={slug}
        data={data}
        models={data.models}
        start={async () => {
          const result = await startSubjectConversation({ data: { slug, subject } })
          if (!result.ok) throw new Error(result.error)
          setStarted(true)
          return result.result.id
        }}
        onSelectConversation={setConversationId}
      />
      {!started && !data.readOnly ? (
        <ChatCost
          slug={slug}
          conversationId={undefined}
          refreshKey={0}
          model={model}
          inputTokens={estimateInputTokens([{ text: content }])}
        />
      ) : null}
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
