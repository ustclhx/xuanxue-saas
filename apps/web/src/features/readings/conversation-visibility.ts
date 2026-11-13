import { aiConversation, aiMessage, reading } from '@xuanxue/db'
import { and, type SQL, sql } from 'drizzle-orm'
import { READING_SUBJECT_TYPE } from './subject-type.ts'

/**
 * 对话列表（含已归档）中应出现的对话：
 * - 付费详批借用对话消息结算，生成对话不出现在列表中；
 * - 报告追问对话在报告删除后不再出现（design 决策 8；删除时已清空正文并归档，这里兜底按报告是否存在过滤）。
 * subject_id 是文本、reading.id 是 uuid：比较时把 uuid 转为文本，避免把非 uuid 的 subject_id 强转报错。
 */
export const listedConversation = (): SQL =>
  and(
    sql`not exists (select 1 from ${reading} join ${aiMessage} on ${aiMessage.id} = ${reading.messageId} where ${aiMessage.conversationId} = ${aiConversation.id})`,
    sql`(${aiConversation.subjectType} is distinct from ${READING_SUBJECT_TYPE} or exists (select 1 from ${reading} where ${reading.workspaceId} = ${aiConversation.workspaceId} and ${reading.id}::text = ${aiConversation.subjectId}))`,
  ) as SQL
