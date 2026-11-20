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

  async function submitWith(status: number) {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.mocked(getGrowthFormOptions).mockResolvedValue({ siteKey: null })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('{}', { status, headers: { 'content-type': 'application/json' } }),
      ),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<GrowthForm feature="newsletter" />))
    const input = container.querySelector('input[type="email"]') as HTMLInputElement
    const status1 = container.querySelector('[role="status"]')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, 'reader@example.com')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      ;(container.querySelector('form') as HTMLFormElement).requestSubmit()
    })
    const cleanup = async () => {
      await act(async () => root.unmount())
      container.remove()
      vi.unstubAllGlobals()
    }
    return { container, status1, cleanup }
  }

  it('服务错误（503）提示重试，但不把合法邮箱标成无效', async () => {
    const { container, cleanup } = await submitWith(503)
    try {
      expect(
        container.querySelector('input[type="email"]')?.getAttribute('aria-invalid'),
      ).toBeNull()
      expect(container.querySelector('[role="status"]')?.textContent).not.toBe('')
    } finally {
      await cleanup()
    }
  })

  it('服务端判定邮箱无效（400）时标记 aria-invalid', async () => {
    const { container, cleanup } = await submitWith(400)
    try {
      expect(container.querySelector('input[type="email"]')?.getAttribute('aria-invalid')).toBe(
        'true',
      )
    } finally {
      await cleanup()
    }
  })

  it('提交成功时播报节点保持挂载，表单换成确认信息', async () => {
    const { container, status1, cleanup } = await submitWith(200)
    try {
      expect(container.querySelector('form')).toBeNull()
      const status2 = container.querySelector('[role="status"]')
      expect(status2).toBe(status1)
      expect(status2?.textContent).not.toBe('')
    } finally {
      await cleanup()
    }
  })
})
