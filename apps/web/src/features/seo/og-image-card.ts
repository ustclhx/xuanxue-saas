import type { SiteId } from '@xuanxue/config'
import type { JSX } from 'react'
import { templateConfig } from '../../server/template-config.ts'
import { shareCardLayout } from '../share-cards/layout.tsx'
import { siteShareCardThemes } from '../share-cards/share-cards.theme.ts'
import { resolveShareCardTheme } from '../share-cards/theme.ts'
import { siteOfLocale } from '../site/site.ts'
import { pageBrand, type SeoPage } from './metadata.ts'

/**
 * 构建期默认分享图（dist/client/og/）：模板 0.4.0 默认版式（`hero` 大标题）按页面所属站点
 * 换用站点品牌、规范域名与配色。不显示模板默认的「· AI workspace」元信息行。
 * 品牌与域名经 layout.tsx 的可选 brand / host 传入（待模板 0.4.1 提供多站点扩展点后迁移）。
 */
export interface OgImageCard {
  readonly title: string
  readonly site: SiteId
  readonly brand: string
  readonly host: string
}

function siteHost(site: SiteId): string {
  return templateConfig.sites[site].hosts[0] ?? new URL(templateConfig.app.url).hostname
}

/** 页面所属站点；不属于任何站点的语言归西方站（与 app 默认品牌一致） */
export function ogImageCard(page: Pick<SeoPage, 'title' | 'locale'>): OgImageCard {
  const site = siteOfLocale(page.locale, templateConfig) ?? 'west'
  return { title: page.title, site, brand: pageBrand(page), host: siteHost(site) }
}

/** 东方站英文入口页（D5）：语言 en 归西方站，品牌、域名与配色按东方站单独给出 */
export function eastEnglishOgImageCard(title: string): OgImageCard {
  return {
    title,
    site: 'east',
    brand: templateConfig.sites.east.brand.name,
    host: siteHost('east'),
  }
}

export function ogImageCardLayout(card: OgImageCard): JSX.Element {
  return shareCardLayout(
    { title: card.title, size: 'hero', brand: card.brand, host: card.host },
    { ...resolveShareCardTheme('light'), ...siteShareCardThemes[card.site] },
  )
}
