import { templateConfig } from '../../server/template-config.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { siteOfLocale } from '../site/site.ts'
import { mainToolPath } from './registry.ts'

/** 工具页的站内地址：站点默认语言无前缀，其余语言加小写前缀；中文路径段统一 encodeURI */
export function toolHref(path: string, locale: string): string {
  const site = siteOfLocale(locale, templateConfig)
  const prefix =
    site && templateConfig.sites[site].defaultLocale === locale ? '' : localePrefix(locale)
  // 路由器去掉末尾 `/`（trailingSlash: never）：语言首页写成 `/zh-hant` 而不是 `/zh-hant/`
  if (path === '/') return prefix || '/'
  return `${prefix}${encodeURI(path)}`
}

/**
 * 某语言主工具页（八字排盤 / 만세력 / Life Path Number）的站内地址；该语言没有主工具页时为语言首页。
 * 工具迁出语言首页后（openspec separate-landing-homepage design.md D4、D5），站内「去排盘」链接都用它。
 */
export function mainToolHref(locale: string): string {
  return toolHref(mainToolPath(locale) ?? '/', locale)
}

/**
 * 迁移前保存的返回地址可能是语言首页（当时工具在首页，design.md D4「已存的返回地址」）：
 * 把语言首页映射到该语言的主工具页，其他路径原样返回。只用于显示链接，不改存量记录。
 */
export function legacyToolPath(path: string): string {
  const locale = templateConfig.i18n.locales.find((item) => toolHref('/', item) === path)
  return locale ? mainToolHref(locale) : path
}
