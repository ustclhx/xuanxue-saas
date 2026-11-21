import { SITE_IDS, type SiteId } from '@xuanxue/config'
// 只引用类型：site/site.ts 引用本模块（siteServesLocale），本模块不能反向引用其运行时代码
import type { SitesConfig } from '../site/site.ts'

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

const RELEASE_TABLE: ReleaseTable = {
  east: {
    'zh-Hant': 'released',
    'zh-Hans': 'released',
    ko: 'released',
    // 第一期（add-locales-eu-ja 第 4 组），2026-11-21 发布
    ja: 'released',
    // 东方站根路径英文页面（5b：`/bazi-calculator`、`/tarot-spreads` 等，无前缀），2026-11-21 发布：
    // `/` 为英文落地页（features/east-en）；八字 / 紫微英文详批另由 READING_EVAL_PENDING 控制
    en: 'released',
  },
  west: {
    en: 'released',
    // 第一期（第 5 组），2026-11-21 发布
    es: 'released',
    // 第二、三期的 pt-BR、fr、de、it 写入配置前不必登记：未登记按 pending 处理（rollout.test.ts 要求写入配置时登记）
  },
}

// 本地「模拟发布」（项目扩展，5b.4 验收用）：构建时设置 LOCALE_RELEASE_PREVIEW=east:en（逗号分隔的「站点:语言」），
// 由 scripts/vite-shared.ts 校验后以 [站点, 语言] 数组注入；只用于本地构建后跑 check:links、audit:seo、
// check:i18n-seo 与 e2e，部署构建（设置了 CLOUDFLARE_ENV）拒绝该变量。未注入时（单元测试、Node 脚本）为空。
declare const __LOCALE_RELEASE_PREVIEW__: readonly (readonly [SiteId, string])[] | undefined

export type ReleasePreview = readonly (readonly [SiteId, string])[]

/** 解析 LOCALE_RELEASE_PREVIEW（构建配置中调用）；格式错误或站点未知时抛错，避免静默失效 */
export function parseReleasePreview(spec: string): ReleasePreview {
  return spec
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [site, locale] = entry.split(':')
      if ((site !== 'east' && site !== 'west') || !locale)
        throw new Error(`LOCALE_RELEASE_PREVIEW：无法解析「${entry}」，应为 <east|west>:<语言>`)
      return [site, locale] as const
    })
}

/** 把模拟发布的「站点 × 语言」视为已发布 */
export function applyReleasePreview(table: ReleaseTable, preview: ReleasePreview): ReleaseTable {
  if (preview.length === 0) return table
  const next = { east: { ...table.east }, west: { ...table.west } }
  for (const [site, locale] of preview) next[site][locale] = 'released'
  return next
}

export const LOCALE_RELEASE: ReleaseTable = applyReleasePreview(
  RELEASE_TABLE,
  typeof __LOCALE_RELEASE_PREVIEW__ === 'undefined' ? [] : __LOCALE_RELEASE_PREVIEW__,
)

/**
 * 严格文案语言（决策 5「严格文案」）：v1 之后新增的语言。公开页面、认证、账户、计费与邮件相关的功能文件
 * 缺键时构建失败，不回退到英文（scripts/i18n-project.ts 的 strict 选项）。
 */
export const STRICT_MESSAGE_LOCALES: readonly string[] = ['ja', 'es', 'pt-BR', 'fr', 'de', 'it']

/** 严格语言中仍允许回退到默认语言的功能文件：后台与 UI 预览页 */
export const LENIENT_MESSAGE_FEATURES: readonly RegExp[] = [/^admin(-|$)/, /^ui-preview(-|$)/]

/**
 * 按语言额外允许回退的功能文件：该语言所属站点本期不提供的工具（design 决策 4：`ja` 第一期没有每日运势与数字命理）。
 * 这些文案不翻译，客户端也就不必为每条文案加按语言拆分的查表（首页包预算，决策 11）。
 * 该语言之后提供这些工具时，从这里删除并补齐文案（严格检查随之生效）。
 */
export const LOCALE_LENIENT_MESSAGE_FEATURES: Readonly<Record<string, readonly RegExp[]>> = {
  ja: [/^daily$/, /^numerology(-|$)/, /^chart-numerology$/],
  // 西方站没有八字与紫微：这些文案只为东方站根路径英文提供了 en（5b），es 不翻译
  es: [/^bazi$/, /^chart-bazi$/, /^chart-ziwei$/],
}

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

/** 正式域名所属的站点；不是正式域名时为 undefined */
function productionSite(host: string, config: SitesConfig): SiteId | undefined {
  const hostname = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return SITE_IDS.find((id) => config.sites[id].hosts.includes(hostname))
}

/** 正式域名：站点注册表中的 host（不含本地 `<站点>.localhost` 与预览地址） */
export function isProductionHost(host: string, config: SitesConfig): boolean {
  return productionSite(host, config) !== undefined
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
  const site = productionSite(host, config)
  if (!site) return true
  return releaseState(site, locale, table) === 'released'
}
