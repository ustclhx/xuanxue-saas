import type { ReadingKind } from '@xuanxue/db'

/**
 * 对话的开场推荐问题（adopt-subject-chat-readings design 决策 4）：按「详批类型 × 语言」静态提供，
 * 付费报告（`reading`）用报告语言，免费结果（`chart-result`）用页面语言。
 * 问题只引导反思与理解，不问具体日期、病症或投资标的，须通过 `checkCompliance`（见单元测试）。
 * 回复后的推荐问题由模板 `follow-ups.server.ts` 按上下文生成，不在这里。
 */

type Questions = readonly [string, string, string]

const BAZI_HANT: Questions = [
  '我的日主與五行強弱，對個性有什麼影響？',
  '命盤中的喜用神，在日常生活中可以怎麼運用？',
  '目前這步大運，我在工作與人際上可以留意什麼？',
]
const BAZI_HANS: Questions = [
  '我的日主与五行强弱，对性格有什么影响？',
  '命盘中的喜用神，在日常生活中可以怎么运用？',
  '目前这步大运，我在工作与人际上可以留意什么？',
]

const TABLE: Readonly<Record<ReadingKind, Readonly<Record<string, Questions>>>> = {
  'bazi-full': { 'zh-Hant': BAZI_HANT, 'zh-Hans': BAZI_HANS },
  'saju-full': {
    ko: [
      '제 일간과 오행의 균형은 성격에 어떤 영향을 주나요?',
      '용신을 일상생활에서 어떻게 활용할 수 있을까요?',
      '지금의 대운에서 일과 인간관계에 무엇을 유의하면 좋을까요?',
    ],
  },
  'ziwei-full': {
    'zh-Hant': [
      '我的命宮主星代表哪些性格特質？',
      '命宮與身宮的組合，在做決定時有什麼提醒？',
      '從官祿宮來看，我適合怎樣的工作節奏？',
    ],
    'zh-Hans': [
      '我的命宫主星代表哪些性格特质？',
      '命宫与身宫的组合，在做决定时有什么提醒？',
      '从官禄宫来看，我适合怎样的工作节奏？',
    ],
  },
  'saju-compat': {
    ko: [
      '두 사람의 오행은 서로 어떻게 보완되나요?',
      '갈등이 생길 때 서로 어떤 점을 배려하면 좋을까요?',
      '이 궁합에서 관계를 오래 이어가기 위한 조언이 있을까요?',
    ],
  },
  'numerology-full': {
    en: [
      'How does my Life Path number shape the way I make decisions?',
      'What does my Personal Year suggest I focus on right now?',
      'How do my core numbers work together in relationships?',
    ],
  },
  'tarot-spread': {
    en: [
      'What overall message connects these cards?',
      'Which card is most worth reflecting on, and why?',
      'What small, practical step could I take based on this spread?',
    ],
    'zh-Hant': [
      '這幾張牌之間串起的整體訊息是什麼？',
      '哪一張牌最值得我多加思考？為什麼？',
      '根據這個牌陣，我可以先採取什麼具體的小行動？',
    ],
    'zh-Hans': [
      '这几张牌之间串起的整体信息是什么？',
      '哪一张牌最值得我多加思考？为什么？',
      '根据这个牌阵，我可以先采取什么具体的小行动？',
    ],
    ko: [
      '이 카드들을 잇는 전체 메시지는 무엇인가요?',
      '어떤 카드를 가장 깊이 생각해 보면 좋을까요? 그 이유는요?',
      '이 스프레드를 바탕으로 지금 실천할 수 있는 작은 행동은 무엇일까요?',
    ],
  },
}

/** 该类型没有页面语言的问题时（如英文页的八字结果）使用的通用问题，避免给出另一种语言 */
const GENERIC_EN: Questions = [
  'What are the key takeaways from this result?',
  'Which part of this result is most worth reflecting on?',
  'How could I apply this in my daily life?',
]
const GENERIC: Readonly<Record<string, Questions>> = {
  en: GENERIC_EN,
  'zh-Hant': [
    '這個結果最重要的重點是什麼？',
    '其中哪一部分最值得我多加思考？',
    '我可以怎麼把這些應用在日常生活中？',
  ],
  'zh-Hans': [
    '这个结果最重要的要点是什么？',
    '其中哪一部分最值得我多加思考？',
    '我可以怎么把这些应用在日常生活中？',
  ],
  ko: [
    '이 결과에서 가장 중요한 점은 무엇인가요?',
    '어떤 부분을 가장 깊이 생각해 보면 좋을까요?',
    '이 내용을 일상생활에 어떻게 적용할 수 있을까요?',
  ],
}

/** 开场推荐问题：先取该类型在该语言下的问题，再取该语言的通用问题，最后取英文通用问题 */
export function followUpQuestions(kind: string, locale: string): readonly string[] {
  const byKind = Object.hasOwn(TABLE, kind) ? TABLE[kind as ReadingKind] : undefined
  if (byKind && Object.hasOwn(byKind, locale)) return byKind[locale] as Questions
  return Object.hasOwn(GENERIC, locale) ? (GENERIC[locale] as Questions) : GENERIC_EN
}

/** 供测试遍历全部问题 */
export const FOLLOW_UP_QUESTION_TABLE = TABLE
export const GENERIC_FOLLOW_UP_QUESTIONS = GENERIC
