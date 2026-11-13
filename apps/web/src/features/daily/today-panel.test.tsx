// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateKey } from './date.ts'
import { eastDayFacts, eastPersonalFacts, westDayFacts, westPersonalFacts } from './facts.ts'
import { EN_RULES } from './rules/en.ts'
import { ZH_HANT_RULES } from './rules/zh-Hant.ts'
import { eastPanelCopy, type TodayPanelData, westPanelCopy } from './today.ts'
import { TodayPanel } from './today-panel.tsx'

let locale = 'zh-Hant'
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => locale }
})
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('./today.functions.ts', () => ({ createDailyChatLink: vi.fn() }))

let root: Root | undefined
let container: HTMLDivElement

async function render(data: TodayPanelData | null, chatAvailable = false) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () =>
    root?.render(<TodayPanel data={data} slug="u-test" chatAvailable={chatAvailable} />),
  )
}

async function settle() {
  for (let i = 0; i < 20; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const PROFILES = [{ id: 'p1', label: null, relation: 'self', isDefault: true }]

async function eastOk(date = { year: 2026, month: 11, day: 13 }): Promise<TodayPanelData> {
  const engine = await import('@xuanxue/bazi/daily')
  const natal = { dayMaster: 'geng', branches: { year: 'wu', month: 'si', day: 'chen' } } as const
  const day = eastDayFacts(engine, date)
  const personal = eastPersonalFacts(engine, natal, date)
  return {
    state: 'ok',
    site: 'east',
    locale: 'zh-Hant',
    date: dateKey(date),
    profiles: PROFILES,
    selectedId: 'p1',
    natal,
    day,
    personal,
    background: null,
    copy: eastPanelCopy(ZH_HANT_RULES, day, personal),
    toolHref: '/zh-hant#r=x',
  }
}

describe('今日面板四种状态', () => {
  it('没有档案：显示建立档案入口，不显示个人化内容', async () => {
    locale = 'zh-Hant'
    await render({ state: 'empty', date: '2026-11-13' })
    expect(container.textContent).toContain('還沒有出生檔案')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/app/u-test/profiles')
    expect(container.querySelector('[data-testid="today-panel"]')).toBeNull()
  })

  it('字段缺失：提示补全缺少的字段', async () => {
    locale = 'zh-Hant'
    await render({
      state: 'missing',
      date: '2026-11-13',
      profiles: PROFILES,
      selectedId: 'p1',
      missing: ['gender', 'location'],
    })
    expect(container.textContent).toContain('請補上性別、出生地')
  })

  it('默认档案：显示今日十神与提示；不可用时不显示问 AI', async () => {
    vi.stubEnv('TZ', 'Asia/Taipei')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T04:00:00Z'))
    locale = 'zh-Hant'
    const data = await eastOk()
    await render(data)
    const text = container.textContent ?? ''
    if (data.state !== 'ok') throw new Error('expected ok')
    expect(text).toContain(data.copy.tip.theme)
    expect(text).toContain('檔案：本人（庚金日主）')
    expect(text).not.toContain('AI')
    await act(async () => root?.unmount())
    container.remove()
    await render(data, true)
    expect(container.textContent).toContain('把今天帶去問 AI')
  })

  it('spec「本地日期与参考日期不同」：西方站用户仍在前一天时显示前一天的个人日', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    vi.useFakeTimers({ toFake: ['Date'] })
    // 洛杉矶 11-12 22:00；服务端按纽约参考时区（11-13 01:00）算出 11-13
    vi.setSystemTime(new Date('2026-11-13T06:00:00Z'))
    locale = 'en'
    const reference = { year: 2026, month: 11, day: 13 }
    const birth = { year: 1990, month: 5, day: 15 }
    const personal = westPersonalFacts(birth, reference)
    await render({
      state: 'ok',
      site: 'west',
      locale: 'en',
      date: '2026-11-13',
      profiles: PROFILES,
      selectedId: 'p1',
      birth,
      day: westDayFacts(reference),
      personal,
      copy: westPanelCopy(EN_RULES, personal, '2026-11-13'),
      toolHref: '/numerology-calculator#r=x',
    })
    await settle()
    const previous = westPersonalFacts(birth, { year: 2026, month: 11, day: 12 })
    expect(container.textContent).toContain('Today · November 12')
    expect(container.textContent).toContain(
      `${previous.personalDay.value} · ${EN_RULES.number[previous.personalDay.value as 8].keyword}`,
    )
  })
})
