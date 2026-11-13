import type { JsonValue } from '@xuanxue/db'
import { m } from '../../paraglide/messages.js'
import type { Locale } from '../../paraglide/runtime.js'
import type { ConversationSubjectProvider, SubjectSystemContext } from '../ai/subjects.ts'
import type { DailyFacts } from './facts.ts'

/**
 * 「把今天带去问 AI」的对话对象（add-birth-profiles-daily-horoscope design D10，tasks 8.3）：
 * 只经模板的临时上下文令牌使用（没有 resolve），上下文只含 `DailyFacts` 推导结果，
 * 不含出生日期、出生地或姓名。注册调用在 `features/ai/subject-providers.ts`。
 */
export const DAILY_SUBJECT = 'daily'
export const DAILY_CONTEXT_VERSION = 'daily-v1'

export const dailySubjectProvider: ConversationSubjectProvider = {
  label: (locale) => m.daily_subject_label({}, { locale: locale as Locale }),
}

export function dailyContext(facts: DailyFacts): SubjectSystemContext {
  return {
    version: DAILY_CONTEXT_VERSION,
    text: [
      "The user opened this conversation from today's daily panel on our site.",
      facts.site === 'east'
        ? "Below are the structured facts our rules engine derived for today: the day pillar, almanac entries (tyme4ts Taboo indices) and day officer, the day stem's ten-god relation to the user's day master, branch relations with the natal branches, and the current decade and year pillars."
        : "Below are the structured facts our rules engine derived for today: the Universal Day number and the user's Personal Year, Month and Day numbers with their reduction steps.",
      'They contain no birth date, birthplace or name. Use them to discuss the day as themes and reflection prompts.',
      'Interpret it within the tradition for reflection and entertainment only: do not predict specific events or dates, and do not give medical, legal or financial advice.',
      'Reply in the language the user writes in.',
    ].join('\n'),
    // DailyFacts 只含字符串、数字、布尔与数组
    data: JSON.parse(JSON.stringify(facts)) as JsonValue,
  }
}

export function dailySuggestions(locale: string): string[] {
  const options = { locale: locale as Locale }
  return [
    m.daily_ai_suggest_1({}, options),
    m.daily_ai_suggest_2({}, options),
    m.daily_ai_suggest_3({}, options),
  ]
}
