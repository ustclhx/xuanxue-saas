import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { plausibleSite } from '@xuanxue/config'
import { log } from '@xuanxue/shared/log'
import { getWebRuntime } from '../../server/runtime.ts'
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

/**
 * 按环境取值：同一套代码在 staging 与生产注入各自的 site，绝不写进构建常量。
 * 多站时预渲染 HTML 被各访问域名共用，只下发映射，由浏览器按 location.hostname 选择 site。
 */
export const getPlausibleSite = createServerFn({ method: 'GET' }).handler(() => {
  const site = plausibleSite(templateConfig.features.analytics, getWebRuntime().config)
  if (!site) return null
  return site.sites
    ? { domain: site.domain, scriptUrl: site.scriptUrl, sites: { ...site.sites } }
    : { domain: site.domain, scriptUrl: site.scriptUrl }
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
