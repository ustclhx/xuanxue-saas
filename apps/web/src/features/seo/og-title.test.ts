import { describe, expect, it } from 'vitest'
import { ogImageTitle } from './og-title.ts'

describe('分享图短标题', () => {
  it('取分隔符前的主标题', () => {
    expect(ogImageTitle('Life Path Number Calculator: Free Numerology Tool')).toBe(
      'Life Path Number Calculator',
    )
    expect(ogImageTitle('免費八字排盤｜四柱命盤與大運')).toBe('免費八字排盤')
    expect(ogImageTitle('만세력 · 무료 사주')).toBe('만세력')
  })
  it('没有分隔符时原样返回', () => {
    expect(ogImageTitle('Life Path')).toBe('Life Path')
  })
})
