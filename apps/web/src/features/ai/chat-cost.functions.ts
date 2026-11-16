import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getLocale } from '../../paraglide/runtime.js'
import { withBilling } from '../../server/feature-gates.ts'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { SUBJECT_ID_MAX_LENGTH, SUBJECT_TYPE_PATTERN } from './subjects.ts'

/**
 * 对话输入区的余额与固定前缀长度（adopt-subject-chat-readings design 决策 6）。
 * 数据库逻辑在 chat-cost.server.ts，handler 内动态导入，不进入浏览器 bundle。
 */
export const getChatCostContext = createServerFn({ method: 'GET' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(
    z
      .strictObject({
        slug: z.string().min(1).max(64),
        conversationId: z.uuid().optional(),
        subject: z
          .strictObject({
            type: z.string().regex(SUBJECT_TYPE_PATTERN),
            id: z.string().min(1).max(SUBJECT_ID_MAX_LENGTH),
          })
          .optional(),
        token: z.string().min(1).max(1024).optional(),
      })
      .refine((data) => !data.subject || !data.token, {
        message: 'Subject and token are mutually exclusive',
      }),
  )
  .handler(async ({ context, data }) => {
    const { chatCostContext } = await import('./chat-cost.server.ts')
    const runtime = data.token && !data.conversationId ? getWebRuntime() : undefined
    return chatCostContext(
      context.db,
      {
        workspaceId: context.workspace.id,
        userId: context.user.id,
        conversationId: data.conversationId,
        subject: data.subject,
        token: data.token,
        locale: getLocale(),
      },
      runtime ? { secret: runtime.config.BETTER_AUTH_SECRET, cache: runtime.cache } : undefined,
    )
  })
