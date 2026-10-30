// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteContext } from '../site/context.tsx'
import { freeToolLinks, ReadingsListPage } from './report-page.tsx'

// product-improve-ai-content tasks.md 2.6：报告列表空态跟随详批可用性

const locale = vi.hoisted(() => ({ current: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => locale.current }
})
vi.mock('./readings.functions.ts', () => ({
  deleteReading: vi.fn(),
  getReading: vi.fn(),
  listReadings: vi.fn(),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  locale.current = 'en'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const render = (unlockable: boolean, site: 'east' | 'west' = 'west') =>
  act(async () =>
    root.render(
      <SiteContext.Provider value={site}>
        <ReadingsListPage
          slug="me"
          initial={{ items: [], nextCursor: null }}
          unlockable={unlockable}
        />
      </SiteContext.Provider>,
    ),
  )
const empty = () => container.querySelector('[data-testid="readings-empty"]')

describe('报告列表空态', () => {
  it('至少一种详批可用：提示可在免费结果下方解锁', async () => {
    await render(true)
    expect(empty()?.textContent).toBe(
      'No readings yet. You can unlock a full reading below any free result.',
    )
    expect(empty()?.querySelectorAll('a')).toHaveLength(0)
  })

  it('全部关闭：中性文案加本站免费工具链接，不承诺可解锁', async () => {
    await render(false)
    expect(empty()?.textContent).not.toMatch(/unlock/i)
    const hrefs = [...(empty()?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/numerology-calculator')
    expect(hrefs.length).toBeGreaterThan(0)
  })

  it('东方站简体：链接本站简体工具，不出现西方站工具', async () => {
    locale.current = 'zh-Hans'
    await render(false, 'east')
    expect(empty()?.textContent).not.toContain('解锁')
    const hrefs = [...(empty()?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/zh-hans')
    expect(hrefs).not.toContain('/numerology-calculator')
  })
})

describe('免费工具链接', () => {
  it('当前语言不属于本站时退回本站默认语言', () => {
    const links = freeToolLinks('en', 'east')
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((link) => !link.href.startsWith('/numerology'))).toBe(true)
  })
})
