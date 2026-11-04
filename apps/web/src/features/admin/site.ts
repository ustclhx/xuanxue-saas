import { type SiteId, siteBrandName } from '@xuanxue/config'
import { AppError } from '@xuanxue/shared'
import { templateConfig } from '../../server/template-config.ts'

/**
 * 后台按站点（openspec split-site-accounts 决策 7、D4）：
 * - 用户、空间与审计列表默认只列当前站点（按请求 Host 解析，见 admin.functions.ts）；
 *   search 中 `site=all` 切到「全部站点」，这是后台唯一允许跨站读取的入口，只读。
 * - 写操作（封禁、模拟登录、调整积分、恢复空间）只接受当前站点的记录，
 *   另一站的记录须到该站后台操作。
 */

export const ADMIN_ALL_SITES = 'all'

/** 列表筛选的站点：`all` 返回 null（不限站点），其余取值一律按当前站点，客户端不能指定另一站 */
export function adminSiteFilter(value: string | undefined, current: SiteId): SiteId | null {
  return value === ADMIN_ALL_SITES ? null : current
}

export const ADMIN_OTHER_SITE = 'ADMIN_OTHER_SITE'

/** 写操作的站点校验：记录属于另一站时拒绝，提示到记录所在站点的后台操作 */
export function assertAdminSite(recordSite: SiteId, current: SiteId): void {
  if (recordSite !== current)
    throw new AppError(
      ADMIN_OTHER_SITE,
      `This record belongs to the ${templateConfig.sites[recordSite].brand.name} site; manage it from that site's admin`,
      { status: 403, details: { site: recordSite } },
    )
}

/** 站点列与筛选项显示的品牌名（传入后台当前语言） */
export function adminSiteLabel(site: SiteId, locale: string): string {
  return siteBrandName(templateConfig, site, locale)
}
