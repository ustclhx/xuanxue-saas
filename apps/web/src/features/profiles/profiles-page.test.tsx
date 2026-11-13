// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { MAX_PROFILES as LABELS_MAX } from './labels.ts'
import type { BirthProfile } from './schema.ts'
import { MAX_PROFILES } from './schema.ts'

// add-birth-profiles-daily-horoscope tasks 5.1：档案管理页的空态、默认与「本人」标记、字段错误提示。
const fns = vi.hoisted(() => ({
  createBirthProfile: vi.fn(),
  updateBirthProfile: vi.fn(),
  deleteBirthProfile: vi.fn(),
  setDefaultBirthProfile: vi.fn(),
  listBirthProfiles: vi.fn(),
}))
vi.mock('./profiles.functions.ts', () => fns)
// 日主列按需加载引擎；单测不加载，列留空
vi.mock('../tools/bazi/engine.ts', () => ({ loadBazi: () => new Promise(() => {}) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/app">{children}</a>,
  useRouter: () => undefined,
}))

const { ProfilesPage, toolLink } = await import('./profiles-page.tsx')
const { ProfileForm } = await import('./profile-editor.tsx')

function profile(overrides: Partial<BirthProfile> = {}): BirthProfile {
  return {
    id: '01890000-0000-7000-8000-000000000001',
    label: null,
    relation: 'self',
    isDefault: true,
    birth: {
      calendar: 'solar',
      year: 1990,
      month: 5,
      day: 15,
      time: { hour: 10, minute: 30 },
      gender: 'male',
      location: { city: 'taipei' },
      trueSolarTime: false,
    },
    fullName: null,
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('档案管理页', () => {
  it('没有档案时显示空态与新建入口，不显示列表', () => {
    render(<ProfilesPage slug="ws" site="east" locale="zh-Hant" initial={[]} />)
    expect(screen.getByRole('heading', { name: m.profiles_empty_title() })).toBeTruthy()
    expect(screen.getByRole('button', { name: m.profiles_empty_cta() })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('列表标出默认档案与「本人」关系；没有显示名时用关系代替', () => {
    const rows = [
      profile(),
      profile({
        id: '01890000-0000-7000-8000-000000000002',
        label: 'Mom',
        relation: 'family',
        isDefault: false,
        birth: { ...profile().birth, time: null },
      }),
    ]
    render(<ProfilesPage slug="ws" site="east" locale="zh-Hant" initial={rows} />)
    const [self, mom] = screen.getAllByRole('row').slice(1)
    expect(self?.textContent).toContain(m.profiles_relation_self())
    expect(self?.textContent).toContain(m.profiles_badge_default())
    expect(self?.textContent).toContain('1990-05-15 10:30')
    expect(mom?.textContent).toContain('Mom')
    expect(mom?.textContent).toContain(m.profiles_relation_family())
    expect(mom?.textContent).toContain(m.profiles_time_unknown())
    expect(mom?.textContent).not.toContain(m.profiles_badge_default())
    expect(screen.getByText(`(2/${MAX_PROFILES})`, { exact: false })).toBeTruthy()
  })

  it('西方站显示生命灵数，「排盘」链接的片段只含日期', () => {
    const west = profile({
      fullName: 'Jane Doe',
      birth: {
        calendar: 'solar',
        year: 1987,
        month: 11,
        day: 29,
        time: null,
        gender: null,
        location: null,
      },
    })
    render(<ProfilesPage slug="ws" site="west" locale="en" initial={[west]} />)
    expect(screen.getByRole('columnheader', { name: m.profiles_col_life_path() })).toBeTruthy()
    const href = toolLink(west, 'west', 'en')
    expect(href.startsWith('/numerology-calculator#r=')).toBe(true)
    const fragment = atob(href.split('#r=')[1]?.replaceAll('-', '+').replaceAll('_', '/') ?? '')
    expect(JSON.parse(fragment)).toEqual({ date: '1987-11-29' })
  })

  it('达到上限时新建被拦下并提示', () => {
    const rows = Array.from({ length: MAX_PROFILES }, (_, index) =>
      profile({
        id: `01890000-0000-7000-8000-${String(index).padStart(12, '0')}`,
        relation: index === 0 ? 'self' : 'other',
        isDefault: index === 0,
      }),
    )
    render(<ProfilesPage slug="ws" site="east" locale="zh-Hant" initial={rows} />)
    fireEvent.click(screen.getByRole('button', { name: m.profiles_new() }))
    expect(screen.getByRole('alert').textContent).toContain(
      m.profiles_limit_body({ max: MAX_PROFILES }),
    )
  })

  it('页面上限常量与服务端一致', () => {
    expect(LABELS_MAX).toBe(MAX_PROFILES)
  })
})

describe('档案表单的字段错误', () => {
  const fillDate = (form: HTMLElement) => {
    fireEvent.change(form.querySelector('input[name="year"]') as Element, {
      target: { value: '2023' },
    })
    fireEvent.change(form.querySelector('input[name="month"]') as Element, {
      target: { value: '3' },
    })
    fireEvent.change(form.querySelector('input[name="day"]') as Element, {
      target: { value: '1' },
    })
    fireEvent.change(form.querySelector('input[name="time"]') as Element, {
      target: { value: '10:30' },
    })
  }

  it('浏览器端缺少日期时在日期字段提示，不发请求', async () => {
    render(<ProfileForm slug="ws" site="east" locale="zh-Hant" onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: m.profiles_save() }))
    await waitFor(() =>
      expect(screen.getAllByText(m.bazi_issue_required()).length).toBeGreaterThan(0),
    )
    expect(fns.createBirthProfile).not.toHaveBeenCalled()
  })

  it('服务端拒绝不存在的闰月时，在闰月字段显示本语言提示', async () => {
    fns.createBirthProfile.mockResolvedValue({
      ok: false,
      code: 'INVALID_PROFILE',
      issues: [{ field: 'leapMonth', code: 'leap_month_not_exist' }],
    })
    const onSaved = vi.fn()
    const { container } = render(
      <ProfileForm slug="ws" site="east" locale="zh-Hant" onSaved={onSaved} />,
    )
    const form = container.querySelector('form') as HTMLFormElement
    // 切到农历后才出现闰月勾选
    fireEvent.click(form.querySelector('input[name="calendar"][value="lunar"]') as Element)
    fireEvent.change(form)
    fillDate(form)
    fireEvent.click(form.querySelector('input[name="leap"]') as Element)
    fireEvent.click(screen.getByRole('button', { name: m.profiles_save() }))
    await waitFor(() => expect(screen.getByText(m.bazi_issue_leap_month_not_exist())).toBeTruthy())
    expect(fns.createBirthProfile).toHaveBeenCalledTimes(1)
    const sent = fns.createBirthProfile.mock.calls[0]?.[0].data.profile
    expect(sent.birth).toMatchObject({ calendar: 'lunar', year: 2023, month: 3, isLeapMonth: true })
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('第二份「本人」被拒时在关系字段提示', async () => {
    fns.createBirthProfile.mockResolvedValue({
      ok: false,
      code: 'PROFILE_SELF_EXISTS',
      issues: [{ field: 'relation', code: 'invalid' }],
    })
    const { container } = render(
      <ProfileForm slug="ws" site="east" locale="zh-Hant" onSaved={vi.fn()} />,
    )
    fillDate(container.querySelector('form') as HTMLFormElement)
    fireEvent.click(screen.getByRole('button', { name: m.profiles_save() }))
    await waitFor(() => expect(screen.getByText(m.profiles_self_exists())).toBeTruthy())
  })

  it('西方站只需日期；全名随档案保存', async () => {
    const saved = profile()
    fns.createBirthProfile.mockResolvedValue({ ok: true, value: saved })
    const onSaved = vi.fn()
    const { container } = render(
      <ProfileForm slug="ws" site="west" locale="en" onSaved={onSaved} />,
    )
    fireEvent.change(container.querySelector('input[name="birthDate"]') as Element, {
      target: { value: '1987-11-29' },
    })
    fireEvent.change(container.querySelector('input[name="fullName"]') as Element, {
      target: { value: 'Jane Doe' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.profiles_save() }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(fns.createBirthProfile.mock.calls[0]?.[0].data.profile).toMatchObject({
      fullName: 'Jane Doe',
      birth: { calendar: 'solar', year: 1987, month: 11, day: 29, gender: null, location: null },
    })
  })
})
