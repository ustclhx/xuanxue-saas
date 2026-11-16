// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import templateConfig from '../../../../../template.config.ts'
import { m } from '../../paraglide/messages.js'
import { type FakeChatServer, fakeChatServer, startReply } from './chat-test-stream.ts'
import type { PickerModel } from './model-picker.ts'

// adopt-subject-chat-readings tasks.md 6.1：项目开启回复后推荐追问（平台承担、沿用回复模型、3 条）。
// 对话一轮后显示推荐问题，点击即作为用户消息发送；生成失败（服务端已吞掉错误返回空列表，
// 或请求本身失败）时回复照常、不显示推荐区。服务端的生成、缓存、不写入历史与故障注入见
// test/ai-subject-chat.test.ts「follow-up questions」。

const chat = vi.hoisted(() => ({ getFollowUps: vi.fn() }))

vi.mock('./subject-chat.functions.ts', () => ({
  getFollowUps: chat.getFollowUps,
  setMessageFeedback: vi.fn(),
}))
vi.mock('./conversations.functions.ts', () => ({
  renameConversation: vi.fn(async () => ({ ok: true })),
  // 回复结束后读取保存的版本：返回 null 时保留本地内容
  getChatMessage: vi.fn(async () => null),
  createConversation: vi.fn(),
  setConversationArchived: vi.fn(),
}))
vi.mock('./chat-cost.functions.ts', () => ({
  getChatCostContext: vi
    .fn()
    .mockResolvedValue({ availableCredits: 100, prefixChars: 0, minOutputTokens: 256 }),
}))
vi.mock('../analytics/track.ts', () => ({ trackEvent: vi.fn() }))
vi.mock('../marketing/pricing-snapshot.ts', () => ({ pricingSnapshot: { plans: [] } }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/app/me/billing">{children}</a>,
  useNavigate: () => vi.fn(),
  useRouterState: () => undefined,
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

// happy-dom 的 Web Animations 在取消时让 finished 拒绝（未处理）；去掉 animate，motion 改用脚本动画
Object.defineProperty(Element.prototype, 'animate', { value: undefined, configurable: true })

let server: FakeChatServer

beforeEach(() => {
  chat.getFollowUps.mockReset()
  server = fakeChatServer()
  vi.stubGlobal('fetch', server.fetch)
  window.scrollTo = vi.fn() as typeof window.scrollTo
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** 发送一条消息，模拟流式回复「依報告……」并正常结束 */
async function finishTurn() {
  render(
    <ChatPage
      slug="me"
      conversation={{ id: 'c', title: 'Test' }}
      storedMessages={[]}
      models={[model]}
      readOnly={false}
    />,
  )
  const input = screen.getByRole('textbox', { name: m.chat_ui_message() })
  fireEvent.change(input, { target: { value: '流年要注意什麼？' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(server.streams).toHaveLength(1))
  const stream = server.streams[0]
  if (!stream) throw new Error('no stream')
  act(() => {
    startReply(stream, REPLY_ID)
    stream.send({ type: 'text-start', id: 't1' })
    stream.send({ type: 'text-delta', id: 't1', delta: '依報告……' })
    stream.send({ type: 'text-end', id: 't1' })
    stream.send({ type: 'finish-step' })
    stream.finish()
  })
  await waitFor(() => expect(document.body.textContent).toContain('依報告……'))
  await waitFor(() => expect(chat.getFollowUps).toHaveBeenCalled())
  // 让推荐问题的 Promise 落定
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}

// showLabel 时分组以可见标题命名（aria-labelledby）
const followUpGroup = () =>
  [...document.querySelectorAll('[role="group"]')].find((node) => {
    const id = node.getAttribute('aria-labelledby')
    const name = id
      ? document.querySelector(`[id="${id}"]`)?.textContent
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
    await waitFor(() => expect(server.streams).toHaveLength(2))
    expect(server.streams[1]?.body).toMatchObject({
      message: { role: 'user', parts: [{ type: 'text', text: QUESTIONS[1] }] },
    })
  })

  it.each([
    ['服务端生成失败返回空列表', () => chat.getFollowUps.mockResolvedValue({ questions: [] })],
    ['请求失败', () => chat.getFollowUps.mockRejectedValue(new Error('upstream down'))],
  ])('%s：回复照常显示，不出现推荐区也没有错误提示', async (_name, arrange) => {
    arrange()
    await finishTurn()
    expect(document.body.textContent).toContain('依報告……')
    expect(followUpGroup()).toBeUndefined()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})
