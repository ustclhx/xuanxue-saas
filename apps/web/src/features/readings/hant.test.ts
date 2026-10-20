import { describe, expect, it } from 'vitest'
import { toTraditional } from './hant.ts'

describe('toTraditional', () => {
  it('替换 5.1 抽检中出现的简体字，繁体与歧义字保持不变', () => {
    expect(
      toTraditional(
        '時間与注意力；還在身边，我有点失落；中性的话；承认被执行；更换方法',
        'zh-Hant',
      ),
    ).toBe('時間與注意力；還在身邊，我有點失落；中性的話；承認被執行；更換方法')
    // 一简对多繁的字不收录：天干、皇后、松樹不被误改
    expect(toTraditional('天干地支、皇后牌、松樹、劫財與七殺', 'zh-Hant')).toBe(
      '天干地支、皇后牌、松樹、劫財與七殺',
    )
  })

  it('非繁中报告原样返回', () => {
    expect(toTraditional('경금(庚金)과 与', 'ko')).toBe('경금(庚金)과 与')
  })
})
