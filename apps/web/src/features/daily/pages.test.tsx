// @vitest-environment happy-dom
import { dayPillarOf } from '@xuanxue/bazi'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ganzhiText } from './copy.ts'
import { dateKey, referenceDate } from './date.ts'
import { EastDailyPage, loadEastDaily } from './east-page.tsx'
import { EN_RULES } from './rules/en.ts'
import { ZH_HANT_RULES } from './rules/zh-Hant.ts'
import { loadWestDaily, WestDailyPage } from './west-page.tsx'

let locale = 'zh-Hant'
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => locale }
})

let root: Root | undefined
let container: HTMLDivElement

async function render(node: React.ReactNode) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root?.render(node))
}

/** 等待动态 import 的引擎完成并让 React 提交 */
async function settle() {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('东方站每日页', () => {
  it('spec「时区不同的访客」：首屏为参考日期，水合后按本地日期替换并注明', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    vi.useFakeTimers({ toFake: ['Date'] })
    // 洛杉矶 11-13 09:30，台北已是 11-14 01:30
    vi.setSystemTime(new Date('2026-11-13T17:30:00Z'))
    locale = 'zh-Hant'
    const reference = referenceDate('zh-Hant')
    expect(dateKey(reference)).toBe('2026-11-14')
    const data = await loadEastDaily(reference)
    await render(<EastDailyPage locale="zh-Hant" rules={ZH_HANT_RULES} data={data} />)
    await settle()
    const local = dayPillarOf({ year: 2026, month: 11, day: 13 })
    const h1 = container.querySelector('h1')?.textContent ?? ''
    expect(container.querySelector('[data-testid="daily-date"]')?.textContent).toContain('11月13日')
    expect(container.querySelector('[data-testid="daily-date"]')?.textContent).toContain(
      '已按你的本地日期計算',
    )
    expect(h1).toContain(ganzhiText('zh-Hant', local.stem, local.branch))
    expect(h1).not.toContain(ganzhiText('zh-Hant', data.facts.stem, data.facts.branch))
  })

  it('spec「查看日主提示」：丙日选择庚金日主显示七殺', async () => {
    vi.stubEnv('TZ', 'Asia/Taipei')
    // 找一个丙日，并让本地日期等于参考日期
    let day = { year: 2026, month: 11, day: 1 }
    while (dayPillarOf(day).stem !== 'bing') day = { ...day, day: day.day + 1 }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(day.year, day.month - 1, day.day, 4)))
    locale = 'zh-Hant'
    await render(
      <EastDailyPage locale="zh-Hant" rules={ZH_HANT_RULES} data={await loadEastDaily(day)} />,
    )
    // 十个日主的提示都在 HTML 中（非当前的区块以 hidden 隐藏）
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(10)
    const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (button) => button.textContent === '庚',
    )
    await act(async () => tab?.click())
    const panel = container.querySelector<HTMLElement>('[data-stem="geng"]')
    expect(panel?.hidden).toBe(false)
    expect(panel?.textContent).toContain('七殺')
    const tips = ZH_HANT_RULES.tenGod.qiSha.map((tip) => tip.theme)
    expect(tips.some((theme) => panel?.textContent?.includes(theme))).toBe(true)
  })
})

describe('西方站每日页', () => {
  it('spec「计算个人日」：在 2026-11-13 输入 5 月 15 日，显示三段归约与含义，不发请求', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T15:00:00Z'))
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    locale = 'en'
    await render(
      <WestDailyPage rules={EN_RULES} data={loadWestDaily({ year: 2026, month: 11, day: 13 })} />,
    )
    const input = container.querySelector<HTMLInputElement>('input[name="birthDate"]')
    if (!input) throw new Error('birth date input missing')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '1990-05-15')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const result = container.querySelector('[data-testid="daily-personal"]')?.textContent ?? ''
    expect(result).toContain('Personal Year: 5 + 6 + 1 = 12 → 1 + 2 = 3')
    expect(result).toContain('Personal Month: 3 + 11 = 14 → 1 + 4 = 5')
    expect(result).toContain('Personal Day: 5 + 4 = 9')
    expect(result).toContain(`9 · ${EN_RULES.number[9].keyword}`)
    expect(container.querySelector('[data-testid="daily-steps"]')?.textContent).toContain(
      '1 + 11 + 4 = 16 → 1 + 6 = 7',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
