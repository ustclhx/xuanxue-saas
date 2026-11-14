import { createFileRoute, Link } from '@tanstack/react-router'
import { ChatContextSummary } from '../../../../features/ai/chat-context-summary-card.tsx'
import { ChatPage, ChatPageSkeleton } from '../../../../features/ai/chat-page.tsx'
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
    meta: loaderData ? [{ title: loaderData.conversation.title || m.chat_ui_untitled() }] : [],
  }),
  component: ConversationPage,
  pendingComponent: ChatPageSkeleton,
  // 项目：路由插件默认不拆分 pendingComponent，与对话页同模块的骨架会把整个对话页（@xuanxue/ui/chat、Markdown）
  // 带进客户端入口与首页静态闭包（check-home-bundle 拦截）；单独拆分，入口不再静态导入 chat-page.tsx
  codeSplitGroupings: [
    ['component'],
    ['pendingComponent'],
    ['errorComponent'],
    ['notFoundComponent'],
  ],
  // 对话区头部即页面标题（版式取舍 2），顶部条不再显示「对话」标题
  staticData: { shellTitle: false },
  notFoundComponent: ConversationNotFound,
})

/** 顶部条不显示标题（staticData.shellTitle = false），这里是页面 h1 */
function ConversationNotFound() {
  const { slug } = Route.useParams()
  // 项目：应用区不用模板顶部条，页面标题总是 h1（与 SpacePage 一致）
  const Heading = 'h1'
  return (
    <section className="grid gap-2">
      <Heading className="text-2xl font-semibold">{m.chat_ui_not_found_title()}</Heading>
      <p>{m.chat_ui_not_found_body()}</p>
      <Link to="/app/$slug/chat" params={{ slug }} className="underline">
        {m.chat_ui_back_to_chats()}
      </Link>
    </section>
  )
}

function ConversationPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  // 发布前的旧带盘对话在对话之上显示原命盘摘要（legacy-chat-context.ts）
  return (
    <div className="grid gap-4">
      {page.chatContext ? (
        // 与对话页 720px 消息列对齐
        <div className="mx-auto w-full min-w-0 max-w-180">
          <ChatContextSummary context={page.chatContext} />
        </div>
      ) : null}
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
