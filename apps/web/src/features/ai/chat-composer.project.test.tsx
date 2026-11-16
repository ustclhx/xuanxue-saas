// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatCostContext } from './chat-cost.server.ts'
import type { PickerModel } from './model-picker.ts'

const api = vi.hoisted(() => ({
  matches: [] as { routeId: string; params: { slug: string }; search: { token: string } }[],
  getChatCostContext: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { matches: typeof api.matches }) => unknown }) =>
    select({ matches: api.matches }),
}))
vi.mock('./chat-cost.functions.ts', () => ({ getChatCostContext: api.getChatCostContext }))
vi.mock('./conversations.functions.ts', () => ({ renameConversation: vi.fn() }))
vi.mock('./subject-chat.functions.ts', () => ({
  getFollowUps: vi.fn(),
  setMessageFeedback: vi.fn(),
}))
vi.mock('../marketing/pricing-snapshot.ts', () => ({ pricingSnapshot: { plans: [] } }))

import { ProjectComposerEstimate } from './chat-composer.project.tsx'
import { ChatSession } from './chat-session.ts'

const model: PickerModel = {
  id: 'deepseek-flash',
  key: 'deepseek-flash',
  supportsThinking: false,
  pricing: { mode: 'token', inputPer1k: 1, outputPer1k: 1, minCharge: 1 },
}
let session: ChatSession
const route = (slug: string, token: string) => {
  api.matches = [{ routeId: '/app/$slug/chat/context', params: { slug }, search: { token } }]
}
const estimate = () =>
  ProjectComposerEstimate ? (
    <ProjectComposerEstimate session={session} model={model} inputTokens={8} />
  ) : null

beforeEach(() => {
  route('me', 'signed-token')
  api.getChatCostContext.mockReset().mockResolvedValue({
    availableCredits: 6,
    prefixChars: 7603,
    minOutputTokens: 256,
  })
  session = new ChatSession({ slug: 'me', title: '', models: [model], readOnly: false })
})
afterEach(() => {
  cleanup()
  session.dispose()
})

describe('项目预计消耗扩展点', () => {
  it('临时对象首次发送前传令牌，创建后只读取持久前缀，不重复计入', async () => {
    const view = render(estimate())
    await waitFor(() => expect(screen.getByTestId('chat-cost').textContent).toContain('~8–9'))
    expect(api.getChatCostContext).toHaveBeenLastCalledWith({
      data: { slug: 'me', token: 'signed-token' },
    })
    session.conversationId = '01900000-0000-7000-8000-000000000001'
    view.rerender(estimate())
    await waitFor(() =>
      expect(api.getChatCostContext).toHaveBeenLastCalledWith({
        data: { slug: 'me', conversationId: session.conversationId },
      }),
    )
    await waitFor(() => expect(screen.getByTestId('chat-cost').textContent).toContain('~8–9'))
  })

  it('仅在当前会话空间的临时对象页读取令牌', async () => {
    route('other', 'foreign-token')
    render(estimate())
    await waitFor(() =>
      expect(api.getChatCostContext).toHaveBeenCalledWith({ data: { slug: 'me' } }),
    )
  })

  it('切换临时来源时不显示旧估算，也不接受旧请求的迟到结果', async () => {
    let resolveOld!: (cost: ChatCostContext) => void
    api.getChatCostContext.mockImplementationOnce(
      () =>
        new Promise<ChatCostContext>((resolve) => {
          resolveOld = resolve
        }),
    )
    const view = render(estimate())
    route('me', 'next-token')
    api.getChatCostContext.mockResolvedValue({
      availableCredits: 20,
      prefixChars: 1000,
      minOutputTokens: 256,
    })
    view.rerender(estimate())
    await waitFor(() => expect(screen.getByTestId('chat-cost').textContent).toContain('~2 credits'))
    await act(async () =>
      resolveOld({ availableCredits: 6, prefixChars: 7603, minOutputTokens: 256 }),
    )
    expect(screen.getByTestId('chat-cost').textContent).toContain('~2 credits')
    expect(screen.getByTestId('chat-cost').textContent).toContain('20')
  })
})
