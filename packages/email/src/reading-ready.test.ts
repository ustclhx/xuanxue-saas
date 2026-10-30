import { describe, expect, it } from 'vitest'
import { parseEmailQueueMessage } from './queue.ts'
import { renderEmail } from './render.tsx'

const url = 'https://example.test/app/me/readings/report'

describe('报告完成邮件', () => {
  it.each([
    ['en', 'Your full numerology reading'],
    ['zh-Hans', '完整命盘分析'],
    ['zh-Hant', '完整命盤分析'],
    ['ko', '사주 상세 풀이'],
  ])('保留 %s 报告的标题，供队列、邮件主题与正文共同使用', async (locale, title) => {
    const props = { url, title }
    const message = {
      v: 1,
      template: 'reading-ready',
      to: 'reader@example.test',
      locale,
      appName: 'Test',
      idempotencyKey: 'reading-ready:report',
      props,
    }
    expect(parseEmailQueueMessage(message)).toEqual(message)
    const email = await renderEmail('reading-ready', props, { locale, appName: 'Test' })
    expect(email.subject).toBe(`${title} | Test`)
    expect(email.html).toContain(`>${title}</h1>`)
    expect(email.text).toContain(title)
  })

  it('兼容尚未消费且没有报告标题的旧队列消息', async () => {
    const message = {
      v: 1,
      template: 'reading-ready',
      to: 'reader@example.test',
      locale: 'en',
      appName: 'Test',
      idempotencyKey: 'reading-ready:legacy',
      props: { url },
    }
    expect(parseEmailQueueMessage(message)).toEqual(message)
    const email = await renderEmail('reading-ready', message.props, {
      locale: 'en',
      appName: 'Test',
    })
    expect(email.subject).toBe('Your Test full reading is ready')
  })
})
