import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChatContextSummary } from './chat-context-summary-card.tsx'
import { CHAT_CONTEXT_PART, type ChatContext, contextFromParts } from './legacy-chat-context.ts'
import { subjectSystemParts } from './subject-context.ts'

const context: ChatContext = {
  kind: 'bazi-full',
  result: {
    pillars: { year: { stem: 'jia', branch: 'zi' }, day: { stem: 'wu', branch: 'chen' } },
    dayMaster: 'wu',
  },
}

describe('旧对话摘要', () => {
  it('带 data-chat-context 的旧 system parts 显示摘要；新对象对话不显示', () => {
    const legacy = contextFromParts([
      { type: 'text', text: 'legacy prompt' },
      { type: CHAT_CONTEXT_PART, data: context },
    ])
    expect(legacy).toEqual(context)
    const html = renderToStaticMarkup(<ChatContextSummary context={legacy as ChatContext} />)
    expect(html).toContain('data-testid="chat-context-summary"')
    expect(html).toContain('甲子 · — · 戊辰 · —')

    const subject = subjectSystemParts('chart-result', {
      version: 'chart-result-v1',
      data: { kind: 'bazi-full', result: context.result },
    })
    expect(contextFromParts(subject)).toBeNull()
    expect(contextFromParts([{ type: 'text', text: 'hi' }])).toBeNull()
  })
})
