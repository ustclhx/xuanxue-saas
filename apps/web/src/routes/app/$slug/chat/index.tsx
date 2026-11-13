import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { upgradeLegacyChatContextLink } from '../../../../features/ai/chat-context.functions.ts'
import { ChatUnavailable } from '../../../../features/ai/chat-unavailable.tsx'
import { ConversationList } from '../../../../features/ai/conversation-list.tsx'
import { listConversations } from '../../../../features/ai/conversations.functions.ts'
import { TemporarySubjectChat } from '../../../../features/ai/subject-chat.tsx'
import { m } from '../../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/chat/')({
  // `?context=` 是发布前签发的旧链接（legacy-chat-context.ts）：有效时换发新令牌并跳到
  // `/chat/context?token=`，过期或无效时显示模板临时上下文页的对应状态。下一次发布删除（tasks.md 8.1）。
  validateSearch: z.object({ context: z.string().min(1).max(1024).optional() }),
  loaderDeps: ({ search }) => ({ context: search.context }),
  loader: async ({ params, deps, context }) => {
    if (context.chatModels.length === 0) return { kind: 'unavailable' as const }
    if (deps.context) {
      const upgraded = await upgradeLegacyChatContextLink({
        data: { slug: params.slug, token: deps.context },
      })
      if (upgraded.status === 'ok')
        throw redirect({
          to: '/app/$slug/chat/context',
          params: { slug: params.slug },
          search: { token: upgraded.token },
          replace: true,
        })
      return { kind: 'legacy' as const, page: { ...upgraded, readOnly: false } }
    }
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
  if (data.kind === 'legacy')
    return <TemporarySubjectChat slug={slug} token="" page={data.page} models={[]} />
  return <ConversationList slug={slug} page={data.page} />
}
