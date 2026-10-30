import { Link } from '@tanstack/react-router'
import { m } from '../../paraglide/messages.js'
import { SpacePanel } from '../app-shell/space-frame.tsx'

/** 空间没有可用对话模型时的空态：说明原因并给出购买积分入口，不显示输入框 */
export function ChatUnavailable({ slug }: { slug: string }) {
  return (
    <SpacePanel title={m.ai_chat_unavailable_title()}>
      <p data-testid="chat-unavailable" className="m-0 text-ink-muted leading-relaxed">
        {m.ai_chat_unavailable_body()}
      </p>
      <Link
        to="/app/$slug/billing"
        params={{ slug }}
        className="inline-flex min-h-11 items-center self-start rounded-lg bg-brand px-5 font-semibold text-on-brand no-underline hover:opacity-90"
      >
        {m.ai_chat_unavailable_cta()}
      </Link>
    </SpacePanel>
  )
}
