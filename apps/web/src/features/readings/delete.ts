import {
  aiConversation,
  aiMessage,
  aiMessageFeedback,
  type Database,
  reading,
  scoped,
} from '@xuanxue/db'
import { and, eq, inArray, ne, type SQL } from 'drizzle-orm'
import { READING_SUBJECT_TYPE } from './subject-type.ts'

/**
 * 删除一份报告及其 AI 对话正文（命盘数据与生成内容），与隐私政策「删除单份报告」一致。
 * 生成中的报告不能删除（结算仍在进行）；消息行仍被积分账本引用，只清空正文与会话标题。
 *
 * 报告追问对话（adopt-subject-chat-readings design 决策 8，隐私政策「删除报告会一并清除追问对话」）
 * 在同一事务内处理：清空全部消息正文（含首条 system 消息里的报告上下文）与标题、置为归档，
 * 并删除这些消息上的评分反馈（反馈文字可能引用报告内容）。对话列表另按报告是否存在过滤，
 * 见 conversation-visibility.ts。积分流水不动，便于对账。
 * 返回 false 表示报告不存在或仍在生成。
 */
export async function deleteReadingWithContent(
  db: Database,
  workspaceId: string,
  id: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const s = scoped(tx, workspaceId)
    const [deleted] = await s
      .delete(reading, and(eq(reading.id, id), ne(reading.status, 'generating')) as SQL)
      .returning({ messageId: reading.messageId })
    if (!deleted) return false
    if (deleted.messageId) {
      const [message] = await s
        .select(aiMessage, {
          where: eq(aiMessage.id, deleted.messageId),
          fields: { conversationId: aiMessage.conversationId },
        })
        .limit(1)
      if (message) {
        await s.update(
          aiMessage,
          { parts: [] },
          eq(aiMessage.conversationId, message.conversationId),
        )
        await s.updateById(aiConversation, message.conversationId, { title: '' })
      }
    }
    const followUps = await s
      .update(
        aiConversation,
        { title: '', archived: true },
        and(
          eq(aiConversation.subjectType, READING_SUBJECT_TYPE),
          eq(aiConversation.subjectId, id),
        ) as SQL,
      )
      .returning({ id: aiConversation.id })
    if (followUps.length > 0) {
      const ids = followUps.map((row) => row.id)
      const messageIds = s.select(aiMessage, {
        fields: { id: aiMessage.id },
        where: inArray(aiMessage.conversationId, ids),
      })
      await s.delete(aiMessageFeedback, inArray(aiMessageFeedback.messageId, messageIds))
      await s.update(aiMessage, { parts: [] }, inArray(aiMessage.conversationId, ids))
    }
    return true
  })
}
