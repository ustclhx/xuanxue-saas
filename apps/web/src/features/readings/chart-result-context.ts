import type { JsonValue } from '@xuanxue/db'
import type { KeyValueStore } from '@xuanxue/platform'
import { issueSubjectContext } from '../ai/subject-context.ts'
import { followUpQuestions } from './follow-up-questions.ts'
import { CHART_RESULT_SUBJECT, chartResultContext, chartResultTitle } from './subjects.ts'

/**
 * 为免费结果签发临时上下文令牌（adopt-subject-chat-readings design 决策 2）：结果页入口与旧链接换发共用。
 * 只在服务端调用；`result` 必须是服务端复算的结构化结果（不含出生信息）。
 * 独立成文件：subject-context.ts 副作用导入注册文件，注册文件又导入 subjects.ts，放在 subjects.ts 里会成环。
 */
export function issueChartResultContext(
  deps: { secret: string; cache: KeyValueStore; now?: number },
  input: {
    userId: string
    /** 令牌只能在该空间使用（结果页入口为个人空间） */
    workspaceId: string
    kind: string
    result: Record<string, JsonValue>
    /** 页面语言：标题与开场推荐问题的语言 */
    locale: string
    returnTo: string
  },
): Promise<{ token: string; subjectId: string; expiresAt: number }> {
  return issueSubjectContext(deps, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    subjectType: CHART_RESULT_SUBJECT,
    context: chartResultContext(input.kind, input.result),
    title: chartResultTitle(input.kind, input.result, input.locale),
    suggestions: followUpQuestions(input.kind, input.locale),
    returnTo: input.returnTo,
  })
}

/** 临时上下文对话页地址：只带签名令牌 */
export const chartResultChatHref = (slug: string, token: string) =>
  `/app/${slug}/chat/context?token=${encodeURIComponent(token)}`
