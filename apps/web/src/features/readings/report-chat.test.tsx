// @vitest-environment happy-dom

import {
  estimateCredits,
  estimateInputTokens,
  MIN_OUTPUT_TOKENS,
  planTextBudget,
} from '@xuanxue/ai'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PickerModel } from '../ai/model-picker.ts'
import type { SubjectChatData } from '../ai/subject-chat.server.ts'
import type { ReadingView } from './readings.functions.ts'

// adopt-subject-chat-readings tasks.md 5.1：报告页在 ready 时显示追问区（生成中 / 失败不显示），
// 追问区的开场问题、新建前的「预计 · 余额」与无可用模型空态。

const fn = vi.hoisted(() => ({
  getSubjectChat: vi.fn(),
  getPickerModels: vi.fn(),
  startSubjectConversation: vi.fn(),
  getChatCostContext: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, hash }: { children: React.ReactNode; hash?: string }) => (
    <a href={hash ? `/app/me/billing#${hash}` : '#'}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: () => undefined,
}))
vi.mock('./readings.functions.ts', () => ({
  deleteReading: vi.fn(),
  getReading: vi.fn(),
  listReadings: vi.fn(),
}))
vi.mock('../ai/subject-chat.functions.ts', () => ({
  getSubjectChat: fn.getSubjectChat,
  startSubjectConversation: fn.startSubjectConversation,
  startTemporarySubjectConversation: vi.fn(),
  setMessageFeedback: vi.fn(),
  getFollowUps: vi.fn(),
}))
vi.mock('../ai/model-picker.functions.ts', () => ({ getPickerModels: fn.getPickerModels }))
vi.mock('../ai/chat-cost.functions.ts', () => ({ getChatCostContext: fn.getChatCostContext }))
vi.mock('../ai/conversations.functions.ts', () => ({ renameConversation: vi.fn() }))
vi.mock('../marketing/pricing-snapshot.ts', () => ({ pricingSnapshot: { plans: [] } }))

import { subjectSystemText } from '../ai/subject-context.ts'
import ReportChat from './report-chat.tsx'
import { ReadingReportPage } from './report-page.tsx'
import { readingContext } from './subjects.ts'

const READING_ID = '01a1d5f1-7014-7371-bed6-d8d78223581b'
const model: PickerModel = {
  id: '00000000-0000-4000-8000-000000000002',
  key: 'reading-model',
  supportsThinking: false,
  pricing: { mode: 'token', inputPer1k: 2, outputPer1k: 10, minCharge: 1 },
}
const openers = [
  '我的喜用神在日常生活中怎麼用？',
  '大運轉換那幾年要注意什麼？',
  '事業章節提到的方向，適合哪些行業？',
]
const chatData = (
  conversation: SubjectChatData['conversation'] = null,
): SubjectChatData & {
  readOnly: boolean
} => ({
  subject: {
    type: 'reading',
    label: '報告',
    title: '完整命盤分析',
    suggestions: openers,
    defaultModelKey: 'reading-model',
  },
  conversation,
  conversations: conversation ? [{ ...conversation, updatedAt: new Date() }] : [],
  messages: [],
  feedback: {},
  readOnly: false,
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  fn.getSubjectChat.mockResolvedValue(chatData())
  fn.getPickerModels.mockResolvedValue([model])
  fn.getChatCostContext.mockResolvedValue({
    availableCredits: 126,
    prefixChars: 0,
    minOutputTokens: 256,
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

const view = (status: ReadingView['status']): ReadingView => ({
  id: READING_ID,
  kind: 'bazi-full',
  status,
  locale: 'zh-Hant',
  createdAt: '2026-11-14T00:00:00.000Z',
  content: status === 'ready' ? '## 總論\n\n日主庚金。' : '',
})

describe('报告页追问区', () => {
  it('ready：正文之后显示追问区，打印时隐藏，并按报告 ID 读取对象对话', async () => {
    await act(async () => root.render(<ReadingReportPage slug="me" initial={view('ready')} />))
    await flush()
    await flush()
    const section = container.querySelector('[data-testid="reading-chat"]')
    expect(section).not.toBeNull()
    expect(section?.className).toContain('print:hidden')
    expect(fn.getSubjectChat).toHaveBeenCalledWith({
      data: { slug: 'me', subject: { type: 'reading', id: READING_ID } },
    })
  })

  it.each(['generating', 'failed'] as const)('%s：不显示追问区，也不读取对话', async (status) => {
    await act(async () => root.render(<ReadingReportPage slug="me" initial={view(status)} />))
    await flush()
    expect(container.querySelector('[data-testid="reading-chat"]')).toBeNull()
    expect(fn.getSubjectChat).not.toHaveBeenCalled()
  })
})

describe('ReportChat', () => {
  const render = async () => {
    await act(async () => root.render(<ReportChat slug="me" readingId={READING_ID} />))
    await flush()
    await flush()
  }

  it('还没有追问：显示报告类型的开场问题与「预计 · 余额」', async () => {
    await render()
    const chips = [...container.querySelectorAll('button')].map((b) => b.textContent)
    for (const question of openers) expect(chips).toContain(question)
    const cost = container.querySelector('[data-testid="chat-cost"]')
    expect(cost?.textContent).toContain('126')
    // 新建前只传对象引用，由服务端构建完整前缀
    expect(fn.getChatCostContext).toHaveBeenCalledWith({
      data: { slug: 'me', subject: { type: 'reading', id: READING_ID } },
    })
  })

  it('首次发送前：长报告的预计下限不低于包含完整对象上下文的服务端最低预扣', async () => {
    const content = '日主庚金，结合命盘与大运作反思。'.repeat(300).slice(0, 4232)
    const system = subjectSystemText(
      'reading',
      readingContext({
        kind: 'bazi-full',
        locale: 'zh-Hant',
        content,
        input: {
          calendar: 'solar',
          year: 1990,
          month: 5,
          day: 17,
          time: { hour: 8, minute: 30 },
          gender: 'female',
          location: { city: 'taipei' },
        },
        createdAt: new Date('2026-11-16T00:00:00Z'),
        engineVersion: 'bazi-v1',
        promptVersion: 'v1',
      }),
    )
    const pricing = { mode: 'token', inputPer1k: 1, outputPer1k: 1, minCharge: 1 } as const
    fn.getPickerModels.mockResolvedValue([{ ...model, key: 'deepseek-flash', pricing }])
    fn.getChatCostContext.mockImplementation(async ({ data }) => ({
      availableCredits: 6,
      minOutputTokens: 256,
      prefixChars: data.subject ? [...system].length : 0,
    }))
    const inputTokens = estimateInputTokens([{ text: system }, { text: '' }])
    const minimum = estimateCredits(pricing, { inputTokens, maxOutputTokens: MIN_OUTPUT_TOKENS })
    expect(system.length).toBeGreaterThan(7000)
    expect(minimum).toBeGreaterThan(6)
    expect(() =>
      planTextBudget({ pricing, inputTokens, balance: minimum - 1, maxOutputTokens: 12000 }),
    ).toThrow()
    await act(async () => root.render(<ReportChat slug="me" readingId={READING_ID} />))
    await flush()
    await flush()
    const text = container.querySelector('[data-testid="chat-cost"]')?.textContent ?? ''
    const lower = Number(text.match(/\d+/)?.[0])
    expect(lower, text).toBeGreaterThanOrEqual(minimum)
  })

  it('没有可用对话模型：显示空态与购买积分入口，不显示输入框与开场问题', async () => {
    fn.getPickerModels.mockResolvedValue([])
    await render()
    const empty = container.querySelector('[data-testid="report-chat-unavailable"]')
    expect(empty).not.toBeNull()
    expect(empty?.querySelector('a')?.getAttribute('href')).toBe('/app/me/billing#credit-packs')
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.textContent).not.toContain(openers[0])
  })

  it('读取失败：显示错误提示', async () => {
    fn.getSubjectChat.mockRejectedValue(new Error('boom'))
    await render()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })
})
