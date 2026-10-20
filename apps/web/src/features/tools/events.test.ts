import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOOL_EVENT_FIELDS, TOOL_EVENTS, toolEventPayload } from './events.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('工具页埋点', () => {
  it('事件名固定为六个', () => {
    expect(TOOL_EVENTS).toEqual([
      'tool_submit',
      'result_view',
      'block_open',
      'tool_link_click',
      'optin_submit',
      'unlock_click',
    ])
  })

  it('载荷只含白名单字段，个人信息无法混入', () => {
    const payload = toolEventPayload(
      { tool: 'bazi', site: 'east', locale: 'zh-Hant' },
      // 模拟调用方误传的表单值
      {
        block: 'pillars',
        birthDate: '1990-05-15',
        name: 'Alice',
        email: 'a@example.com',
      } as never,
    )
    expect(payload).toEqual({ tool: 'bazi', site: 'east', locale: 'zh-Hant', block: 'pillars' })
    for (const key of Object.keys(payload)) expect(TOOL_EVENT_FIELDS).toContain(key)
  })

  it('标识字段不是 slug 时丢弃（自由文本可能含个人信息）', () => {
    expect(
      toolEventPayload(
        { tool: 'Alice 1990-05-15', site: 'mars' as never, locale: 'a@b.c' },
        { target: 'alice@example.com', topic: '感情', block: 'x'.repeat(65) },
      ),
    ).toEqual({})
  })

  it('经 PostHog 发送时只带白名单载荷', async () => {
    const { captureProductEvent, grantAnalyticsConsent, startPostHog } = await import(
      '../analytics/client.ts'
    )
    const { defineTemplateConfig } = await import('@xuanxue/config')
    const config = defineTemplateConfig({
      app: { name: 'Test', url: 'https://arcanumber.com', supportEmail: 't@example.com' },
      features: { analytics: 'posthog' },
      analytics: { posthogKey: 'public-key', posthogHost: 'https://eu.i.posthog.com' },
    })
    const posthog = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    }
    const values = new Map<string, string>()
    vi.stubGlobal(
      'window',
      Object.assign(new EventTarget(), {
        location: { pathname: '/ko/manseryeok/', origin: 'https://ganjiday.com' },
        posthog,
      }),
    )
    vi.stubGlobal('navigator', { doNotTrack: null })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    const payload = toolEventPayload({ tool: 'manseryeok', site: 'east', locale: 'ko' })
    // 未同意时不发送
    expect(captureProductEvent(config, 'tool_submit', payload)).toBe(false)
    grantAnalyticsConsent()
    const stop = startPostHog(config)
    expect(captureProductEvent(config, 'tool_submit', payload)).toBe(true)
    expect(posthog.capture).toHaveBeenLastCalledWith('tool_submit', {
      tool: 'manseryeok',
      site: 'east',
      locale: 'ko',
    })
    stop()
  })
})
