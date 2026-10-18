/**
 * 生成后的合规规则检查（add-reading-monetization design 决策 3 第二、三层，tasks.md 2.3）：
 * 提示词约束之外，按禁止词表检查具体日期预言、病名诊断与投资标的，命中的段落（列表按条）
 * 整段替换为本语言的安全提示。调用方记录审计日志，日志只含规则与位置，不含报告正文。
 */

export type ComplianceRule = 'date-prediction' | 'medical' | 'investment'

export interface ComplianceViolation {
  readonly rule: ComplianceRule
  /** 命中的段落序号（按空行分段，列表按条计） */
  readonly block: number
}

export interface ComplianceResult {
  readonly content: string
  readonly violations: readonly ComplianceViolation[]
}

/** RegExp 或组合条件 */
interface Matcher {
  test(text: string): boolean
}

interface LocaleRules {
  readonly patterns: Record<ComplianceRule, readonly Matcher[]>
  readonly replacements: Record<ComplianceRule, string>
}

// 只认到月或日的具体日期；「2025–2034 年大運」这类年份区间不算预言
const ZH_DATE = /(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日號号]|\d{4}\s*年\s*\d{1,2}\s*月/
const ZH_ASSERT = /會|将|將|必|一定|註定|注定|肯定/
const KO_DATE = /(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}\s*년\s*\d{1,2}\s*월/
const KO_ASSERT = /것입니다|겁니다|될 것|반드시|틀림없이|일어납니다|일어날|생깁니다|생길/
const EN_DATE =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b|\b\d{4}-\d{2}(?:-\d{2})?\b/i
const EN_ASSERT = /\b(?:will|shall|is going to|are going to|destined|certainly|definitely)\b/i

/** 同一段同时出现具体日期与断言语气才算日期预言 */
const both = (date: RegExp, assert: RegExp): Matcher => ({
  test: (text: string) => date.test(text) && assert.test(text),
})

const RULES: Record<'zh-Hant' | 'ko' | 'en', LocaleRules> = {
  'zh-Hant': {
    patterns: {
      'date-prediction': [both(ZH_DATE, ZH_ASSERT)],
      medical: [
        /癌|腫瘤|肿瘤|糖尿病|高血壓|高血压|心臟病|心脏病|中風|中风|憂鬱症|抑鬱症|抑郁症|肝炎|腎病|肾病|失智|不孕|肺炎|診斷|诊断|罹患/,
      ],
      investment: [
        /股票|個股|个股|基金|期貨|期货|比特幣|比特币|加密貨幣|加密货币|虛擬貨幣|虚拟货币|\bETF\b|買進|买进|槓桿|杠杆|外匯|外汇/i,
      ],
    },
    replacements: {
      'date-prediction':
        '命理只能呈現整體傾向，無法斷定具體日期會發生的事件，請以實際生活狀況為準。',
      medical: '請維持規律作息、均衡飲食與適度運動；如有不適請諮詢專業醫師。',
      investment: '理財與投資決策請依自身狀況審慎評估，並諮詢合格的專業人士。',
    },
  },
  ko: {
    patterns: {
      'date-prediction': [both(KO_DATE, KO_ASSERT)],
      medical: [
        /(?:^|[\s(「"'])암(?:[이을에은]|\s|$)|종양|당뇨|고혈압|심장병|뇌졸중|우울증|간염|신장병|치매|불임|폐렴|진단|발병/,
      ],
      investment: [
        /주식|종목|펀드|비트코인|가상화폐|암호화폐|코인|\bETF\b|매수|매도|레버리지|외환/i,
      ],
    },
    replacements: {
      'date-prediction':
        '명리는 전체적인 흐름만 보여 줄 뿐 특정 날짜에 일어날 일을 단정할 수 없으니, 실제 상황을 기준으로 판단하세요.',
      medical:
        '규칙적인 수면, 균형 잡힌 식사, 적당한 운동을 유지하세요. 불편한 증상이 있으면 전문 의료진과 상담하세요.',
      investment:
        '재테크와 투자 결정은 본인의 상황을 신중히 검토하고 자격을 갖춘 전문가와 상담하세요.',
    },
  },
  en: {
    patterns: {
      'date-prediction': [both(EN_DATE, EN_ASSERT)],
      medical: [
        /\b(?:cancer|tumou?r|diabetes|hypertension|heart disease|stroke|depression|hepatitis|kidney disease|dementia|infertility|pneumonia|diagnos[ie]s|diagnosed)\b/i,
      ],
      investment: [
        /\b(?:stocks?|shares|mutual funds?|futures|bitcoin|crypto(?:currency|currencies)?|ETFs?|forex|leverage)\b/i,
      ],
    },
    replacements: {
      'date-prediction':
        'Readings show tendencies only and cannot foretell what will happen on a specific date.',
      medical:
        'Keep a regular routine, balanced meals and moderate exercise. If you feel unwell, please consult a medical professional.',
      investment:
        'Make financial and investment decisions based on your own situation and with a qualified professional.',
    },
  },
}

const ORDER: readonly ComplianceRule[] = ['medical', 'investment', 'date-prediction']
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/
const HEADING = /^#{1,6}\s/

function rulesFor(locale: string): LocaleRules {
  if (locale === 'zh-Hant' || locale === 'ko') return RULES[locale]
  return RULES.en
}

function firstViolation(text: string, rules: LocaleRules): ComplianceRule | undefined {
  // 标题本身不替换，避免破坏章节结构
  if (HEADING.test(text)) return undefined
  return ORDER.find((rule) => rules.patterns[rule].some((pattern) => pattern.test(text)))
}

/** 检查并替换命中的段落；列表块逐条检查，替换后保留列表符号。 */
export function checkCompliance(markdown: string, locale: string): ComplianceResult {
  const rules = rulesFor(locale)
  const violations: ComplianceViolation[] = []
  let index = 0
  const blocks = markdown.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    const isList = lines.every((line) => line.trim() === '' || LIST_ITEM.test(line))
    const units = isList ? lines : [block]
    const replaced = units.map((unit) => {
      if (unit.trim() === '') return unit
      const block = index++
      const rule = firstViolation(unit, rules)
      if (!rule) return unit
      violations.push({ rule, block })
      const marker = isList ? (unit.match(LIST_ITEM)?.[0] ?? '- ') : ''
      return `${marker}${rules.replacements[rule]}`
    })
    return isList ? replaced.join('\n') : (replaced[0] ?? '')
  })
  return { content: blocks.join('\n\n'), violations }
}
