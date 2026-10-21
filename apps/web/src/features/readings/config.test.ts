import { describe, expect, it } from 'vitest'
import { readingAvailable } from './config.ts'

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
