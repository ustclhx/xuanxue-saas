import { SITE_IDS, type SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { APP_AREA_PREFIXES, isAppAreaPath } from '../i18n/app-area.ts'
import type { ResolvedSite, SitesConfig } from './site.ts'

/**
 * pvuv.ai 站点统计（项目自有，不在模板 analytics/head.ts 内改动）：两站在 pvuv 后台是两个独立 site，
 * 各用自己的公开 site id；某站置空串即不加载脚本、不转发事件。
 */
export const PVUV_SITE_IDS: Readonly<Record<SiteId, string>> = {
  west: '9WXDSwET',
  east: 'jphDLWjj',
}

type PvuvIds = Readonly<Record<SiteId, string>>
type HostsConfig = Pick<SitesConfig, 'sites'>

/** CSP 放行的脚本来源与上报端点（security-headers.ts 引用） */
export const PVUV_SCRIPT_ORIGIN = 'https://www.pvuv.ai'
export const PVUV_API_ORIGIN = 'https://in.pvuv.ai'
export const PVUV_SCRIPT_ID = 'xuanxue-pvuv'

/**
 * 脚本默认监听 pushState：从公开页客户端跳进应用区后仍在运行，
 * 用 f.js 的 data-exclude（逗号分隔、`*` 通配、整段路径匹配）让应用区、后台与接口路径不上报页面浏览。
 * 前缀与 `/前缀/*` 分开写，避免 `/app*` 误伤 `/apple` 这类公开路径。
 */
export const PVUV_EXCLUDE = APP_AREA_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/*`]).join(',')

/**
 * 访问域名对应的 pvuv site id：只认注册表中的正式域名。`<站点>.localhost` 虽是已登记站点，
 * 但属本地开发与 e2e，不应向 pvuv 写入流量，因此与 workers.dev 预览一样返回空串。
 */
export function pvuvSiteId(
  hostname: string,
  config: HostsConfig = templateConfig,
  ids: PvuvIds = PVUV_SITE_IDS,
): string {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  const site = SITE_IDS.find((id) => config.sites[id].hosts.includes(host))
  return site ? ids[site].trim() : ''
}

/**
 * 与 Cloudflare Web Analytics 同范围（features/analytics/head.ts）：只在已登记站点的公开页面输出，
 * 应用区、后台、接口与未登记 Host 不输出。预渲染 HTML 也会被 `<站点>.localhost` 访问，
 * 所以输出的是内联加载器：浏览器确认当前域名是本站正式域名后再插入 f.js（f.js 经 currentScript 读取属性）。
 */
export function pvuvHeadScripts(
  pathname: string,
  site: ResolvedSite,
  config: HostsConfig = templateConfig,
  ids: PvuvIds = PVUV_SITE_IDS,
) {
  const id = ids[site.id].trim()
  const hosts = config.sites[site.id].hosts
  if (!site.known || !id || !hosts.length || isAppAreaPath(pathname)) return []
  const attributes = { 'data-site': id, 'data-api': PVUV_API_ORIGIN, 'data-exclude': PVUV_EXCLUDE }
  // 转义 `<` 防止内容提前结束 script；按 id 去重，水合或导航重新插入内联脚本时不重复加载
  const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c')
  return [
    {
      children: `(function(){if(${json(hosts)}.indexOf(location.hostname)<0||document.getElementById(${json(PVUV_SCRIPT_ID)}))return;var s=document.createElement('script'),a=${json(attributes)};s.id=${json(PVUV_SCRIPT_ID)};s.defer=true;s.src=${json(`${PVUV_SCRIPT_ORIGIN}/f.js`)};for(var k in a)s.setAttribute(k,a[k]);document.head.appendChild(s)})()`,
    },
  ]
}

type PvuvQueue = ((...args: unknown[]) => void) & { q?: unknown[][] }

const MAX_QUEUED = 100
// f.js 自行产生或保留的事件名，自定义事件使用时会被忽略
const RESERVED = new Set(['pageview', 'page_view', 'page_leave', 'outbound_click', 'identify'])

/**
 * 把客户端产品事件同步给 pvuv（由 analytics/track.ts 在 DNT / GPC 与提供方门禁之后调用）。
 * 只在 pvuv 会加载的页面发送：正式域名且非应用区路径；f.js 对自定义事件不检查 data-exclude，
 * 这里必须自己挡住应用区。脚本加载前进入 window.pvuv.q，f.js 加载后按序回放；队列限长，
 * 页面未加载 f.js（落地在应用区后客户端跳到公开页）时多余事件丢弃。从不调用 identify，不向第三方发送用户 id。
 */
export function sendPvuvEvent(
  name: string,
  props: object,
  config: HostsConfig = templateConfig,
  ids: PvuvIds = PVUV_SITE_IDS,
) {
  if (typeof window === 'undefined' || RESERVED.has(name)) return
  if (isAppAreaPath(window.location.pathname) || !pvuvSiteId(window.location.hostname, config, ids))
    return
  const target = window as Window & { pvuv?: PvuvQueue }
  const pvuv: PvuvQueue =
    target.pvuv ??
    Object.assign(
      (...args: unknown[]) => {
        pvuv.q = pvuv.q ?? []
        if (pvuv.q.length < MAX_QUEUED) pvuv.q.push(args)
      },
      { q: [] as unknown[][] },
    )
  target.pvuv = pvuv
  pvuv('event', name.slice(0, 64), { ...props })
}
