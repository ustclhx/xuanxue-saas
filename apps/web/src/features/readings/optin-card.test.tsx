// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TURNSTILE_SCRIPT_URL } from '../auth/turnstile.tsx'
import { getGrowthFormOptions } from '../growth/growth.functions.ts'
import { ReadingSlots } from '../tools/reading-slots.tsx'
import { ToolPage } from '../tools/tool-page.tsx'
import { ReadingOptinCard } from './optin-card.tsx'

const language = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => language.locale }
})

vi.mock('../growth/growth.functions.ts', () => ({ getGrowthFormOptions: vi.fn() }))
const optin = {
  result: { kind: 'numerology' as const, lifePath: 11 },
  share: { date: '1987-11-29' },
}
const page = (show: boolean) =>
  renderToString(
    <ToolPage
      tool="life-path"
      title="Life path"
      intro="Intro"
      form={<input />}
      result={show ? <p>CALCULATED RESULT</p> : null}
    >
      <ReadingSlots tool="life-path" optin={show ? optin : null}>
        {show && <section data-slot="reading-unlock">Unlock</section>}
      </ReadingSlots>
    </ToolPage>,
  )

describe('结果后订阅卡', () => {
  it('初次挂载与配置返回后不插入验证脚本，提交时先加载验证再允许携带令牌发送', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(getGrowthFormOptions).mockResolvedValue({ siteKey: 'test-site-key' })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const scriptSelector = `script[src="${TURNSTILE_SCRIPT_URL}"]`
    // 保留脚本的 load 事件控制权，不让 DOM 模拟器联系外部服务。
    const appendScript = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node)
    try {
      await act(async () => root.render(<ReadingOptinCard tool="life-path" data={optin} />))
      expect(getGrowthFormOptions).toHaveBeenCalled()
      expect(document.querySelector(scriptSelector)).toBeNull()
      expect(appendScript).not.toHaveBeenCalled()
      expect(container.querySelector('[data-testid="turnstile"]')).toBeNull()
      const button = container.querySelector('button') as HTMLButtonElement
      expect(button.disabled).toBe(false)
      // 模拟自动填充而没有焦点或输入事件，首次有效提交仍不能绕过验证。
      const email = container.querySelector('input[name="email"]') as HTMLInputElement
      email.value = 'reader@example.test'
      await act(async () => button.click())
      expect(appendScript).toHaveBeenCalledOnce()
      const script = appendScript.mock.calls[0]?.[0] as HTMLScriptElement
      expect(script.src).toBe(TURNSTILE_SCRIPT_URL)
      expect(button.disabled).toBe(true)
      expect(button.textContent).toBe('Loading…')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(container.querySelector('[role="status"]')?.textContent).toBe('')

      window.turnstile = {
        render: vi.fn((_element, options) => {
          options.callback('test-token')
          return 'widget-id'
        }),
        reset: vi.fn(),
        remove: vi.fn(),
      }
      await act(async () => script.dispatchEvent(new Event('load')))
      expect(button.disabled).toBe(false)
      await act(async () => button.click())
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/newsletter',
        expect.objectContaining({
          headers: { 'content-type': 'application/json', 'x-turnstile-token': 'test-token' },
        }),
      )
    } finally {
      await act(async () => root.unmount())
      container.remove()
      document.querySelector(scriptSelector)?.remove()
      appendScript.mockRestore()
      delete window.turnstile
      vi.unstubAllGlobals()
    }
  })

  it.each([
    ['en', ['Love', 'Career', 'Money', 'Reconnection', 'Personal growth']],
    ['zh-Hant', ['愛情', '事業', '財運', '復合', '自我成長']],
    ['ko', ['연애', '직업', '재물', '재회', '자기 성장']],
  ] as const)('%s 内联卡仅在结果后、解锁前出现，并提供五个本语言主题', (locale, topics) => {
    language.locale = locale
    expect(page(false)).not.toContain('data-slot="reading-optin"')
    const html = page(true)
    expect(html.indexOf('CALCULATED RESULT')).toBeLessThan(
      html.indexOf('data-slot="reading-optin"'),
    )
    expect(html.indexOf('data-slot="reading-optin"')).toBeLessThan(
      html.indexOf('data-slot="reading-unlock"'),
    )
    for (const topic of topics) expect(html).toContain(`>${topic}</option>`)
    expect(html).toContain('type="email"')
    expect(html).not.toContain('role="dialog"')
    language.locale = 'en'
  })
})
