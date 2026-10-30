// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { FullCalculator } from './full-calculator.tsx'

vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'en' }
})
vi.mock('../../readings/unlock-card.tsx', () => ({ ReadingUnlock: () => null }))
vi.mock('../reading-slots.tsx', () => ({ ReadingSlots: () => null }))

it('访客本地已到 2027 年时按本地年计算并展示分别归约的个人年步骤', async () => {
  vi.stubEnv('TZ', 'Pacific/Kiritimati')
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-12-31T10:30:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    // 同一时刻 UTC 仍在 2026；明确断言时区设置生效，避免测试悄悄退化为 UTC 场景。
    expect(new Date().getUTCFullYear()).toBe(2026)
    expect(new Date().getFullYear()).toBe(2027)
    await act(async () => root.render(<FullCalculator />))
    const input = container.querySelector<HTMLInputElement>('input[name="birthDate"]')
    if (!input) throw new Error('birth date input missing')
    input.value = '1987-11-29'
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true }))
    })
    const result = container.querySelector('#personal-year')
    expect(result?.textContent).toContain('2027')
    expect(result?.textContent).toContain('2 + 9 = 11')
    expect(result?.textContent).toContain('2 + 0 + 2 + 7 = 11')
    expect(result?.textContent).toContain('11 + 11 + 11 = 33')
    expect(result?.textContent).not.toContain('1987')
  } finally {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})
