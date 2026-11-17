import { compactSearch } from '../routing/search.ts'

// 路由 validateSearch 会进入水合时立即加载的路由树分包（模板 0.5.6），这里不用 zod。
// 与此前 z.uuid() 的规则一致：RFC 9562 UUID（版本 1–8、变体 8–b）以及全 0 / 全 f。
const UUID =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/

/** 缺失或损坏的邀请链接应显示无效状态，不能在路由或 RPC 校验时抛出页面错误。 */
export function invitationSearch(search: unknown): { id?: string } {
  const id = typeof search === 'object' && search !== null && 'id' in search ? search.id : undefined
  return compactSearch({ id: typeof id === 'string' && UUID.test(id) ? id : undefined })
}
