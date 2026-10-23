import { z } from 'zod'

/** 缺失或损坏的邀请链接应显示无效状态，不能在路由或 RPC 校验时抛出页面错误。 */
export const invitationSearch = z.object({ id: z.uuid().optional().catch(undefined) }).catch({})
