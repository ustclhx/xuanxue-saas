// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_LOCAL_RATES } from './price.ts'
import {
  getReading,
  getReadingOffer,
  openReadingUnlock,
  type ReadingOffer,
} from './readings.functions.ts'
import { ReadingUnlock } from './unlock-card.tsx'

// 付款回跳后等待 webhook 入账（PayPal capture 回调可能晚到数分钟）：
// 前 30 秒每 2 秒、之后每 5 秒轮询余额，约 5 分钟后改为「付款已收到，点此生成」。

vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'en' }
})
vi.mock('./readings.functions.ts', () => ({
  createReadingUnlock: vi.fn(),
  getReading: vi.fn(),
  getReadingOffer: vi.fn(),
  openReadingUnlock: vi.fn(),
}))
vi.mock('../billing/customer.functions.ts', () => ({ checkoutCustomer: vi.fn() }))

const KIND = 'numerology-full'
const INPUT = { year: 1987, month: 11, day: 29 }
const offer = (balance: number): ReadingOffer => ({
  available: true,
  comingSoon: false,
  credits: 100,
  sections: ['Overview'],
  sample: 'A fictional sample paragraph.',
  packs: [{ planPriceId: 'price', provider: 'paypal', credits: 100, amount: 199 }],
  viewer: { slug: 'me', balance },
  rates: FALLBACK_LOCAL_RATES,
})

let balance = 0
let container: HTMLDivElement
let root: Root
const fetchMock = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockResolvedValue({ ok: false, status: 500, body: null })
  balance = 0
  vi.mocked(getReadingOffer).mockImplementation(async () => offer(balance))
  vi.mocked(openReadingUnlock).mockResolvedValue({ kind: KIND } as never)
  window.history.replaceState(null, '', '/?unlock=tok&checkout=success')
  window.sessionStorage.setItem(
    'xuanxue.readings.pending-unlock',
    JSON.stringify({ token: 'tok', kind: KIND, input: INPUT }),
  )
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const mount = () =>
  act(async () => root.render(<ReadingUnlock kind={KIND} request={{ input: INPUT, share: {} }} />))
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const button = () =>
  container.querySelector('[data-testid="reading-unlock-button"]') as HTMLButtonElement
const generated = () => fetchMock.mock.calls.filter(([url]) => url === '/api/readings').length

describe('解锁卡付款确认轮询', () => {
  it('前 30 秒每 2 秒一次，之后每 5 秒一次；超过 30 秒入账仍自动生成', async () => {
    await mount()
    const polls = () => vi.mocked(getReadingOffer).mock.calls.length
    const start = polls()
    await advance(30_000)
    expect(polls() - start).toBe(15)
    await advance(10_000)
    expect(polls() - start).toBe(17)
    expect(button().textContent).toBe('Confirming your payment…')

    balance = 100
    await advance(5_000)
    expect(generated()).toBe(1)
  })

  it('约 5 分钟仍未入账时提示「付款已收到，点此生成」，点击不回到积分包，入账后生成', async () => {
    await mount()
    await advance(299_000)
    expect(button().textContent).toBe('Confirming your payment…')
    await advance(1_000)
    expect(button().disabled).toBe(false)
    expect(button().textContent).toBe('Payment received — click to generate')

    // 仍未到账：保留提示，不显示积分包，避免重复付款
    await act(async () => button().click())
    expect(container.querySelector('[data-testid="reading-pack"]')).toBeNull()
    expect(button().textContent).toBe('Payment received — click to generate')
    expect(generated()).toBe(0)

    balance = 100
    await act(async () => button().click())
    expect(generated()).toBe(1)
  })
})

describe('解锁卡内容与完成提示', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
  })

  const card = () => container.querySelector('[data-testid="reading-unlock"]')

  it('依次显示章节大纲、标明示例的样例段落、积分价格与解锁按钮', async () => {
    balance = 100
    await mount()
    const outline = card()?.querySelector('ol')
    const sample = container.querySelector('[data-testid="reading-sample"]')
    const price = container.querySelector('[data-testid="reading-price"]')
    expect(outline?.textContent).toBe('Overview')
    expect(sample?.textContent).toContain('Sample excerpt (fictional example)')
    expect(sample?.textContent).toContain('A fictional sample paragraph.')
    const follows = (a: Node | null | undefined, b: Node | null | undefined) =>
      Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(outline, sample)).toBe(true)
    expect(follows(sample, price)).toBe(true)
    expect(follows(price, button())).toBe(true)
  })

  it('报价读取失败时不显示解锁卡', async () => {
    vi.mocked(getReadingOffer).mockRejectedValue(new Error('offline'))
    await mount()
    expect(card()).toBeNull()
    expect(container.querySelector('[data-testid="reading-sample"]')).toBeNull()
  })

  const finish = async (delivery: 'queued' | 'none') => {
    balance = 100
    vi.mocked(getReading).mockResolvedValue({ status: 'ready' } as never)
    const chunks = [
      'data: {"type":"text-delta","id":"t","delta":"## Overview\\n\\nText"}\n\n',
      'data: {"type":"finish"}\n\n',
    ]
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-reading-id': 'r1', 'x-reading-email': delivery }),
      body: new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
          controller.close()
        },
      }),
    })
    await mount()
    await act(async () => button().click())
    await advance(0)
    return container.querySelector('[data-testid="reading-stream"] [role="status"]')?.textContent
  }

  it('报告邮件未交给真实发信通道（none）时只提示已保存，不提邮件', async () => {
    const status = await finish('none')
    expect(status).toBe('Saved to your account.')
    expect(status).not.toMatch(/mail/i)
  })

  it('报告邮件已交给发信通道（queued）时提示已寄出链接', async () => {
    expect(await finish('queued')).toBe("Saved to your account. We've also emailed you a link.")
  })
})
