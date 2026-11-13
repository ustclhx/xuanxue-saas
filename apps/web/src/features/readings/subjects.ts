import { type JsonValue, reading, scoped } from '@xuanxue/db'
import { log } from '@xuanxue/shared/log'
import { and, eq, type SQL } from 'drizzle-orm'
import { m } from '../../paraglide/messages.js'
import type { Locale } from '../../paraglide/runtime.js'
import { contextSummary } from '../ai/chat-context-summary.ts'
import type {
  ConversationSubjectProvider,
  ResolvedSubject,
  SubjectSystemContext,
} from '../ai/subjects.ts'
import { readingDefinition } from './catalog.ts'
import { followUpQuestions } from './follow-up-questions.ts'
import { READING_SUBJECT_TYPE } from './subject-type.ts'
import { readingTitle } from './title.ts'

/**
 * 命理对话对象（adopt-subject-chat-readings design 决策 1–3）。注册调用在
 * `features/ai/subject-providers.ts`，这里只放 provider 与上下文构造，避免 ai 目录堆积命理逻辑。
 *
 * - `reading`：付费报告，持久对象；只有报告所属用户、在报告所在空间、报告已就绪时才能解析。
 * - `chart-result`：免费结果，只经临时上下文令牌使用（无 resolve），由结果页入口签发。
 *
 * 两者的上下文都不含出生日期、地点、姓名等原始输入（`reading.input` 不进入上下文）。
 */

export const READING_SUBJECT = READING_SUBJECT_TYPE
export const CHART_RESULT_SUBJECT = 'chart-result'
export const READING_CONTEXT_VERSION = 'reading-v1'
export const CHART_RESULT_CONTEXT_VERSION = 'chart-result-v1'
const TITLE_MAX = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const label = (key: 'reading' | 'result') => (locale: string) => {
  const options = { locale: locale as Locale }
  return key === 'reading'
    ? m.subject_readings_label_reading({}, options)
    : m.subject_readings_label_result({}, options)
}

// 合规边界与旧 `contextSystemText` 一致：仅供反思与娱乐、不预测具体事件、不给专业建议
const COMPLIANCE_LINES = [
  'Interpret it within the tradition for reflection and entertainment only: do not predict specific events, and do not give medical, legal or financial advice.',
  'Reply in the language the user writes in.',
]

/** 免费结果的上下文：说明文字 + `{ kind, result }`（服务端复算结果，模板追加固定头与 JSON） */
export function chartResultContext(kind: string, result: JsonValue): SubjectSystemContext {
  return {
    version: CHART_RESULT_CONTEXT_VERSION,
    text: [
      `The user opened this conversation from a free "${kind}" result on our site.`,
      'Below is the structured result our rules engine computed on the server (it contains no birth date, place or name).',
      'Refer to it — e.g. pillars, elements, palaces, numbers or cards — when it helps answer the question.',
      ...COMPLIANCE_LINES,
    ].join('\n'),
    data: { kind, result },
  }
}

/**
 * 临时上下文页与对话列表的标题：「类型 · 关键结论」，替代旧的摘要卡（design 决策 2、Open Questions 4）。
 * 只取摘要的前两项结论值，不含标签，压缩为一行。
 */
export function chartResultTitle(
  kind: string,
  result: Record<string, JsonValue>,
  locale: string,
): string {
  const values = contextSummary({ kind, result }, locale)
    .slice(0, 2)
    .map((item) => item.value)
  return [readingTitle(kind, locale), ...values].join(' · ').slice(0, TITLE_MAX)
}

/** 报告追问的上下文：说明 + 报告正文；结构化命盘按报告保存的原始输入复算（与生成同一口径） */
export function readingContext(row: {
  kind: string
  locale: string
  input: Record<string, unknown>
  content: string
  createdAt: Date
  engineVersion: string
  promptVersion: string
}): SubjectSystemContext {
  const text = [
    `This conversation is about a paid "${row.kind}" report the user purchased on our site.`,
    'Answer follow-up questions based on the report below and on the structured chart our rules engine recomputed on the server (it contains no birth date, place or name).',
    'Ground every answer in the report and the chart; when the report does not cover something, say so before offering a broader interpretation.',
    ...COMPLIANCE_LINES,
    '',
    '<report>',
    row.content,
    '</report>',
  ].join('\n')
  let chart: JsonValue | null = null
  try {
    const definition = readingDefinition(row.kind, row.locale)
    // 复算结果只含 JSON 值；序列化一次固定为可存储的形态
    if (definition)
      chart = JSON.parse(JSON.stringify(definition.recompute(row.input, row.createdAt).result))
  } catch (error) {
    // 引擎升级后旧输入可能无法复算：报告正文仍是主要依据，只记录类型不记录输入
    log.warn('readings.subject.recompute_failed', { kind: row.kind, error })
  }
  return {
    version: READING_CONTEXT_VERSION,
    text,
    data: {
      kind: row.kind,
      // 引擎与提示词版本便于排查上下文与报告生成时口径的差异
      engineVersion: row.engineVersion,
      promptVersion: row.promptVersion,
      chart,
    },
  }
}

export const readingSubjectProvider: ConversationSubjectProvider = {
  label: label('reading'),
  async resolve(ctx, subjectId): Promise<ResolvedSubject | null> {
    // 非 UUID 的 ID 直接按不存在处理，避免数据库类型转换错误泄露为 500
    if (!UUID.test(subjectId)) return null
    const [row] = await scoped(ctx.db, ctx.workspaceId)
      .select(reading, {
        fields: {
          kind: reading.kind,
          locale: reading.locale,
          input: reading.input,
          content: reading.content,
          modelKey: reading.modelKey,
          engineVersion: reading.engineVersion,
          promptVersion: reading.promptVersion,
          createdAt: reading.createdAt,
        },
        where: and(
          eq(reading.id, subjectId),
          eq(reading.userId, ctx.userId),
          eq(reading.status, 'ready'),
        ) as SQL,
      })
      .limit(1)
    if (!row) return null
    return {
      title: readingTitle(row.kind, row.locale),
      defaultModelKey: row.modelKey,
      // 报告语言即报告所属站点语言，与界面语言无关
      suggestions: followUpQuestions(row.kind, row.locale),
      context: async () => readingContext(row),
    }
  },
}

/** 只经临时上下文令牌使用：无 resolve，持久对象接口一律 404 */
export const chartResultSubjectProvider: ConversationSubjectProvider = {
  label: label('result'),
}
