import type { KeyValueStore } from '@xuanxue/platform'
import { m } from '../../paraglide/messages.js'
import type { Locale } from '../../paraglide/runtime.js'
import { issueSubjectContext } from '../ai/subject-context.ts'
import { chartResultChatHref } from '../readings/chart-result-context.ts'
import { formatShortDate, parseDateKey } from './date.ts'
import { type DailyFacts, eastFacts, westFacts } from './facts.ts'
import { DAILY_SUBJECT, dailyContext, dailySuggestions } from './subject.ts'
import type { TodayPanelData } from './today.ts'

/**
 * 面板数据 → 只含推导结果的 DailyFacts。东方站去掉面板为本地重算保留的本命地支以外的一切；
 * 西方站不带出生日期（只有个人年、月、日的数字与步骤）。
 * 独立成文件：subject-context.ts 副作用导入注册文件，注册文件又导入 subject.ts，放在一起会成环。
 */
export function factsOfPanel(panel: Extract<TodayPanelData, { state: 'ok' }>): DailyFacts {
  return panel.site === 'east'
    ? eastFacts(panel.day, panel.personal, panel.background)
    : westFacts(panel.day, panel.personal)
}

export async function issueDailyContext(
  deps: { secret: string; cache: KeyValueStore; now?: number },
  input: {
    userId: string
    workspaceId: string
    slug: string
    locale: string
    panel: Extract<TodayPanelData, { state: 'ok' }>
  },
): Promise<string> {
  const date = parseDateKey(input.panel.date)
  const title = [
    m.daily_subject_label({}, { locale: input.locale as Locale }),
    date ? formatShortDate(date, input.locale) : input.panel.date,
  ].join(' · ')
  const { token } = await issueSubjectContext(deps, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    subjectType: DAILY_SUBJECT,
    context: dailyContext(factsOfPanel(input.panel)),
    title,
    suggestions: dailySuggestions(input.locale),
    returnTo: `/app/${input.slug}`,
  })
  return chartResultChatHref(input.slug, token)
}
