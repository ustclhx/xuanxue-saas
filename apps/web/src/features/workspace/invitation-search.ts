import { compactSearch, optionalUuid } from '../routing/search.ts'

// 路由 validateSearch 会进入水合时立即加载的路由树分包（模板 0.5.6），这里不用 zod；
// optionalUuid 与 z.uuid() 规则一致（模板 0.5.8）。
/** 缺失或损坏的邀请链接应显示无效状态，不能在路由或 RPC 校验时抛出页面错误。 */
export function invitationSearch(search: unknown): { id?: string } {
  const id = typeof search === 'object' && search !== null && 'id' in search ? search.id : undefined
  return compactSearch({ id: optionalUuid(id) })
}
