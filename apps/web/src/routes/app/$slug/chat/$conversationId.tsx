import { createFileRoute, Link } from '@tanstack/react-router'
import { ChatContextSummary } from '../../../../features/ai/chat-context-summary-card.tsx'
import { ChatPage } from '../../../../features/ai/chat-page.tsx'
import { getConversation } from '../../../../features/ai/conversations.functions.ts'
import { m } from '../../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/chat/$conversationId')({
  // 模型列表由对话区布局（chat/route.tsx）读取，这里沿用
  loader: async ({ params, context }) => {
    const input = { slug: params.slug, conversationId: params.conversationId }
    const page = await getConversation({ data: input })
    return { ...page, models: context.chatModels }
  },
  staleTime: 0,
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.conversation.title || m.ai_chat_new_chat() }] : [],
  }),
  component: ConversationPage,
  notFoundComponent: () => {
    const { slug } = Route.useParams()
    return (
      <section className="grid gap-2">
        <h2 className="text-2xl font-semibold">{m.ai_chat_not_found_title()}</h2>
        <p>{m.ai_chat_not_found_body()}</p>
        <Link to="/app/$slug/chat" params={{ slug }} className="underline">
          {m.ai_chat_back_to_chats()}
        </Link>
      </section>
    )
  },
})

function ConversationPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  // 发布前的旧带盘对话在对话之上显示原命盘摘要（legacy-chat-context.ts）
  return (
    <div className="grid gap-4">
      {page.chatContext ? <ChatContextSummary context={page.chatContext} /> : null}
      <ChatPage
        key={page.conversation.id}
        slug={slug}
        conversation={page.conversation}
        storedMessages={page.messages}
        models={page.models}
        readOnly={page.readOnly}
        initialFeedback={page.feedback}
      />
    </div>
  )
}
