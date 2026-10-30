// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_LOCAL_RATES } from '../readings/price.ts'
import { getReadingOffer, type ReadingOffer } from '../readings/readings.functions.ts'
import { ContentFunnel, ReadingGuide } from './reading-guide.tsx'

// product-improve-ai-content tasks.md 3.3 / 3.6：引导入口与内容页入口只在目标详批可用时出现

vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'en' }
})
vi.mock('../readings/readings.functions.ts', () => ({ getReadingOffer: vi.fn() }))

const offer = (available: boolean): ReadingOffer => ({
  available,
  comingSoon: !available,
  credits: available ? 100 : 0,
  sections: [],
  packs: [],
  viewer: null,
  rates: FALLBACK_LOCAL_RATES,
})

const target = {
  href: '/numerology-calculator',
  label: 'Go there',
  target: 'numerology-calculator',
}
const guide = <ReadingGuide kind="numerology-full" body="Guide body" to={target} />
const funnel = (
  <ContentFunnel
    tool={{ href: '/tarot', label: 'Draw three cards', target: 'tarot-three-card' }}
    reading={{
      kind: 'tarot-spread',
      href: '/tarot',
      label: 'Unlock a reading',
      target: 'reading-tarot-spread',
    }}
  />
)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getReadingOffer).mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const mount = (node: ReactNode) => act(async () => root.render(node))
const find = (id: string) => container.querySelector(`[data-testid="${id}"]`)

describe('ReadingGuide', () => {
  it('目标详批可用时显示，链接到可解锁的工具且读取对应详批报价', async () => {
    vi.mocked(getReadingOffer).mockResolvedValue(offer(true))
    await mount(guide)
    expect(getReadingOffer).toHaveBeenCalledWith({
      data: { kind: 'numerology-full', locale: 'en' },
    })
    const section = find('reading-guide')
    expect(section?.textContent).toContain('Guide body')
    expect(section?.querySelector('a')?.getAttribute('href')).toBe('/numerology-calculator')
  })

  it('目标详批关闭时不显示', async () => {
    vi.mocked(getReadingOffer).mockResolvedValue(offer(false))
    await mount(guide)
    expect(find('reading-guide')).toBeNull()
  })

  it('报价读取失败时不显示', async () => {
    vi.mocked(getReadingOffer).mockRejectedValue(new Error('offline'))
    await mount(guide)
    expect(find('reading-guide')).toBeNull()
  })

  it('引导文案不承诺解锁当前结果', async () => {
    const { m } = await import('../../paraglide/messages.js')
    for (const locale of ['en', 'zh-Hant', 'zh-Hans', 'ko'] as const) {
      for (const body of [m.funnel_guide_numerology, m.funnel_guide_tarot]) {
        const text = body({}, { locale })
        expect(text).not.toMatch(/unlock this|解鎖此|解锁此|이 결과/i)
      }
    }
  })
})

describe('ContentFunnel', () => {
  it('服务端渲染只输出工具入口，不读取报价', () => {
    const html = renderToString(funnel)
    expect(html).toContain('data-testid="content-funnel-tool"')
    expect(html).toContain('href="/tarot"')
    expect(html).not.toContain('content-funnel-reading')
    expect(getReadingOffer).not.toHaveBeenCalled()
  })

  it('详批可用时追加详批入口', async () => {
    vi.mocked(getReadingOffer).mockResolvedValue(offer(true))
    await mount(funnel)
    expect(find('content-funnel-tool')).not.toBeNull()
    expect(find('content-funnel-reading')?.textContent).toContain('Unlock a reading')
  })

  it('详批不可用或读取失败时只保留工具入口', async () => {
    vi.mocked(getReadingOffer).mockResolvedValue(offer(false))
    await mount(funnel)
    expect(find('content-funnel-tool')).not.toBeNull()
    expect(find('content-funnel-reading')).toBeNull()

    vi.mocked(getReadingOffer).mockRejectedValue(new Error('offline'))
    act(() => root.unmount())
    root = createRoot(container)
    await mount(funnel)
    expect(find('content-funnel-tool')).not.toBeNull()
    expect(find('content-funnel-reading')).toBeNull()
  })
})
