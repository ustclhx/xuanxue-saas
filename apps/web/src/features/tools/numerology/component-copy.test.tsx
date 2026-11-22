// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exampleDateFor } from './calc.ts'
import { NeighborNumbers } from './content-page.tsx'
import { LifePathCalculator } from './life-path-calculator.tsx'

// 数字页组件段的逐数字文案（openspec content-growth-phase1 tasks 3.1）
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'en' }
})
vi.mock('../../readings/unlock-card.tsx', () => ({ ReadingUnlock: () => null }))
vi.mock('../reading-slots.tsx', () => ({ ReadingSlots: () => null }))
vi.mock('../../profiles/profile-bar.tsx', () => ({ ProfileBar: () => null }))

const SHORT_NOTE = 'For reference and self-reflection. Not a prediction of the future.'
const SUMMARY_7 = 'Life Path 7 is associated with inquiry'
const NOTE = 'The illustration uses January 6, 1980. Seven attracts more myths than most digits.'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(node: ReactNode) {
  await act(async () => root.render(node))
}

async function submit(date: string) {
  const input = container.querySelector<HTMLInputElement>('input[name="birthDate"]')
  if (!input) throw new Error('birth date input missing')
  input.value = date
  await act(async () => {
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true }))
  })
}

const result = () => container.querySelector('#life-path-result')?.textContent ?? ''

describe('LifePathCalculator note', () => {
  it('数字页样例显示逐数字说明并去掉卡内短声明；提交后恢复摘要与短声明', async () => {
    await render(<LifePathCalculator example={exampleDateFor(7)} current={7} note={NOTE} />)
    expect(result()).toContain(NOTE)
    expect(result()).not.toContain(SUMMARY_7)
    expect(result()).not.toContain(SHORT_NOTE)
    // 计算步骤仍由引擎生成
    expect(result()).toContain('1 + 6 + 9 = 16')

    await submit('1980-01-06')
    expect(result()).not.toContain(NOTE)
    expect(result()).toContain(SUMMARY_7)
    expect(result()).toContain(SHORT_NOTE)
  })

  it('工具页不传 note：样例保持摘要与短声明', async () => {
    await render(<LifePathCalculator />)
    expect(result()).toContain(SHORT_NOTE)
    expect(container.querySelector('#life-path-result [role="note"]')).not.toBeNull()
  })
})

describe('NeighborNumbers text', () => {
  const links = () =>
    [...container.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.textContent])

  it.each([7, 1, 22])('逐数字文案与通用句式的链接目标、锚文本与顺序相同（%i）', async (number) => {
    await render(<NeighborNumbers number={number} />)
    const fallback = links()
    expect(fallback.length).toBeGreaterThanOrEqual(2)
    const anchors = fallback.map(([, text]) => `[${text}]`).join(' then ')
    await render(<NeighborNumbers number={number} text={`Own copy: ${anchors}.`} />)
    expect(links()).toEqual(fallback)
    expect(container.textContent).toContain('Own copy:')
    expect(container.querySelector('section')?.hasAttribute('data-locale-fixed')).toBe(true)
  })
})
