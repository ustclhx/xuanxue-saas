import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { withBilling } from '../../server/feature-gates.ts'
import { withWorkspace } from '../../server/middleware.ts'

/**
 * 对话输入区的余额与固定前缀长度（adopt-subject-chat-readings design 决策 6）。
 * 数据库逻辑在 chat-cost.server.ts，handler 内动态导入，不进入浏览器 bundle。
 */
export const getChatCostContext = createServerFn({ method: 'GET' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(
    z.strictObject({ slug: z.string().min(1).max(64), conversationId: z.uuid().optional() }),
  )
  .handler(async ({ context, data }) => {
    const { chatCostContext } = await import('./chat-cost.server.ts')
    return chatCostContext(context.db, {
      workspaceId: context.workspace.id,
      userId: context.user.id,
      conversationId: data.conversationId,
    })
  })
