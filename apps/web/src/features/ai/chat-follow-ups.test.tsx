// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import templateConfig from '../../../../../template.config.ts'
import { m } from '../../paraglide/messages.js'
import type { ChatUIMessage } from './conversation.ts'
import type { PickerModel } from './model-picker.ts'

// adopt-subject-chat-readings tasks.md 6.1：项目开启回复后推荐追问（平台承担、沿用回复模型、3 条）。
// 对话一轮后显示推荐问题，点击即作为用户消息发送；生成失败（服务端已吞掉错误返回空列表，
// 或请求本身失败）时回复照常、不显示推荐区。服务端的生成、缓存、不写入历史与故障注入见
// test/ai-subject-chat.test.ts「follow-up questions」。

const chat = vi.hoisted(() => ({
  messages: [] as ChatUIMessage[],
  onFinish: undefined as
    | ((event: { messages: ChatUIMessage[]; isError: boolean; isAbort: boolean }) => void)
    | undefined,
  sendMessage: vi.fn(),
  getFollowUps: vi.fn(),
}))

vi.mock('@ai-sdk/react', () => ({
  useChat: ({ onFinish }: { onFinish: typeof chat.onFinish }) => {
    chat.onFinish = onFinish
    return {
      messages: chat.messages,
      status: 'ready',
      error: undefined,
      sendMessage: chat.sendMessage,
      stop: vi.fn(),
      clearError: vi.fn(),
    }
  },
}))
vi.mock('./subject-chat.functions.ts', () => ({
  getFollowUps: chat.getFollowUps,
  setMessageFeedback: vi.fn(),
}))
vi.mock('./conversations.functions.ts', () => ({ renameConversation: vi.fn() }))
vi.mock('./chat-cost.functions.ts', () => ({
  getChatCostContext: vi.fn().mockResolvedValue({ availableCredits: 100, prefixChars: 0 }),
}))
vi.mock('../marketing/pricing-snapshot.ts', () => ({ pricingSnapshot: { plans: [] } }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/app/me/billing">{children}</a>,
  useNavigate: () => vi.fn(),
}))

import { ChatPage } from './chat-page.tsx'

const model: PickerModel = {
  id: 'm',
  key: 'deepseek',
  pricing: { mode: 'per_call', credits: 1 },
  supportsThinking: false,
}
const REPLY_ID = '01a1d5f1-7014-7371-bed6-d8d78223581b'
const QUESTIONS = ['那一年適合換工作嗎？', '和大運的關係是什麼？', '要怎麼調整作息？']
const turn: ChatUIMessage[] = [
  { id: 'u', role: 'user', parts: [{ type: 'text', text: '流年要注意什麼？' }], metadata: {} },
  {
    id: 'a',
    role: 'assistant',
    parts: [{ type: 'text', text: '依報告……' }],
    metadata: { messageId: REPLY_ID, status: 'completed' },
  },
]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  chat.messages = turn
  chat.sendMessage.mockReset()
  chat.getFollowUps.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function finishTurn() {
  await act(async () =>
    root.render(
      <ChatPage
        slug="me"
        variant="embedded"
        conversation={{ id: 'c', title: 'Test' }}
        storedMessages={[]}
        models={[model]}
        readOnly={false}
      />,
    ),
  )
  await act(async () => {
    chat.onFinish?.({ messages: turn, isError: false, isAbort: false })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

// showLabel 时分组以可见标题命名（aria-labelledby）
const followUpGroup = () =>
  [...container.querySelectorAll('[role="group"]')].find((node) => {
    const id = node.getAttribute('aria-labelledby')
    const name = id
      ? container.querySelector(`[id="${id}"]`)?.textContent
      : node.getAttribute('aria-label')
    return name === m.subject_chat_follow_ups()
  })

describe('回复后推荐追问（项目配置）', () => {
  it('template.config.ts 开启：3 条、平台承担、沿用回复模型', () => {
    expect(templateConfig.ai.text.followUps).toEqual({
      enabled: true,
      count: 3,
      charge: false,
      modelKey: null,
    })
  })

  it('一轮回复后显示 3 个推荐问题，点击即作为用户消息发送', async () => {
    chat.getFollowUps.mockResolvedValue({ questions: QUESTIONS })
    await finishTurn()
    expect(chat.getFollowUps).toHaveBeenCalledWith({ data: { slug: 'me', messageId: REPLY_ID } })
    const group = followUpGroup()
    expect(group).toBeDefined()
    const buttons = [...(group?.querySelectorAll('button') ?? [])]
    expect(buttons.map((button) => button.textContent)).toEqual(QUESTIONS)
    await act(async () => buttons[1]?.click())
    expect(chat.sendMessage).toHaveBeenCalledWith({ text: QUESTIONS[1] })
  })

  it.each([
    ['服务端生成失败返回空列表', () => chat.getFollowUps.mockResolvedValue({ questions: [] })],
    ['请求失败', () => chat.getFollowUps.mockRejectedValue(new Error('upstream down'))],
  ])('%s：回复照常显示，不出现推荐区也没有错误提示', async (_name, arrange) => {
    arrange()
    await finishTurn()
    expect(container.textContent).toContain('依報告……')
    expect(followUpGroup()).toBeUndefined()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
