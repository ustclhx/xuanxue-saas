import { createFileRoute } from '@tanstack/react-router'
import { ChatUnavailable } from '../../../../features/ai/chat-unavailable.tsx'
import { ConversationList } from '../../../../features/ai/conversation-list.tsx'
import { listConversations } from '../../../../features/ai/conversations.functions.ts'
import { m } from '../../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/chat/')({
  loader: async ({ params, context }) => {
    if (context.chatModels.length === 0) return { kind: 'unavailable' as const }
    return { kind: 'list' as const, page: await listConversations({ data: { slug: params.slug } }) }
  },
  staleTime: 0,
  head: () => ({ meta: [{ title: m.ai_chat_list_title() }] }),
  component: ConversationsPage,
})

function ConversationsPage() {
  const data = Route.useLoaderData()
  const { slug } = Route.useParams()
  if (data.kind === 'unavailable') return <ChatUnavailable slug={slug} />
  return <ConversationList slug={slug} page={data.page} />
}
