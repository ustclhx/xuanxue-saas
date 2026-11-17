// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { closeHeaderMenu, HeaderMenu, MenuIcon } from './header-menu.tsx'

// 页头菜单 / 手机导航面板的键盘行为（refresh-visual-system-warm 4.3）：原生 <details> 负责展开，
// 这里补的是 Esc 关闭并把焦点还给按钮、点击外部关闭、选择菜单项后收起。
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let cleanup = () => {}
afterEach(() => cleanup())

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() =>
    root.render(
      <>
        <HeaderMenu label="選單" icon={<MenuIcon />} wide>
          <a href="/zh-hant/pricing" id="item">
            定價
          </a>
        </HeaderMenu>
        <button type="button" id="outside">
          outside
        </button>
      </>,
    ),
  )
  cleanup = () => {
    act(() => root.unmount())
    host.remove()
  }
  const details = host.querySelector('details') as HTMLDetailsElement
  const summary = host.querySelector('summary') as HTMLElement
  return { details, summary, host }
}

describe('HeaderMenu', () => {
  it('图标按钮有可读名称；服务端结构里面板内容已在 DOM 中', () => {
    const { summary, host } = mount()
    expect(summary.getAttribute('aria-label')).toBe('選單')
    expect(host.querySelector('#item')).not.toBeNull()
  })

  it('Esc 关闭面板并把焦点还给按钮', () => {
    const { details, summary, host } = mount()
    details.open = true
    ;(host.querySelector('#item') as HTMLElement).focus()
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(details.open).toBe(false)
    expect(document.activeElement).toBe(summary)
  })

  it('点击面板外部关闭，点击面板内部不关闭', () => {
    const { details, host } = mount()
    details.open = true
    act(() => {
      host.querySelector('#item')?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(details.open).toBe(true)
    act(() => {
      host.querySelector('#outside')?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(details.open).toBe(false)
  })

  it('选择菜单项后可收起菜单', () => {
    const { details, host } = mount()
    details.open = true
    closeHeaderMenu(host.querySelector('#item') as HTMLElement)
    expect(details.open).toBe(false)
  })
})
