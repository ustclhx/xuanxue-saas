import { type SiteId, siteBrandName } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH, resolveSite, siteOfLocale } from '../site/site.ts'
import type { ProjectShareCardSite, ShareCardSiteContext } from './site.ts'
import type { ShareCardTheme } from './types.ts'

// 项目自有：模板只创建本文件，之后不再修改。
// 一次部署服务多个品牌域名时，按请求 host（构建期默认分享图按页面 locale / pathname）返回该站点的
// 主题、品牌、规范域名与副标题覆盖；返回 undefined 时与单站点相同。说明见 docs/share-cards.md 第 6.1 节。

/**
 * 两站分享卡片配色，取值对应 styles/brand.css 中 `:root[data-site]` 的站点 token（服务端渲染无法读取 CSS 变量）：
 * background ← --bg，foreground ← --ink，muted / secondary ← --surface-2，mutedForeground ← --ink-subtle，
 * primary / brandAccent ← --accent，primaryText ← --accent-ink，primaryForeground ← --on-accent，border ← --line。
 * 东方站取浅色（2026-11-14 主底改为纯白），西方站本身为深色。
 */
const SITE_THEMES: Readonly<Record<SiteId, Partial<ShareCardTheme>>> = {
  east: {
    background: '#ffffff',
    foreground: '#1f1c18',
    muted: '#f5f2ec',
    mutedForeground: '#6b6355',
    secondary: '#f5f2ec',
    primary: '#b8432f',
    primaryText: '#9e3a27',
    primaryForeground: '#fffdf8',
    brandAccent: '#b8432f',
    border: '#dcd3c1',
  },
  west: {
    background: '#11162a',
    foreground: '#ece7da',
    muted: '#151b33',
    mutedForeground: '#b9b5aa',
    secondary: '#151b33',
    primary: '#e3c36f',
    primaryText: '#e3c36f',
    primaryForeground: '#11162a',
    brandAccent: '#e3c36f',
    border: '#2a3150',
  },
}

/** 东方站英文入口页（D5）的副标题；入口页语言 en 归西方站，首页 SEO 标题是西方站文案 */
const EAST_ENGLISH_TAGLINE = 'English guide'
/**
 * 韩语副标题用短文案（2026-11-14 使用者确认「用短标题」）：模板 0.4.1 对谚文的字宽测量偏小，
 * 默认副标题「무료 만세력·사주·타로」行尾会被裁掉；模板 0.5.0 修复渲染器后可再评估是否恢复。
 */
const KOREAN_TAGLINE = '무료 만세력'

/**
 * 站点识别：构建期默认分享图有页面语言，按语言所属站点（东方站英文入口页按路径）；
 * 运行时卡片只有请求 host，与 theme/html-attributes.ts 同一规则（features/site/site.ts 的 resolveSite），
 * www 变体映射到同站，未登记的 Host（预览、workers.dev）按西方站处理。
 */
function siteOf(context: ShareCardSiteContext): SiteId {
  if (context.locale === EAST_ENGLISH_LOCALE && context.pathname === EAST_ENGLISH_PATH)
    return 'east'
  const byLocale = context.locale ? siteOfLocale(context.locale, templateConfig) : undefined
  if (byLocale) return byLocale
  return resolveSite((context.host ?? '').replace(/^www\./i, ''), templateConfig).id
}

/** 站点的规范域名（裸主机名）：og:url / og:image 使用它，总是返回，避免落到 APP_URL 的站点 */
function canonicalHost(site: SiteId): string {
  return templateConfig.sites[site].hosts[0] ?? new URL(templateConfig.app.url).host
}

export function resolveProjectShareCardSite(
  context: ShareCardSiteContext,
): ProjectShareCardSite | undefined {
  const site = siteOf(context)
  const eastEnglish = site === 'east' && context.locale === EAST_ENGLISH_LOCALE
  // 品牌名按语言（东方站 zh-Hant / zh-Hans「干支日」、ko「간지데이」，英文入口页 Ganjiday）；
  // 运行时没有语言时取站点导航默认语言（东方站为繁体中文）
  const locale = context.locale ?? templateConfig.sites[site].locales[0]
  return {
    theme: SITE_THEMES[site],
    brand: { name: siteBrandName(templateConfig, site, locale) },
    host: canonicalHost(site),
    ...(eastEnglish
      ? { tagline: EAST_ENGLISH_TAGLINE }
      : site === 'east' && locale === 'ko'
        ? { tagline: KOREAN_TAGLINE }
        : {}),
  }
}
