import type { TemplateConfig } from '@xuanxue/config'
import { isAppAreaPath } from '../i18n/app-area.ts'
import type { ResolvedSite } from '../site/site.ts'

/**
 * 无 Cookie 的流量统计只放在公开页面；按站点使用各自的公开 token，未配置时不输出脚本。
 * 未登记的 Host（workers.dev 预览）不统计，避免预览流量混入正式站点。
 */
export function analyticsHeadScripts(pathname: string, site: ResolvedSite, config: TemplateConfig) {
  const token = (config.sites[site.id].analyticsToken ?? config.analytics.cloudflareToken).trim()
  if (!site.known || isAppAreaPath(pathname) || !token) return []
  return [
    {
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      defer: true,
      // 自动 SPA 监听会跨到后台路径；这里只统计公开页面的文档加载。
      'data-cf-beacon': JSON.stringify({ token, spa: false }),
    },
  ]
}
