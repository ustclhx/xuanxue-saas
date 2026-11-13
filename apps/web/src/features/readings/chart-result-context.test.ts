import type { JsonValue } from '@xuanxue/db'
import type { KeyValueStore } from '@xuanxue/platform'
import { describe, expect, it } from 'vitest'
import { openSubjectContext, SUBJECT_CONTEXT_TTL_MS } from '../ai/subject-context.ts'
import { readingDefinition } from './catalog.ts'
import { chartResultChatHref, issueChartResultContext } from './chart-result-context.ts'

// adopt-subject-chat-readings tasks.md 4.1：结果页入口签发的地址只带令牌，令牌绑定用户与空间，
// KV 中只有复算结果，没有出生字段。
const SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
const NOW = Date.UTC(2026, 10, 13, 12)

function memoryKv() {
  const data = new Map<string, string>()
  const ttls: (number | undefined)[] = []
  const kv = {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      data.set(key, value)
      ttls.push(options?.expirationTtl)
    },
    delete: async () => {},
  } as KeyValueStore
  return { kv, data, ttls }
}

describe('issueChartResultContext', () => {
  it('地址为 /chat/context?token=，令牌绑定用户与空间，KV 不含出生字段', async () => {
    const definition = readingDefinition('numerology-full', 'en')
    if (!definition) throw new Error('numerology-full missing')
    const recomputed = definition.recompute({ year: 1987, month: 11, day: 29 }, new Date(NOW))
    const result = JSON.parse(JSON.stringify(recomputed.result)) as Record<string, JsonValue>
    const { kv, data, ttls } = memoryKv()
    const deps = { secret: SECRET, cache: kv, now: NOW }
    const { token } = await issueChartResultContext(deps, {
      userId: 'user-a',
      workspaceId: 'ws-a',
      kind: 'numerology-full',
      result,
      locale: 'en',
      returnTo: '/numerology',
    })

    const href = chartResultChatHref('personal-a', token)
    expect(href).toMatch(/^\/app\/personal-a\/chat\/context\?token=[\w%.-]+$/)
    expect(href).not.toMatch(/1987|11-29|lifePath/)
    expect(ttls).toEqual([SUBJECT_CONTEXT_TTL_MS / 1000])
    const stored = [...data.values()].join('')
    expect(stored).toContain('"lifePath"')
    for (const leaked of ['1987', '"year":1987', '"day":29'])
      expect(stored, leaked).not.toContain(leaked)

    const opened = await openSubjectContext(deps, { userId: 'user-a', workspaceId: 'ws-a', token })
    expect(opened).toMatchObject({
      status: 'ok',
      subjectType: 'chart-result',
      returnTo: '/numerology',
      stored: { title: expect.stringMatching(/^Your full numerology reading · \d+/) },
    })
    for (const other of [
      { userId: 'user-b', workspaceId: 'ws-a' },
      { userId: 'user-a', workspaceId: 'ws-b' },
    ])
      expect(await openSubjectContext(deps, { ...other, token })).toEqual({ status: 'invalid' })
  })
})
