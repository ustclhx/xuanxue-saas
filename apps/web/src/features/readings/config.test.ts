import type { SettingKey } from '@xuanxue/db'
import { describe, expect, it } from 'vitest'
import { readingAvailable, readingConfig } from './config.ts'

const open = { enabled: true, credits: 100, modelKey: 'deepseek-flash' }

describe('readingAvailable', () => {
  it('hides a disabled reading from visitors even when a model is selected', () => {
    expect(readingAvailable({ ...open, enabled: false })).toBe(false)
  })

  it('lets a platform admin preview a disabled reading once a model and credits are set', () => {
    expect(readingAvailable({ ...open, enabled: false }, { adminPreview: true })).toBe(true)
  })

  it('keeps an unset model or zero price unavailable even for an admin preview', () => {
    expect(readingAvailable({ ...open, modelKey: '' }, { adminPreview: true })).toBe(false)
    expect(readingAvailable({ ...open, credits: 0 }, { adminPreview: true })).toBe(false)
  })
})

function ctxWith(rows: Partial<Record<SettingKey, unknown>>) {
  return { store: { find: async (key: SettingKey) => rows[key] } }
}

describe('readingConfig model inheritance', () => {
  it('lets a new reading reuse a same-site reading model when none is selected', async () => {
    const config = await readingConfig(
      ctxWith({
        'readings.numerology-full.modelKey': 'west-model',
        'readings.bazi-full.modelKey': 'east-model',
      }),
      'natal-full',
    )
    expect(config.modelKey).toBe('west-model')
  })

  it('keeps an explicitly selected model', async () => {
    const config = await readingConfig(
      ctxWith({
        'readings.natal-full.modelKey': 'own',
        'readings.numerology-full.modelKey': 'west-model',
      }),
      'natal-full',
    )
    expect(config.modelKey).toBe('own')
  })

  it('falls back to any configured reading, and stays empty when none is configured', async () => {
    expect(
      (await readingConfig(ctxWith({ 'readings.bazi-full.modelKey': 'east-model' }), 'natal-full'))
        .modelKey,
    ).toBe('east-model')
    expect((await readingConfig(ctxWith({}), 'natal-full')).modelKey).toBe('')
  })
})
