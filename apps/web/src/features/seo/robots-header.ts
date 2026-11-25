import { templateConfig } from '../../server/template-config.ts'
import { isAuthPagePath } from '../i18n/auth-locale.ts'
import { AUTH_ROBOTS } from './metadata.ts'

/**
 * 分享结果链接（`?r=`）与认证页（含 `?redirect=` 变体与各语言前缀）不进索引；robots.txt 不禁止抓取认证页，
 * 爬虫才能读到 noindex（specs/seo「认证页不进索引」）。动态响应（server.ts）与项目闸门返回的
 * 预渲染页 / 跳转（server/project-gate.ts）共用，返回应设置的 X-Robots-Tag，不需要时为 null。
 */
export function responseRobotsTag(requestUrl: string): string | null {
  const url = new URL(requestUrl)
  return url.searchParams.has('r') || isAuthPagePath(url.pathname, templateConfig.i18n.locales)
    ? AUTH_ROBOTS
    : null
}
