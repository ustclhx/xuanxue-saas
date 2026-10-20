import type { DeletionStep } from '@xuanxue/auth'

/**
 * 删除空间（含删除账号时的个人空间）时清除其中的详批与 AI 对话正文（隐私政策「删除」一节的承诺）。
 * 空间本身按模板软删除；消息行仍被积分账本引用，只清空正文与会话标题。
 * 删除账号时另按邮箱删除订阅记录：个人空间 id 即用户 id，且在账号匿名化之前执行，此时 user.email 仍是原邮箱。
 */
export const workspaceContentDeletionStep: DeletionStep = {
  async execute({ actorUserId, workspaceIds }, sql) {
    if (workspaceIds.length === 0) return
    const ids = [...workspaceIds]
    await sql`delete from reading where workspace_id in ${sql(ids)}`
    await sql`update ai_message set parts = '[]'::jsonb where workspace_id in ${sql(ids)}`
    await sql`update ai_conversation set title = '' where workspace_id in ${sql(ids)}`
    if (ids.includes(actorUserId))
      await sql`
        delete from newsletter_subscriber
        where lower(email) = (select lower(email) from "user" where id = ${actorUserId})`
  },
}
