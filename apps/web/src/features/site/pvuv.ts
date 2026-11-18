import type { SiteId } from '@xuanxue/config'
import { APP_AREA_PREFIXES, isAppAreaPath } from '../i18n/app-area.ts'
import type { ResolvedSite } from './site.ts'

/**
 * pvuv.ai 站点统计（项目自有，不在模板 analytics/head.ts 内改动）：两站在 pvuv 后台是两个独立 site，
 * 各用自己的公开 site id；某站置空串即不输出脚本。
 */
export const PVUV_SITE_IDS: Readonly<Record<SiteId, string>> = {
  west: '9WXDSwET',
  east: 'jphDLWjj',
}

/** CSP 放行的脚本来源与上报端点（security-headers.ts 引用） */
export const PVUV_SCRIPT_ORIGIN = 'https://www.pvuv.ai'
export const PVUV_API_ORIGIN = 'https://in.pvuv.ai'

/**
 * 脚本在根 head 中、默认监听 pushState：从公开页客户端跳进应用区后脚本仍在运行，
 * 用 f.js 的 data-exclude（逗号分隔、`*` 通配、整段路径匹配）让应用区、后台与接口路径不上报。
 * 前缀与 `/前缀/*` 分开写，避免 `/app*` 误伤 `/apple` 这类公开路径。
 */
export const PVUV_EXCLUDE = APP_AREA_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/*`]).join(',')

/**
 * 与 Cloudflare Web Analytics 同范围（features/analytics/head.ts）：只在已登记站点的公开页面输出，
 * 应用区、后台、接口与未登记 Host（workers.dev 预览、localhost）不输出，预览流量不混入正式站点。
 */
export function pvuvHeadScripts(
  pathname: string,
  site: ResolvedSite,
  ids: Readonly<Record<SiteId, string>> = PVUV_SITE_IDS,
) {
  const id = ids[site.id].trim()
  if (!site.known || !id || isAppAreaPath(pathname)) return []
  return [
    {
      src: `${PVUV_SCRIPT_ORIGIN}/f.js`,
      defer: true,
      'data-site': id,
      'data-api': PVUV_API_ORIGIN,
      'data-exclude': PVUV_EXCLUDE,
    },
  ]
}
