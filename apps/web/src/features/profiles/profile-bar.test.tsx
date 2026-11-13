// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { ToolContext } from '../tools/context.tsx'
import { TOOL_EVENT_FIELDS, toolEventPayload } from '../tools/events.ts'
import { TextField, ToolForm } from '../tools/form.tsx'
import { resetViewer } from '../workspace/viewer-store.ts'
import type { BirthProfile } from './schema.ts'

// add-birth-profiles-daily-horoscope tasks 6.1 / 6.2 / 6.3 / 6.5：工具表单的档案入口。
const fns = vi.hoisted(() => ({
  getViewerSpaces: vi.fn(),
  listBirthProfiles: vi.fn(),
  createBirthProfile: vi.fn(),
}))
vi.mock('../workspace/viewer.functions.ts', () => ({ getViewerSpaces: fns.getViewerSpaces }))
vi.mock('./profiles.functions.ts', () => ({
  listBirthProfiles: fns.listBirthProfiles,
  createBirthProfile: fns.createBirthProfile,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/app">{children}</a>,
  useRouter: () => undefined,
}))

const { ProfileBar } = await import('./profile-bar.tsx')
// 预先加载按需块，lazy() 在测试中立即可用（真实页面在点击时才加载）
const { clearProfileCache } = await import('./profile-picker-panel.tsx')

// 对话框的 motion 动效在 happy-dom 中走原生 Animation，卸载时 cancel() 会抛出未处理的 AbortError；
// 去掉原生实现，motion 改用 JS 动画
;(Element.prototype as { animate?: unknown }).animate = undefined

const SIGNED_IN = {
  signedIn: true,
  name: 'Owner',
  spaces: [{ id: 'w', slug: 'u-owner', name: 'Owner', isPersonal: true }],
}

const EAST: BirthProfile = {
  id: '01890000-0000-7000-8000-000000000001',
  label: 'Mom',
  relation: 'family',
  isDefault: true,
  birth: {
    calendar: 'solar',
    year: 1962,
    month: 9,
    day: 3,
    time: { hour: 6, minute: 15 },
    gender: null,
    location: { city: 'taichung' },
  },
  fullName: null,
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
}
const WEST: BirthProfile = {
  ...EAST,
  id: '01890000-0000-7000-8000-000000000002',
  label: 'Me',
  relation: 'self',
  birth: {
    calendar: 'solar',
    year: 1987,
    month: 11,
    day: 29,
    time: null,
    gender: null,
    location: null,
  },
  fullName: 'Jane Doe',
}

beforeEach(() => {
  resetViewer()
  clearProfileCache()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('档案入口的显示与按需读取', () => {
  it('未登录时不渲染入口，也不请求档案', async () => {
    fns.getViewerSpaces.mockResolvedValue({ signedIn: false, name: '', spaces: [] })
    const { container } = render(
      <ProfileBar target={{ kind: 'birth', tool: 'bazi', onFill: vi.fn() }} />,
    )
    await waitFor(() => expect(fns.getViewerSpaces).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(container.innerHTML).toBe('')
    expect(fns.listBirthProfiles).not.toHaveBeenCalled()
  })

  it('登录后页面加载不请求档案；首次打开选择器才请求一次，之后复用', async () => {
    fns.getViewerSpaces.mockResolvedValue(SIGNED_IN)
    fns.listBirthProfiles.mockResolvedValue([EAST])
    render(<ProfileBar target={{ kind: 'birth', tool: 'bazi', onFill: vi.fn() }} />)
    const open = await screen.findByRole('button', { name: m.profiles_pick() })
    expect(fns.listBirthProfiles).not.toHaveBeenCalled()
    fireEvent.click(open)
    await screen.findByRole('button', { name: /Mom/ })
    expect(fns.listBirthProfiles).toHaveBeenCalledTimes(1)
    expect(fns.listBirthProfiles).toHaveBeenCalledWith({ data: { slug: 'u-owner' } })
    fireEvent.click(open)
    fireEvent.click(open)
    await screen.findByRole('button', { name: /Mom/ })
    expect(fns.listBirthProfiles).toHaveBeenCalledTimes(1)
  })

  it('页头与入口共用一次 viewer 读取', async () => {
    fns.getViewerSpaces.mockResolvedValue(SIGNED_IN)
    render(
      <>
        <ProfileBar target={{ kind: 'birth', tool: 'bazi', prefix: 'a_', onFill: vi.fn() }} />
        <ProfileBar target={{ kind: 'birth', tool: 'bazi', prefix: 'b_', onFill: vi.fn() }} />
      </>,
    )
    expect(await screen.findAllByRole('button', { name: m.profiles_pick() })).toHaveLength(2)
    expect(fns.getViewerSpaces).toHaveBeenCalledTimes(1)
  })
})

describe('从档案填入', () => {
  it('东方站：填入已有字段，缺性别时提示补全，不猜测', async () => {
    fns.getViewerSpaces.mockResolvedValue(SIGNED_IN)
    fns.listBirthProfiles.mockResolvedValue([EAST])
    const onFill = vi.fn()
    render(<ProfileBar target={{ kind: 'birth', tool: 'bazi', onFill }} />)
    fireEvent.click(await screen.findByRole('button', { name: m.profiles_pick() }))
    fireEvent.click(await screen.findByRole('button', { name: /Mom/ }))
    expect(onFill).toHaveBeenCalledTimes(1)
    const values = onFill.mock.calls[0]?.[0]
    expect(values).toMatchObject({
      year: '1962',
      month: '9',
      day: '3',
      time: '06:15',
      place: 'taichung',
    })
    expect(values).not.toHaveProperty('gender')
    expect(screen.getByText(m.profiles_filled({ name: 'Mom' }))).toBeTruthy()
    expect(screen.getByText(m.profiles_missing_gender())).toBeTruthy()
  })

  it('西方站：填入日期与全名到所在表单；提交只上报白名单字段', async () => {
    fns.getViewerSpaces.mockResolvedValue(SIGNED_IN)
    fns.listBirthProfiles.mockResolvedValue([WEST])
    const track = vi.fn()
    const onSubmit = vi.fn()
    const { container } = render(
      <ToolContext value={{ tool: 'numerology-calculator', track }}>
        <ToolForm label="calc" onSubmit={onSubmit}>
          <ProfileBar target={{ kind: 'numerology', date: true, name: true }} />
          <TextField label="name" name="name" />
          <TextField label="date" name="birthDate" type="date" />
          <button type="submit">go</button>
        </ToolForm>
      </ToolContext>,
    )
    fireEvent.click(await screen.findByRole('button', { name: m.profiles_pick() }))
    fireEvent.click(await screen.findByRole('button', { name: /Me/ }))
    const form = container.querySelector('form') as HTMLFormElement
    expect((form.elements.namedItem('birthDate') as HTMLInputElement).value).toBe('1987-11-29')
    expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('Jane Doe')
    fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    // 选用与填入档案本身不产生埋点；提交事件不带任何表单值
    expect(track.mock.calls).toEqual([['tool_submit']])
    const payload = toolEventPayload(
      { tool: 'numerology-calculator', site: 'west', locale: 'en' },
      // 即使误传入档案字段，载荷也只保留白名单键
      { block: 'Jane Doe', name: 'Jane Doe', birthDate: '1987-11-29', fullName: 'Jane' } as never,
    )
    for (const key of Object.keys(payload))
      expect(TOOL_EVENT_FIELDS as readonly string[]).toContain(key)
    expect(JSON.stringify(payload)).not.toMatch(/Jane|1987/)
  })
})

describe('另存为档案', () => {
  it('表单不完整时直接提示，不发请求', async () => {
    fns.getViewerSpaces.mockResolvedValue(SIGNED_IN)
    render(
      <form>
        <ProfileBar target={{ kind: 'birth', tool: 'bazi', onFill: vi.fn() }} />
      </form>,
    )
    fireEvent.click(await screen.findByRole('button', { name: m.profiles_save_as() }))
    expect(await screen.findByText(m.profiles_save_incomplete())).toBeTruthy()
    expect(fns.createBirthProfile).not.toHaveBeenCalled()
  })

  it('保存当前输入为新档案，表单内容不变', async () => {
    fns.getViewerSpaces.mockResolvedValue(SIGNED_IN)
    fns.createBirthProfile.mockResolvedValue({ ok: true, value: { ...WEST, label: 'Sam' } })
    const { container } = render(
      <form>
        <ProfileBar target={{ kind: 'numerology', date: true, name: true }} />
        <input name="birthDate" defaultValue="1991-12-24" />
        <input name="name" defaultValue="Sam Lee" />
      </form>,
    )
    fireEvent.click(await screen.findByRole('button', { name: m.profiles_save_as() }))
    const dialog = await screen.findByRole('form', { name: m.profiles_save_title() })
    fireEvent.change(dialog.querySelector('input[name="label"]') as Element, {
      target: { value: 'Sam' },
    })
    fireEvent.submit(dialog)
    expect(await screen.findByText(m.profiles_saved_as({ name: 'Sam' }))).toBeTruthy()
    expect(fns.createBirthProfile.mock.calls[0]?.[0].data).toMatchObject({
      slug: 'u-owner',
      profile: {
        label: 'Sam',
        relation: 'self',
        fullName: 'Sam Lee',
        birth: { calendar: 'solar', year: 1991, month: 12, day: 24, time: null },
      },
    })
    const outer = container.querySelector('form') as HTMLFormElement
    expect((outer.elements.namedItem('birthDate') as HTMLInputElement).value).toBe('1991-12-24')
  })
})
