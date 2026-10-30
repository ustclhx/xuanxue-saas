import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: unknown; to: string }) => (
    <a href={to}>{children as string}</a>
  ),
}))

import { m } from '../../paraglide/messages.js'
import { spaceSections } from '../app-shell/space-frame.tsx'
import { ChatUnavailable } from './chat-unavailable.tsx'

const base = {
  billing: true,
  credits: true,
  textAi: true,
  mediaAi: false,
  publicApi: false,
  canManageKeys: false,
}

describe('chat availability (specs/ai-chat「无可用模型时隐藏对话入口」)', () => {
  it('空间可用模型数为 0 时导航不含对话入口', () => {
    expect(spaceSections({ ...base, chatAvailable: false }).chat).toBe(false)
    expect(spaceSections({ ...base, chatAvailable: true }).chat).toBe(true)
    expect(spaceSections({ ...base, textAi: false, chatAvailable: true }).chat).toBe(false)
  })

  it('直接访问对话页显示多语言空态与购买积分入口，没有输入框', () => {
    const html = renderToStaticMarkup(<ChatUnavailable slug="personal" />)
    expect(html).toContain(m.ai_chat_unavailable_title())
    expect(html).toContain(m.ai_chat_unavailable_cta())
    expect(html).toContain('href="/app/$slug/billing"')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('<input')
  })

  it.each(['en', 'zh-Hant', 'zh-Hans', 'ko'] as const)('%s 有空态文案', (locale) => {
    expect(m.ai_chat_unavailable_title({}, { locale })).toBeTruthy()
    expect(m.ai_chat_no_models({}, { locale })).toBeTruthy()
  })
})
