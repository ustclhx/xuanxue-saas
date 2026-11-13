import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { m } from '../../paraglide/messages.js'
import type { PickerModel } from './model-picker.ts'

vi.mock('./chat-cost.functions.ts', () => ({ getChatCostContext: vi.fn() }))

import { ChatCostView } from './chat-cost.tsx'

// adopt-subject-chat-readings tasks.md 3.2：「预计 · 余额」、不足时危险色与图标、读取失败只显示预计。
const perToken: PickerModel = {
  id: '00000000-0000-4000-8000-000000000002',
  key: 'smart-chat',
  supportsThinking: false,
  // 每 1k 输入 2 积分、每 1k 输出 10 积分
  pricing: { mode: 'token', inputPer1k: 2, outputPer1k: 10, minCharge: 1 },
}

const render = (cost: Parameters<typeof ChatCostView>[0]['cost'], inputTokens = 1500) =>
  renderToStaticMarkup(<ChatCostView model={perToken} inputTokens={inputTokens} cost={cost} />)

describe('ChatCostView', () => {
  it('余额充足：显示每条预计与余额，不标记不足', () => {
    // 输入 1500 → 3 积分；典型回复 150–800 token → 5–11 积分
    const html = render({ availableCredits: 1280, prefixChars: 0 })
    expect(html).toContain('~5–11 credits per message · Balance 1,280')
    expect(html).not.toContain('data-insufficient')
    expect(html).not.toContain('data-icon="insufficient"')
  })

  it('预计上限超过余额：危险提示，带图标与「不足」文字', () => {
    const html = render({ availableCredits: 10, prefixChars: 0 })
    expect(html).toContain('data-insufficient="true"')
    expect(html).toContain('data-icon="insufficient"')
    expect(html).toContain(m.chat_cost_balance_low({ credits: '10' }))
  })

  it('估算计入对话的固定前缀（报告正文）', () => {
    // 前缀 10,000 字符按保守口径约 10,008 token → 多约 20 积分
    const plain = render({ availableCredits: 1000, prefixChars: 0 }, 0)
    const withPrefix = render({ availableCredits: 1000, prefixChars: 10_000 }, 0)
    expect(plain).toContain('~2–8 credits per message')
    expect(withPrefix).toContain('~22–29 credits per message')
  })

  it('读取失败：只显示预计，不显示余额', () => {
    const html = render('error')
    expect(html).toContain('~5–11 credits per message')
    expect(html).not.toContain('Balance')
    expect(html).not.toContain('data-insufficient')
  })

  it('读取中显示占位，未选模型不渲染', () => {
    expect(render(null)).toContain(m.chat_cost_pending())
    expect(
      renderToStaticMarkup(<ChatCostView model={undefined} inputTokens={0} cost={null} />),
    ).toBe('')
  })
})
