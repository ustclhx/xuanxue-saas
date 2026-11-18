// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// 分段标签跟随页面语言（而不是浏览器语言），这里切换 Paraglide 的当前语言验证
const messages = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

const { DateField, TimeField } = await import('./date-field.tsx')

afterEach(() => {
  cleanup()
  messages.locale = 'en'
})

const part = (container: HTMLElement, field: string, key: string) =>
  container.querySelector(`[data-field="${field}"] [data-part="${key}"]`) as HTMLInputElement

describe('DateField / TimeField', () => {
  it('分段输入后表单值为 YYYY-MM-DD / HH:MM，且表单 onChange 在同一事件中就能读到', () => {
    const seen: string[] = []
    const { container } = render(
      <form onChange={(event) => seen.push(String(new FormData(event.currentTarget).get('d')))}>
        <DateField label="Date of birth" name="d" />
        <TimeField label="Time" name="t" />
      </form>,
    )
    fireEvent.change(part(container, 'd', 'year'), { target: { value: '1987' } })
    fireEvent.change(part(container, 'd', 'month'), { target: { value: '11' } })
    fireEvent.change(part(container, 'd', 'day'), { target: { value: '9' } })
    fireEvent.change(part(container, 't', 'hour'), { target: { value: '7' } })
    fireEvent.change(part(container, 't', 'minute'), { target: { value: '5' } })
    const data = new FormData(container.querySelector('form') as HTMLFormElement)
    expect(data.get('d')).toBe('1987-11-09')
    expect(data.get('t')).toBe('07:05')
    expect(seen.at(-1)).toBe('1987-11-09')
    // 分段本身不带 name，表单里只有一个提交值
    expect([...data.keys()]).toEqual(['d', 't'])
  })

  it('外部写入隐藏字段并派发 change（档案填入）时，各段随之更新；表单 reset 回到初始值', () => {
    const { container } = render(
      <form>
        <DateField label="Date of birth" name="birthDate" defaultValue="1990-05-15" />
      </form>,
    )
    expect(part(container, 'birthDate', 'year').value).toBe('1990')
    const hidden = container.querySelector('input[name="birthDate"]') as HTMLInputElement
    fireEvent.change(hidden, { target: { value: '1987-11-29' } })
    expect(part(container, 'birthDate', 'month').value).toBe('11')
    expect(part(container, 'birthDate', 'day').value).toBe('29')
    act(() => (container.querySelector('form') as HTMLFormElement).reset())
    expect(part(container, 'birthDate', 'year').value).toBe('1990')
    expect(hidden.value).toBe('1990-05-15')
  })

  it('无效标记与错误文字关联到每个分段；禁用时不提交', () => {
    const { container } = render(
      <form>
        <DateField label="Date of birth" name="d" invalid describedBy="date-error" />
        <TimeField label="Time" name="t" error="Bad time" />
        <TimeField label="Time 2" name="u" defaultValue="10:30" disabled />
      </form>,
    )
    expect(part(container, 'd', 'year').getAttribute('aria-invalid')).toBe('true')
    expect(part(container, 'd', 'day').getAttribute('aria-describedby')).toBe('date-error')
    const hour = part(container, 't', 'hour')
    const errorId = hour.getAttribute('aria-describedby')
    expect(errorId && document.getElementById(errorId)?.textContent).toBe('Bad time')
    expect(part(container, 'u', 'hour').disabled).toBe(true)
    const data = new FormData(container.querySelector('form') as HTMLFormElement)
    expect(data.has('u')).toBe(false)
  })

  it('标签按页面语言显示，没有浏览器语言相关的原生日期 / 时间控件', () => {
    messages.locale = 'ko'
    const { container } = render(
      <>
        <DateField label="생년월일" name="d" />
        <TimeField label="시간" name="t" />
      </>,
    )
    expect(screen.getByLabelText('년')).toBe(part(container, 'd', 'year'))
    expect(screen.getByLabelText('분')).toBe(part(container, 't', 'minute'))
    expect(screen.getByRole('group', { name: '생년월일' })).toBeTruthy()
    expect(container.querySelector('input[type="date"], input[type="time"]')).toBeNull()
  })
})
