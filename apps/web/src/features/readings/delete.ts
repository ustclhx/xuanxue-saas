import { aiConversation, aiMessage, type Database, reading, scoped } from '@xuanxue/db'
import { and, eq, ne, type SQL } from 'drizzle-orm'

/**
 * 删除一份报告及其 AI 对话正文（命盘数据与生成内容），与隐私政策「删除单份报告」一致。
 * 生成中的报告不能删除（结算仍在进行）；消息行仍被积分账本引用，只清空正文与会话标题。
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
    return true
  })
}
