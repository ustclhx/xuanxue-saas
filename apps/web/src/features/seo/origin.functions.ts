import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { log } from '@xuanxue/shared/log'
import { templateConfig } from '../../server/template-config.ts'
import { getImpersonation } from '../admin/impersonation.functions.ts'
import { prefixLocale } from '../i18n/url-prefix.ts'
import { resolveSite } from '../site/site.ts'
import { localeOrigin, seoSiteOrigin } from './origins.ts'

export const getSeoOrigin = createServerFn({ method: 'GET' }).handler(() => {
  const url = new URL(getRequest().url)
  const site = resolveSite(url.host, templateConfig)
  // 已登记的站点只提供本站语言（东方站 `/en` 入口页也属于东方站，D5）；预览地址按语言归属
  if (site.known) return seoSiteOrigin(site.id)
  const locale = prefixLocale(url.pathname, templateConfig.i18n.locales)
  return locale ? localeOrigin(locale) : seoSiteOrigin(site.id)
})

/** 根布局中的会话装饰读取失败不能阻断公开页（无数据库预渲染）。 */
export const getSafeImpersonation = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    return await getImpersonation()
  } catch (error) {
    log.warn('site.impersonation_read_failed', { error })
    return null
  }
})
