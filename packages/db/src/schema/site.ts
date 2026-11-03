import { sql } from 'drizzle-orm'
import { type AnyPgColumn, check, text } from 'drizzle-orm/pg-core'

// 不经 schema/index.ts 导出：drizzle 与 Better Auth 按导出值识别表，只放列与约束的构造函数。

/** 账户所属站点；与 `@xuanxue/config` 的 SITE_IDS 一致（db 不依赖 config，这里单独声明） */
export type AccountSite = 'east' | 'west'

/** 站点列：not null，取值由 check 约束限定；不设默认值，漏写站点的插入直接失败而不是落到某一站 */
export const siteColumn = () => text('site').$type<AccountSite>().notNull()
export const siteCheck = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} in ('east', 'west')`)
