import { SITE_IDS, type SiteId } from '@xuanxue/config'
import { siteOrigin } from '../site/site.ts'
import type { GrowthContext } from './service.ts'

/**
 * 邮件中的链接落在订阅者所在站点：APP_URL 只是西方站，东方站订阅者确认 / 退订后会落到西方站页面。
 * 记录没有站点时取当前请求站点；预览 / 本地等未登记地址保持 APP_URL（siteOrigin 不跨站）。
 */
export function growthLink(
  ctx: Pick<GrowthContext, 'appUrl' | 'config' | 'site'>,
  path: string,
  site?: string | null,
): URL {
  const id = SITE_IDS.includes(site as SiteId) ? (site as SiteId) : ctx.site
  return new URL(path, siteOrigin(id, new URL(ctx.appUrl), ctx.config))
}
