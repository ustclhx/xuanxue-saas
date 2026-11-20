import { SITE_IDS, type SiteId } from '@xuanxue/config'
import { resolveSite, type SitesConfig } from '../site/site.ts'

/**
 * 语言的分期发布状态（openspec add-locales-eu-ja design 决策 5，specs/localized-content-quality「语言发布状态」）。
 * 本文件归项目所有（不是模板文件），template-sync 不覆盖。纯数据与纯函数，vite 配置、构建脚本与客户端都可引用。
 *
 * - 发布状态按「站点 × 语言」登记：同一语言可以在两个站点各有一套页面（如西方站根路径的 `en` 与东方站 `/en/…`），
 *   两站各自发布，互不影响（使用者 2026-11-20：东方站补完整英文页面）。
 * - `released`：正式域名可访问，进入站点地图、hreflang、语言菜单、语言建议、`llms.txt` 与东方站根路径跳转。
 * - `pending`：只在未登记为正式域名的主机（staging / 预览 `*.workers.dev`、本地 `*.localhost`）可访问；
 *   正式域名上返回 404（不跨站跳转），并且不出现在上述任何可发现的位置。
 * - 可发现位置一律只看发布状态、不看请求主机：预渲染的 HTML（hreflang、语言菜单）在构建期生成、同一份文件
 *   在正式域名与 staging 上都会返回，按主机区分会把 pending 语言写进正式站的静态 HTML。
 * - 语言写入 `template.config.ts` 前也可以先登记在这里（pending），加入配置后自动按 pending 处理。
 *   配置中站点的每种语言都必须在这里登记（rollout.test.ts 检查），漏登记的语言按 pending 处理，不会意外上线。
 */
export type ReleaseState = 'released' | 'pending'

export type ReleaseTable = {
  readonly [S in SiteId]: Readonly<Partial<Record<string, ReleaseState>>>
}

export const LOCALE_RELEASE: ReleaseTable = {
  east: {
    'zh-Hant': 'released',
    'zh-Hans': 'released',
    ko: 'released',
    // 第一期（add-locales-eu-ja 第 4 组）
    ja: 'pending',
    // 东方站完整英文页面（`/en/…`）；现有的英文入口页 `/en` 不受此项影响，始终可访问（site.ts EAST_ENGLISH_PATH）
    en: 'pending',
  },
  west: {
    en: 'released',
    // 第一期（第 5 组）
    es: 'pending',
    // 第二、三期的 pt-BR、fr、de、it 写入配置前不必登记：未登记按 pending 处理（rollout.test.ts 要求写入配置时登记）
  },
}

/**
 * 严格文案语言（决策 5「严格文案」）：v1 之后新增的语言。公开页面、认证、账户、计费与邮件相关的功能文件
 * 缺键时构建失败，不回退到英文（scripts/i18n-project.ts 的 strict 选项）。
 */
export const STRICT_MESSAGE_LOCALES: readonly string[] = ['ja', 'es', 'pt-BR', 'fr', 'de', 'it']

/** 严格语言中仍允许回退到默认语言的功能文件：后台与 UI 预览页 */
export const LENIENT_MESSAGE_FEATURES: readonly RegExp[] = [/^admin(-|$)/, /^ui-preview(-|$)/]

/** 语言在某站点上的发布状态；未登记为 pending */
export function releaseState(
  site: SiteId,
  locale: string,
  table: ReleaseTable = LOCALE_RELEASE,
): ReleaseState {
  return table[site][locale] ?? 'pending'
}

/** 站点上已发布的语言（按配置顺序），用于站点地图、hreflang、语言菜单等可发现位置 */
export function releasedSiteLocales<L extends string>(
  site: SiteId,
  config: { readonly sites: { readonly [S in SiteId]: { readonly locales: readonly L[] } } },
  table: ReleaseTable = LOCALE_RELEASE,
): L[] {
  return config.sites[site].locales.filter(
    (locale) => releaseState(site, locale, table) === 'released',
  )
}

/**
 * 语言在其所属站点上是否已发布（hreflang 等只知道语言、不知道主机的场景）。
 * 语言属于多个站点时，只要求它所在的任一站点已发布由调用方传 `site` 区分；不属于任何站点时为 false。
 */
export function isLocaleReleased(
  locale: string,
  config: SitesConfig,
  site?: SiteId,
  table: ReleaseTable = LOCALE_RELEASE,
): boolean {
  const sites = site ? [site] : SITE_IDS.filter((id) => config.sites[id].locales.includes(locale))
  return sites.some(
    (id) =>
      config.sites[id].locales.includes(locale) && releaseState(id, locale, table) === 'released',
  )
}

/** 正式域名：站点注册表中的 host（不含本地 `<站点>.localhost` 与预览地址） */
export function isProductionHost(host: string, config: SitesConfig): boolean {
  const hostname = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return SITE_IDS.some((id) => config.sites[id].hosts.includes(hostname))
}

/**
 * 语言在该主机上是否可访问：正式域名只开放所在站点已发布的语言；staging、预览与本地主机全部开放，
 * 供验收未发布语言（这些主机整体 noindex，site/gate.ts）。
 */
export function isLocaleLive(
  locale: string,
  host: string,
  config: SitesConfig,
  table: ReleaseTable = LOCALE_RELEASE,
): boolean {
  if (!isProductionHost(host, config)) return true
  return releaseState(resolveSite(host, config).id, locale, table) === 'released'
}
