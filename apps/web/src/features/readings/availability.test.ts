import type { TextModelEnv } from '@xuanxue/ai'
import type { Database, SettingKey } from '@xuanxue/db'
import { describe, expect, it, vi } from 'vitest'
import { evaluateReadingAvailability, loadReadingAvailability } from './availability.ts'

const config = { enabled: true, credits: 100, modelKey: 'deepseek-flash' }
const model = { provider: 'deepseek', providerModelId: 'deepseek-chat' }
/** 生产 web 的出口配置：direct、无 Gateway；只差 DEEPSEEK_API_KEY */
const PRODUCTION_ENV: TextModelEnv = { AI_TEXT_EGRESS: 'direct' }
const READY_ENV: TextModelEnv = { ...PRODUCTION_ENV, DEEPSEEK_API_KEY: 'test-key' }

describe('evaluateReadingAvailability', () => {
  it('开关打开、模型启用且 Provider 已配置时开放', () => {
    expect(evaluateReadingAvailability({ config, model, env: READY_ENV })).toEqual({
      available: true,
      blocker: null,
    })
  })

  it.each([
    [
      '未选定模型',
      { config: { ...config, modelKey: '' }, model, env: READY_ENV },
      'not-configured',
    ],
    ['积分为 0', { config: { ...config, credits: 0 }, model, env: READY_ENV }, 'not-configured'],
    ['开关关闭', { config: { ...config, enabled: false }, model, env: READY_ENV }, 'switched-off'],
    ['模型不存在或已停用', { config, model: null, env: READY_ENV }, 'model-missing'],
    ['缺 DEEPSEEK_API_KEY', { config, model, env: PRODUCTION_ENV }, 'provider-not-configured'],
    ['未装配 AI 能力', { config, model, env: null }, 'provider-not-configured'],
  ] as const)('%s时不开放', (_label, input, blocker) => {
    expect(evaluateReadingAvailability(input)).toEqual({ available: false, blocker })
  })

  it('平台管理员可预览关闭的详批，但缺 Provider 时仍不可用', () => {
    const off = { ...config, enabled: false }
    expect(
      evaluateReadingAvailability({ config: off, model, env: READY_ENV, adminPreview: true })
        .available,
    ).toBe(true)
    expect(
      evaluateReadingAvailability({ config: off, model, env: PRODUCTION_ENV, adminPreview: true }),
    ).toEqual({ available: false, blocker: 'provider-not-configured' })
  })
})

describe('loadReadingAvailability', () => {
  function deps(values: Partial<Record<SettingKey, unknown>>, rows: unknown[]) {
    const limit = vi.fn(async () => rows)
    const query = { from: () => query, where: () => query, limit }
    return {
      limit,
      deps: {
        settings: { store: { find: vi.fn(async (key: SettingKey) => values[key]) } },
        db: { select: () => query } as unknown as Database,
        aiEnv: READY_ENV,
      },
    }
  }

  it('未选定模型（生产默认）时不查询 ai_model', async () => {
    const { deps: d, limit } = deps({}, [])
    const status = await loadReadingAvailability(d, 'bazi-full')
    expect(status).toMatchObject({ available: false, blocker: 'not-configured' })
    expect(limit).not.toHaveBeenCalled()
  })

  it('选定的模型可用时开放并返回设置的积分', async () => {
    const { deps: d } = deps(
      { 'readings.bazi-full.modelKey': 'deepseek-flash', 'readings.bazi-full.credits': 120 },
      [{ key: 'deepseek-flash', ...model }],
    )
    const status = await loadReadingAvailability(d, 'bazi-full')
    expect(status).toMatchObject({ available: true, config: { credits: 120 } })
  })
})
