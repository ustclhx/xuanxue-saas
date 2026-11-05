import type { SiteId } from '@xuanxue/config'
import type { DataTableFilter } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { ADMIN_ALL_SITES, adminSiteLabel } from './site.ts'

// 后台列表与详情页的站点展示（split-site-accounts 决策 7、D4），逻辑见 site.ts。

export const siteLabel = (site: SiteId | null | undefined) =>
  site ? adminSiteLabel(site, getLocale()) : '—'

/** 「当前站点 / 全部站点」筛选：空值为当前站点（默认），`all` 为只读的全部站点视图 */
export function siteFilter(current: SiteId): DataTableFilter {
  return {
    id: 'site',
    label: m.admin_site(),
    type: 'select',
    options: [
      { value: '', label: m.admin_site_filter_current({ site: siteLabel(current) }) },
      { value: ADMIN_ALL_SITES, label: m.admin_site_filter_all() },
    ],
  }
}

/** 全部站点视图的提示：另一站的记录只读 */
export function AllSitesNotice({ site }: { site: string | undefined }) {
  if (site !== ADMIN_ALL_SITES) return null
  return <p className="text-muted-foreground text-sm">{m.admin_all_sites_read_only()}</p>
}

/** 详情页：记录属于另一站时说明只读，写操作须到该站后台 */
export function OtherSiteNotice({ site }: { site: SiteId }) {
  return (
    <p role="note" className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
      {m.admin_other_site_record({ site: siteLabel(site) })}
    </p>
  )
}
