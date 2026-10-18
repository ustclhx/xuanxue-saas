import { randomBytes } from 'node:crypto'
import type { SiteId } from '@xuanxue/config'
import templateConfig from '../../../template.config.ts'

// 只写入本地 preview 的 .dev.vars，部署产物的公开 vars 不含此值。
export const prerenderToken = randomBytes(32).toString('hex')
export const siteOrigins: Record<SiteId, string> = {
  east: new URL(process.env.EAST_URL ?? `https://${templateConfig.sites.east.hosts[0]}`).origin,
  west: new URL(
    process.env.WEST_URL ?? process.env.APP_URL ?? `https://${templateConfig.sites.west.hosts[0]}`,
  ).origin,
}
