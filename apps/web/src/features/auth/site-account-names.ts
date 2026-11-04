import { type SiteId, siteBrandName } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'

/** 本站与另一站的品牌显示名（两站账户分开的提示与 FAQ，openspec split-site-accounts D3） */
export function siteAccountNames(site: SiteId, locale: string) {
  return {
    site: siteBrandName(templateConfig, site, locale),
    otherSite: siteBrandName(templateConfig, site === 'east' ? 'west' : 'east', locale),
  }
}
