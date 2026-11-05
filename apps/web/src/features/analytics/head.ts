import type { TemplateConfig } from '@xuanxue/config'
import { isAppAreaPath } from '../i18n/app-area.ts'
import type { ResolvedSite } from '../site/site.ts'

const NOT_TRACKED = /^\/(?:admin|api)(?:\/|$)/

/** 多站内联配置的元素 id：track.ts 读取它选择 site，发布门禁 check-site-isolation 也按它校验。 */
export const PLAUSIBLE_CONFIG_ID = 'xuanxue-plausible'

export interface MultiSiteConfig {
  readonly sites: Readonly<Record<string, string>>
  /** 未登记访问域名的兜底 site，空串表示不统计 */
  readonly fallback: string
  readonly scriptUrl: string
}

function plausibleScript(plausible: {
  domain: string
  scriptUrl: string
  sites?: Readonly<Record<string, string>> | undefined
}) {
  if (!plausible.sites)
    return { src: plausible.scriptUrl, defer: true, 'data-domain': plausible.domain }
  // 预渲染 HTML 被所有访问域名共用，构建时不知道访客从哪个域名进来：只输出不执行的 JSON，
  // 由浏览器按 location.hostname 选择 site 后再插入脚本。转义 `<` 防止内容提前结束 script。
  const config: MultiSiteConfig = {
    sites: plausible.sites,
    fallback: plausible.domain,
    scriptUrl: plausible.scriptUrl,
  }
  return {
    type: 'application/json',
    id: PLAUSIBLE_CONFIG_ID,
    children: JSON.stringify(config).replaceAll('<', '\\u003c'),
  }
}

/**
 * Cloudflare Web Analytics 只放在公开页面；按站点使用各自的公开 token，未配置时不输出脚本。
 * 未登记的 Host（workers.dev 预览）不统计，避免预览流量混入正式站点。
 * Plausible 负责产品漏斗，应用区也要加载，但不进入后台与接口路径；多站时由映射按访问域名选择 site。
 */
export function analyticsHeadScripts(
  pathname: string,
  site: ResolvedSite,
  config: TemplateConfig,
  plausible?: {
    domain: string
    scriptUrl: string
    sites?: Readonly<Record<string, string>> | undefined
  } | null,
) {
  const token = (config.sites[site.id].analyticsToken ?? config.analytics.cloudflareToken).trim()
  return [
    ...(plausible && !NOT_TRACKED.test(pathname) ? [plausibleScript(plausible)] : []),
    ...(!site.known || isAppAreaPath(pathname) || !token
      ? []
      : [
          {
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            defer: true,
            // 自动 SPA 监听会跨到后台路径；这里只统计公开页面的文档加载。
            'data-cf-beacon': JSON.stringify({ token, spa: false }),
          },
        ]),
  ]
}
