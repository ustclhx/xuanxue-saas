// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent, trackProductEvent } from '../analytics/track.ts'
import { checkoutCustomer } from '../billing/customer.functions.ts'
import {
  createReadingUnlock,
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
  return { ...actual, getLocale: () => locale }
})
let locale = 'en'
vi.mock('./readings.functions.ts', () => ({
  createReadingUnlock: vi.fn(),
  getReading: vi.fn(),
  getReadingOffer: vi.fn(),
  openReadingUnlock: vi.fn(),
}))
vi.mock('../billing/customer.functions.ts', () => ({ checkoutCustomer: vi.fn() }))
vi.mock('../analytics/track.ts', () => ({ trackEvent: vi.fn(), trackProductEvent: vi.fn() }))

const KIND = 'numerology-full'
const INPUT = { year: 1987, month: 11, day: 29 }
const offer = (balance: number): ReadingOffer => ({
  available: true,
  comingSoon: false,
  chatAvailable: true,
  credits: 100,
  sections: ['Overview'],
  sample: 'A fictional sample paragraph.',
  packs: [{ planPriceId: 'price', provider: 'paypal', credits: 100, amount: 199, currency: 'USD' }],
  plans: [],
  viewer: { slug: 'me', balance, subscribed: false },
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
  locale = 'en'
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

describe('解锁卡埋点', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
    vi.mocked(trackEvent).mockClear()
    vi.mocked(trackProductEvent).mockClear()
  })

  it('积分不足时点击解锁记录 unlock_click 与付费墙曝光，选积分包记录 checkout_start', async () => {
    vi.mocked(checkoutCustomer).mockResolvedValue({ ok: false } as never)
    await mount()
    await act(async () => button().click())
    expect(trackProductEvent).toHaveBeenCalledWith(
      'unlock_click',
      expect.objectContaining({ tool: KIND, locale: 'en' }),
    )
    expect(trackEvent).toHaveBeenCalledWith('paywall_view')
    expect(trackEvent).not.toHaveBeenCalledWith('generate_start')

    const pack = container.querySelector('[data-testid="reading-pack"]') as HTMLButtonElement
    await act(async () => pack.click())
    expect(trackEvent).toHaveBeenCalledWith('checkout_start', { plan: 'credits-100' })
  })
})

describe('解锁卡付款方式', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
    vi.mocked(checkoutCustomer)
      .mockReset()
      .mockResolvedValue({ ok: false } as never)
    vi.mocked(createReadingUnlock).mockResolvedValue({ token: 'tok' } as never)
  })

  it('只有一种付款方式时不显示切换，结账使用该方式的价格', async () => {
    await mount()
    await act(async () => button().click())
    expect(container.querySelector('[data-testid="reading-pay-method"]')).toBeNull()
    const pack = container.querySelector('[data-testid="reading-pack"]') as HTMLButtonElement
    await act(async () => pack.click())
    expect(vi.mocked(checkoutCustomer).mock.calls[0]?.[0].data).toMatchObject({
      provider: 'paypal',
      planPriceId: 'price',
    })
  })

  it('Stripe 与 PayPal 都可用时默认按配置顺序选卡，切到 PayPal 后结账使用 PayPal 价格', async () => {
    vi.mocked(getReadingOffer).mockImplementation(async () => ({
      ...offer(0),
      packs: [
        {
          planPriceId: 'stripe-100',
          provider: 'stripe',
          credits: 100,
          amount: 199,
          currency: 'USD',
        },
        {
          planPriceId: 'paypal-100',
          provider: 'paypal',
          credits: 100,
          amount: 199,
          currency: 'USD',
        },
      ],
    }))
    await mount()
    await act(async () => button().click())
    const methods = [
      ...container.querySelectorAll('[data-testid="reading-pay-method"]'),
    ] as HTMLInputElement[]
    expect(methods.map((item) => item.checked)).toEqual([true, false])
    expect(container.querySelectorAll('[data-testid="reading-pack"]')).toHaveLength(1)
    await act(async () => methods[1]?.click())
    expect(methods.map((item) => item.checked)).toEqual([false, true])
    await act(async () =>
      (container.querySelector('[data-testid="reading-pack"]') as HTMLButtonElement).click(),
    )
    expect(vi.mocked(checkoutCustomer).mock.calls[0]?.[0].data).toMatchObject({
      provider: 'paypal',
      planPriceId: 'paypal-100',
    })
  })
})

describe('积分不足时提供订阅（enable-subscriptions-daily-credits 4.3）', () => {
  const stripePack = {
    planPriceId: 'stripe-100',
    provider: 'stripe',
    credits: 100,
    amount: 6500,
    currency: 'TWD',
  }
  const plus = {
    key: 'plus',
    name: 'Plus',
    planPriceId: 'plus-twd',
    provider: 'stripe',
    credits: 400,
    amount: 16200,
    currency: 'TWD',
  }
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
    vi.mocked(checkoutCustomer)
      .mockReset()
      .mockResolvedValue({ ok: false } as never)
    vi.mocked(createReadingUnlock).mockResolvedValue({ token: 'tok' } as never)
    vi.mocked(getReadingOffer).mockImplementation(async () => ({
      ...offer(balance),
      packs: [
        stripePack,
        {
          ...stripePack,
          planPriceId: 'paypal-100',
          provider: 'paypal',
          amount: 199,
          currency: 'USD',
        },
      ],
      plans: [plus],
    }))
  })

  it('同时列出积分包与订阅档位；选订阅以 Stripe 订阅价格结账并带回跳地址', async () => {
    locale = 'zh-Hant'
    await mount()
    await act(async () => button().click())
    expect(container.querySelectorAll('[data-testid="reading-pack"]')).toHaveLength(1)
    const plans = [...container.querySelectorAll('[data-testid="reading-plan"]')]
    expect(plans).toHaveLength(1)
    expect(plans[0]?.textContent).toContain('Plus・每月 400 積分')
    expect(plans[0]?.textContent).toContain('NT$162/月')
    expect(container.textContent).toContain('每月自動續費，可隨時取消')
    await act(async () => (plans[0] as HTMLButtonElement).click())
    expect(vi.mocked(checkoutCustomer).mock.calls[0]?.[0].data).toMatchObject({
      provider: 'stripe',
      planPriceId: 'plus-twd',
      returnTo: '/?unlock=tok',
    })
    expect(trackEvent).toHaveBeenCalledWith('checkout_start', { plan: 'plus' })
  })

  it('切到 PayPal 时不显示订阅（PayPal 只卖积分包）', async () => {
    await mount()
    await act(async () => button().click())
    const methods = [
      ...container.querySelectorAll('[data-testid="reading-pay-method"]'),
    ] as HTMLInputElement[]
    await act(async () => methods[1]?.click())
    expect(container.querySelector('[data-testid="reading-plans"]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="reading-pack"]')).toHaveLength(1)
  })

  it('订阅首付回跳后轮询到首期积分入账即自动生成', async () => {
    window.history.replaceState(null, '', '/?unlock=tok&checkout=success')
    window.sessionStorage.setItem(
      'xuanxue.readings.pending-unlock',
      JSON.stringify({ token: 'tok', kind: KIND, input: INPUT }),
    )
    await mount()
    expect(generated()).toBe(0)
    // 首期 400 积分由 invoice.paid 入账
    balance = 400
    await advance(2_000)
    expect(generated()).toBe(1)
  })
})

describe('按界面语言结算的价格（localize-checkout-currency）', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
  })
  const localOffer = (): ReadingOffer => ({
    ...offer(0),
    packs: [
      {
        planPriceId: 'stripe-krw',
        provider: 'stripe',
        credits: 100,
        amount: 2800,
        currency: 'KRW',
      },
      { planPriceId: 'paypal-usd', provider: 'paypal', credits: 100, amount: 199, currency: 'USD' },
    ],
  })

  it('韩语显示韩元实价且不带约值；切到 PayPal 后提示以美元结算并显示美元金额', async () => {
    locale = 'ko'
    vi.mocked(getReadingOffer).mockImplementation(async () => localOffer())
    await mount()
    const price = container.querySelector('[data-testid="reading-price"]')?.textContent ?? ''
    expect(price).toContain('₩2,800')
    expect(price).not.toMatch(/≈|약/)
    await act(async () => button().click())
    expect(container.querySelector('[data-testid="reading-paypal-usd"]')).toBeNull()
    expect(container.querySelector('[data-testid="reading-pack"]')?.textContent).toContain('₩2,800')
    const methods = [
      ...container.querySelectorAll('[data-testid="reading-pay-method"]'),
    ] as HTMLInputElement[]
    await act(async () => methods[1]?.click())
    expect(container.querySelector('[data-testid="reading-paypal-usd"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="reading-pack"]')?.textContent).toContain(
      'US$1.99',
    )
  })

  it('简体显示美元与人民币参考价；英文选择 PayPal 不出现美元结算提示', async () => {
    locale = 'zh-Hans'
    vi.mocked(getReadingOffer).mockImplementation(async () => ({
      ...offer(0),
      packs: [
        { planPriceId: 'usd', provider: 'stripe', credits: 100, amount: 199, currency: 'USD' },
      ],
    }))
    await mount()
    const price = container.querySelector('[data-testid="reading-price"]')?.textContent ?? ''
    expect(price).toContain('US$1.99')
    expect(price).toContain('¥13')
    act(() => root.unmount())
    root = createRoot(container)
    locale = 'en'
    vi.mocked(getReadingOffer).mockImplementation(async () => offer(0))
    await mount()
    await act(async () => button().click())
    expect(container.querySelector('[data-testid="reading-paypal-usd"]')).toBeNull()
  })
})

describe('详批未开放时的结果页', () => {
  const closed = (chatAvailable: boolean): ReadingOffer => ({
    ...offer(0),
    available: false,
    comingSoon: true,
    chatAvailable,
    packs: [],
    viewer: null,
  })

  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
  })

  it('说明 AI 详批尚未开放，不显示价格或解锁按钮；没有可用模型时隐藏「问 AI」', async () => {
    vi.mocked(getReadingOffer).mockResolvedValue(closed(false))
    await mount()
    const card = container.querySelector('[data-testid="reading-coming-soon"]')
    expect(card?.textContent).toContain("The full AI reading isn't open yet")
    expect(card?.textContent).toContain('free calculation')
    expect(container.querySelector('[data-testid="reading-unlock-button"]')).toBeNull()
    expect(container.querySelector('[data-testid="reading-price"]')).toBeNull()
    expect(container.querySelector('[data-testid="ask-ai-entry"]')).toBeNull()
  })

  it('有可用文本模型时保留「问 AI」入口', async () => {
    vi.mocked(getReadingOffer).mockResolvedValue(closed(true))
    await mount()
    expect(container.querySelector('[data-testid="reading-coming-soon"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="ask-ai-entry"]')).not.toBeNull()
  })
})
