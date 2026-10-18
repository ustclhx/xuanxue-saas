import { describe, expect, it } from 'vitest'
import { checkCompliance } from './compliance.ts'

// tasks.md 2.3：健康、日期预言、投资三类样例的命中与替换。
describe('合规规则检查', () => {
  it('健康：病名诊断整段替换为作息与就医提示，其他段落不变', () => {
    const text = [
      '## 健康作息提示',
      '你的作息宜早睡早起，多散步。',
      '命中水弱，日後容易罹患糖尿病，需要特別注意。',
    ].join('\n\n')
    const result = checkCompliance(text, 'zh-Hant')
    expect(result.violations).toEqual([{ rule: 'medical', block: 2 }])
    expect(result.content).not.toContain('糖尿病')
    expect(result.content).toContain('如有不適請諮詢專業醫師')
    expect(result.content).toContain('你的作息宜早睡早起，多散步。')
    expect(result.content.startsWith('## 健康作息提示')).toBe(true)
  })

  it('日期预言：具体月日加断言语气才替换，年份区间的大运描述保留', () => {
    const decade = '2025–2034 年這步大運以穩定累積為主。'
    const prophecy = '2027年3月你一定會遇到正緣並結婚。'
    const result = checkCompliance(`${decade}\n\n${prophecy}`, 'zh-Hant')
    expect(result.violations).toEqual([{ rule: 'date-prediction', block: 1 }])
    expect(result.content).toContain(decade)
    expect(result.content).not.toContain('2027年3月')
  })

  it('投资：列表中提到具体标的的条目被替换，保留列表符号与其他条目', () => {
    const text = '## 재물운\n\n- 꾸준한 저축이 유리합니다.\n- 올해는 비트코인을 매수하면 좋습니다.'
    const result = checkCompliance(text, 'ko')
    expect(result.violations).toEqual([{ rule: 'investment', block: 2 }])
    expect(result.content).toContain('- 꾸준한 저축이 유리합니다.')
    expect(result.content).toContain('- 재테크와 투자 결정은')
    expect(result.content).not.toContain('비트코인')
  })

  it('韩语日期预言与病名、英语回退规则', () => {
    expect(
      checkCompliance('2027년 5월 12일에 반드시 이직하게 될 것입니다.', 'ko').violations,
    ).toEqual([{ rule: 'date-prediction', block: 0 }])
    // 「암시」不是病名
    expect(checkCompliance('이 배치는 변화의 암시입니다.', 'ko').violations).toEqual([])
    expect(checkCompliance('위암 위험이 있습니다. 암 검사를 받으세요.', 'ko').violations).toEqual([
      { rule: 'medical', block: 0 },
    ])
    expect(checkCompliance('Consider buying bitcoin this year.', 'en').violations).toEqual([
      { rule: 'investment', block: 0 },
    ])
  })

  it('健康的报告不做任何改动', () => {
    const text = '## 總論\n\n日主甲木，性格正直。\n\n## 建議\n\n- 保持規律作息\n- 多與朋友交流'
    expect(checkCompliance(text, 'zh-Hant')).toEqual({ content: text, violations: [] })
  })
})
