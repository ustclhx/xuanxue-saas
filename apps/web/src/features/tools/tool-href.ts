import { templateConfig } from '../../server/template-config.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { siteOfLocale } from '../site/site.ts'

/** 工具页的站内地址：站点默认语言无前缀，其余语言加小写前缀；中文路径段统一 encodeURI */
export function toolHref(path: string, locale: string): string {
  const site = siteOfLocale(locale, templateConfig)
  const prefix =
    site && templateConfig.sites[site].defaultLocale === locale ? '' : localePrefix(locale)
  // 路由器去掉末尾 `/`（trailingSlash: never）：语言首页写成 `/zh-hant` 而不是 `/zh-hant/`
  if (path === '/') return prefix || '/'
  return `${prefix}${encodeURI(path)}`
}
