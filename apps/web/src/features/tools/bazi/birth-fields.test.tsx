// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteContext } from '../../site/context.tsx'
import { ToolForm } from '../form.tsx'
import { BirthFields } from './birth-fields.tsx'
import { type BirthFormValues, defaultBirthValues, readBirthForm } from './birth-form-state.ts'

const messages = vi.hoisted(() => ({ locale: 'zh-Hant' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

const filled: BirthFormValues = {
  ...defaultBirthValues('zh-Hant'),
  year: '1990',
  month: '5',
  day: '15',
  time: '10:30',
}

let cleanup = () => {}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function mount(values: BirthFormValues, trueSolarCallout = false) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () =>
    root.render(
      <SiteContext value="east">
        <ToolForm label="出生資料" onSubmit={() => {}}>
          <BirthFields values={values} locale="zh-Hant" trueSolarCallout={trueSolarCallout} />
        </ToolForm>
      </SiteContext>,
    ),
  )
  cleanup = () => {
    act(() => root.unmount())
    container.remove()
  }
  const form = container.querySelector('form') as HTMLFormElement
  const details = container.querySelector('details') as HTMLDetailsElement
  const trueSolar = container.querySelector('input[name="trueSolar"]') as HTMLInputElement
  return { form, details, trueSolar, read: () => readBirthForm(new FormData(form)) }
}

// refresh-visual-system-warm 5.2：进阶选项默认收起，收起 / 展开不丢已填值
describe('出生信息字段的进阶选项', () => {
  it('默认收起；收起时已填的日期、时间与出生地照常进入表单数据', async () => {
    const { details, trueSolar, read } = await mount(filled)
    expect(details.open).toBe(false)
    expect(details.contains(trueSolar)).toBe(true)
    expect(read()).toMatchObject({
      year: '1990',
      month: '5',
      day: '15',
      time: '10:30',
      place: filled.place,
      trueSolar: false,
    })
  })

  it('展开后勾选真太阳时，再收起仍保留勾选与其余已填值', async () => {
    const { form, details, trueSolar, read } = await mount(filled)
    await act(async () => {
      details.open = true
    })
    await act(async () => trueSolar.click())
    const year = form.querySelector('input[name="year"]') as HTMLInputElement
    year.value = '1988'
    await act(async () => {
      details.open = false
    })
    expect(trueSolar.checked).toBe(true)
    expect(read()).toMatchObject({ year: '1988', time: '10:30', trueSolar: true })
    await act(async () => {
      details.open = true
    })
    expect(trueSolar.checked).toBe(true)
    expect(read().year).toBe('1988')
  })

  it('已开启真太阳时（分享恢复、跨页带入）或韩语页的醒目提示时默认展开', async () => {
    const restored = await mount({ ...filled, trueSolar: true })
    expect(restored.details.open).toBe(true)
    expect(restored.trueSolar.checked).toBe(true)
    cleanup()
    const korean = await mount(filled, true)
    expect(korean.details.open).toBe(true)
  })
})
