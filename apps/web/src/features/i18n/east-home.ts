import type { SitesConfig } from '../site/site.ts'
import { releasedSiteLocales } from './rollout.ts'

/**
 * 东方站没有语言前缀的地址要落到的语言：东方站第一个已发布语言（繁体中文）。
 * 使用者 2026-11-20 网址规则：语言只由地址决定，不按浏览器语言或 Cookie 自动选择、不自动跳转。
 * 东方站 `/` 是英文首页（site.ts EAST_ENGLISH_URL）；其余没有英文版本的无前缀地址（认证页、旧地址）
 * 固定跳到这个语言，结果与访客无关。浏览器语言只用于客户端的切换提示（locale-prompt.tsx），由访客点击切换。
 */
export function eastDefaultLocale(config: SitesConfig): string {
  return releasedSiteLocales('east', config)[0] ?? config.i18n.defaultLocale
}
