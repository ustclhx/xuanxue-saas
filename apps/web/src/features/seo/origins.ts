import type { SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { siteOfLocale } from '../site/site.ts'

// Vite 将构建地址同时固化到客户端与 Worker；Node 工具 / 单元测试使用注册表。
declare const __SITE_ORIGINS__: Record<SiteId, string> | undefined

export function seoSiteOrigin(site: SiteId): string {
  return typeof __SITE_ORIGINS__ === 'undefined'
    ? `https://${templateConfig.sites[site].hosts[0]}`
    : __SITE_ORIGINS__[site]
}

export function localeOrigin(locale: string): string {
  return seoSiteOrigin(siteOfLocale(locale, templateConfig) ?? 'west')
}
