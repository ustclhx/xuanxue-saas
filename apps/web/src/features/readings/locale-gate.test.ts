import type { SettingKey } from '@xuanxue/db'
import { READING_KINDS } from '@xuanxue/db'
import { describe, expect, it, vi } from 'vitest'
import { siteReadingPricing } from '../marketing/reading-pricing.server.ts'
import { readingDefinition } from './catalog.ts'
import {
  READING_LOCALE_GATE,
  readingLocaleReleased,
  releasedReadingDefinition,
} from './locale-gate.ts'

// add-locales-eu-ja tasks 5.8 / D-10：未通过评测门槛的「类型 × 语言」不出售，免费结果不受影响
describe('详批语言评测门槛', () => {
  it('es 两个组合已注册但尚未放行；未登记的组合视为已通过', () => {
    expect(readingDefinition('numerology-full', 'es')).toBeDefined()
    expect(readingDefinition('tarot-spread', 'es')).toBeDefined()
    expect(readingLocaleReleased('numerology-full', 'es')).toBe(false)
    expect(readingLocaleReleased('tarot-spread', 'es')).toBe(false)
    expect(releasedReadingDefinition('numerology-full', 'es')).toBeUndefined()
    expect(releasedReadingDefinition('tarot-spread', 'es')).toBeUndefined()
    // 已有语言不受影响
    for (const kind of READING_KINDS)
      for (const locale of readingDefinition(kind)?.locales ?? [])
        if (locale !== 'es')
          expect(releasedReadingDefinition(kind, locale)?.prompt.version, `${kind} ${locale}`).toBe(
            readingDefinition(kind, locale)?.prompt.version,
          )
    expect(releasedReadingDefinition('bazi-full', 'es')).toBeUndefined()
    expect(readingLocaleReleased('__proto__', 'es')).toBe(true)
  })

  it('门槛登记的每个组合都在 catalog 注册（放行后不会指向不存在的变体）', () => {
    for (const [kind, byLocale] of Object.entries(READING_LOCALE_GATE))
      for (const [locale, status] of Object.entries(byLocale ?? {})) {
        expect(readingDefinition(kind, locale), `${kind} ${locale}`).toBeDefined()
        expect(['pending', 'passed']).toContain(status)
      }
  })

  it('定价页：es 的详批未放行时不列出、不读取运营设置', async () => {
    const find = vi.fn(async (_key: SettingKey) => undefined)
    const readings = await siteReadingPricing('west', 'es', {
      settings: { store: { find } },
      db: {} as never,
      aiEnv: null,
    })
    expect(readings).toEqual([])
    expect(find).not.toHaveBeenCalled()
  })
})
