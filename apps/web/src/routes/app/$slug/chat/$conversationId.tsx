import { createFileRoute, Link } from '@tanstack/react-router'
import { ChatPage } from '../../../../features/ai/chat-page.tsx'
import { getConversation } from '../../../../features/ai/conversations.functions.ts'

export const Route = createFileRoute('/app/$slug/chat/$conversationId')({
  // 模型列表由对话区布局（chat/route.tsx）读取，这里沿用
  loader: async ({ params, context }) => {
    const input = { slug: params.slug, conversationId: params.conversationId }
    const page = await getConversation({ data: input })
    return { ...page, models: context.chatModels }
  },
  staleTime: 0,
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.conversation.title || 'New chat' }] : [],
  }),
  component: ConversationPage,
  notFoundComponent: () => {
    const { slug } = Route.useParams()
    return (
      <section className="grid gap-2">
        <h2 className="text-2xl font-semibold">Conversation not found</h2>
        <p>This conversation does not exist or you do not have access to it.</p>
        <Link to="/app/$slug/chat" params={{ slug }} className="underline">
          Back to chats
        </Link>
      </section>
    )
  },
})

function ConversationPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  return (
    <ChatPage
      key={page.conversation.id}
      slug={slug}
      conversation={page.conversation}
      storedMessages={page.messages}
      models={page.models}
      chatContext={page.chatContext}
      readOnly={page.readOnly}
    />
  )
}
