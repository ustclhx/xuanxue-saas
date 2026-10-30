import { describe, expect, it, vi } from 'vitest'
import { getLocale } from '../../paraglide/runtime.js'
import { readingTitle } from './title.ts'

vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: vi.fn(() => 'ko') }
})

describe('报告标题', () => {
  it.each([
    ['numerology-full', 'en', 'Your full numerology reading'],
    ['tarot-spread', 'en', 'Full spread reading'],
    ['bazi-full', 'zh-Hans', '完整命盘分析'],
    ['ziwei-full', 'zh-Hans', '完整紫微命盘分析'],
    ['tarot-spread', 'zh-Hans', '完整牌阵解读'],
    ['bazi-full', 'zh-Hant', '完整命盤分析'],
    ['saju-full', 'ko', '사주 상세 풀이'],
    ['saju-compat', 'ko', '궁합 상세 풀이'],
  ])('按保存的语言显示 %s (%s)，不跟随当前界面语言', (kind, locale, title) => {
    expect(readingTitle(kind, locale)).toBe(title)
  })

  it('未指定报告语言的工具入口仍使用当前界面语言', () => {
    vi.mocked(getLocale).mockReturnValueOnce('en')
    expect(readingTitle('tarot-spread')).toBe('Full spread reading')
  })
})
