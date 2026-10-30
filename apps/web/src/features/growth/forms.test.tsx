// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GrowthForm } from './forms.tsx'
import { getGrowthFormOptions } from './growth.functions.ts'

vi.mock('./growth.functions.ts', () => ({ getGrowthFormOptions: vi.fn() }))

describe('电子报表单', () => {
  it('服务端渲染直接输出邮箱输入框与提交按钮，不以加载中作为首屏', () => {
    const html = renderToString(<GrowthForm feature="newsletter" />)
    expect(html).toContain('type="email"')
    expect(html).toContain('type="submit"')
    expect(html).not.toContain('Loading…')
    expect(getGrowthFormOptions).not.toHaveBeenCalled()
  })

  it('配置读取失败时表单仍可见，并在提交区显示不可用说明', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.mocked(getGrowthFormOptions).mockRejectedValue(new Error('down'))
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => root.render(<GrowthForm feature="newsletter" />))
      expect(container.querySelector('input[type="email"]')).not.toBeNull()
      expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true)
      expect(container.querySelector('[role="status"]')?.textContent).toBe(
        'This form is unavailable.',
      )
    } finally {
      await act(async () => root.unmount())
      container.remove()
      vi.unstubAllGlobals()
    }
  })

  it('配置返回且未启用验证时允许提交', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.mocked(getGrowthFormOptions).mockResolvedValue({ siteKey: null })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => root.render(<GrowthForm feature="newsletter" />))
      expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(false)
      expect(container.querySelector('[data-testid="turnstile"]')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      container.remove()
      vi.unstubAllGlobals()
    }
  })
})
