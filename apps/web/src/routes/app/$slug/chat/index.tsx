import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getChatContext } from '../../../../features/ai/chat-context.functions.ts'
import { ChatContextStart } from '../../../../features/ai/chat-context-start.tsx'
import { ChatUnavailable } from '../../../../features/ai/chat-unavailable.tsx'
import { ConversationList } from '../../../../features/ai/conversation-list.tsx'
import { listConversations } from '../../../../features/ai/conversations.functions.ts'

export const Route = createFileRoute('/app/$slug/chat/')({
  // `?context=` 来自结果页「用这个结果问 AI」：签名令牌，不含出生信息（chat-context.ts）
  validateSearch: z.object({ context: z.string().min(1).max(1024).optional() }),
  loaderDeps: ({ search }) => ({ context: search.context }),
  loader: async ({ params, deps, context }) => {
    if (context.chatModels.length === 0) return { kind: 'unavailable' as const }
    if (deps.context)
      return {
        kind: 'context' as const,
        token: deps.context,
        opened: await getChatContext({ data: { slug: params.slug, token: deps.context } }),
      }
    return { kind: 'list' as const, page: await listConversations({ data: { slug: params.slug } }) }
  },
  staleTime: 0,
  head: () => ({ meta: [{ title: 'Chats' }] }),
  component: ConversationsPage,
})

function ConversationsPage() {
  const data = Route.useLoaderData()
  const { slug } = Route.useParams()
  if (data.kind === 'unavailable') return <ChatUnavailable slug={slug} />
  if (data.kind === 'context')
    return <ChatContextStart slug={slug} token={data.token} opened={data.opened} />
  return <ConversationList slug={slug} page={data.page} />
}
