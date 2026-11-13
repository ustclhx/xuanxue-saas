import { READING_KINDS, type SettingKey } from '@xuanxue/db'
import { log } from '@xuanxue/shared/log'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isReadingPromptVersion,
  readingDefinition,
  readingPromptVersions,
  resolveReadingDefinition,
} from './catalog.ts'
import { readingConfig } from './config.ts'

// readings-prompt-v4-yearly tasks.md 2.4：提示词版本注册表与运行时设置的取值校验。

afterEach(() => vi.restoreAllMocks())

const settings = (values: Partial<Record<SettingKey, unknown>>) => ({
  store: { find: async (key: SettingKey) => values[key] },
})

describe('提示词版本注册表', () => {
  it('未指定版本时为代码默认版本；指定已注册版本时按语言取该版本', () => {
    expect(readingDefinition('bazi-full', 'zh-Hant')?.prompt.version).toBe('bazi-full.v2')
    expect(
      readingDefinition('bazi-full', 'zh-Hans', { promptVersion: 'bazi-full.v3' })?.prompt.version,
    ).toBe('bazi-full.v3')
    expect(readingDefinition('bazi-full', 'zh-Hans', { promptVersion: '' })?.prompt.version).toBe(
      'bazi-full.v3',
    )
    // 该语言没有该版本
    expect(readingDefinition('bazi-full', 'zh-Hant', { promptVersion: 'bazi-full.v3' })).toBe(
      undefined,
    )
  })

  it('每种详批的注册版本包含各语言的默认版本', () => {
    for (const kind of READING_KINDS) {
      const versions = readingPromptVersions(kind)
      for (const locale of readingDefinition(kind)?.locales ?? []) {
        const version = readingDefinition(kind, locale)?.prompt.version ?? ''
        expect(versions.find((item) => item.version === version)?.locales).toContain(locale)
        expect(isReadingPromptVersion(kind, version)).toBe(true)
      }
      expect(isReadingPromptVersion(kind, '')).toBe(true)
      expect(isReadingPromptVersion(kind, `${kind}.v99`)).toBe(false)
    }
    expect(isReadingPromptVersion('bazi-full', 'tarot-spread.v3')).toBe(false)
  })

  it('按记录版本取定义；版本不支持该语言时回退默认版本并告警', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {})
    expect(resolveReadingDefinition('bazi-full', 'zh-Hans', 'bazi-full.v3')?.prompt.version).toBe(
      'bazi-full.v3',
    )
    expect(warn).not.toHaveBeenCalled()
    expect(resolveReadingDefinition('bazi-full', 'zh-Hant', 'bazi-full.v3')?.prompt.version).toBe(
      'bazi-full.v2',
    )
    expect(warn).toHaveBeenCalledWith('readings.prompt_version_fallback', expect.anything())
    expect(resolveReadingDefinition('bazi-full', 'ko', '')).toBeUndefined()
  })
})

describe('readingConfig 的提示词版本', () => {
  it('读取已注册的版本', async () => {
    const config = await readingConfig(
      settings({ 'readings.bazi-full.promptVersion': 'bazi-full.v3' }),
      'bazi-full',
    )
    expect(config.promptVersion).toBe('bazi-full.v3')
  })

  it('缺省为空字符串（代码默认版本）', async () => {
    expect((await readingConfig(settings({}), 'tarot-spread')).promptVersion).toBe('')
  })

  it('非法值回退为默认版本并告警', async () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {})
    const config = await readingConfig(
      settings({ 'readings.ziwei-full.promptVersion': 'ziwei-full.v99' }),
      'ziwei-full',
    )
    expect(config.promptVersion).toBe('')
    expect(warn).toHaveBeenCalledWith('readings.prompt_version_invalid', {
      kind: 'ziwei-full',
      promptVersion: 'ziwei-full.v99',
    })
  })
})
