import { useLocation } from '@tanstack/react-router'
import { getLocale, type Locale, locales, localizeHref } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import type { PageAlternates } from '../seo/alternates.ts'
import { useSiteId } from '../site/context.tsx'
import { EAST_ENGLISH_LOCALE } from '../site/site.ts'
import { LOCALE_AUTONYMS } from '../site/theme.ts'
import { toolHref } from '../tools/tool-href.ts'
import { isAppAreaPath } from './app-area.ts'
import { isAuthPagePath } from './auth-locale.ts'
import { usePageAlternates } from './page-alternates.ts'
import { releasedSiteLocales } from './rollout.ts'
import { localePrefix, prefixLocale } from './url-prefix.ts'

/**
 * 语言控件的链接（多语言 SEO 规范 ML-08：语言切换器用普通 `<a>` 链接，不用 JS 事件；模板 0.8.0 LanguageMenu）。
 * 语言只由地址决定：每一项是指向该语言对应页面的 `<a href hreflang lang>`，不写 Cookie、不用脚本导航，
 * 关闭脚本也能切换。
 */
export interface LanguageLink {
  locale: string
  /** 语言自己的写法（繁體中文、한국어） */
  label: string
  href: string
  current: boolean
}

/**
 * 某语言项的地址（纯函数，便于测试）：
 * 1. 本页 hreflang 中有该语言：用声明的地址（与 `<head>` 同一份数据，工具页各语言路径不同也由它给出）；
 * 2. 认证页（没有 hreflang，但本站每种语言都有）：同一页面换语言前缀，保留查询参数（登录后的返回地址）；
 * 3. 其余（该页没有这种语言的版本、应用区、404）：该语言的首页。
 * 当前语言一项指向当前页自身。
 * 与模板的差别：模板只列本页真实存在的语言，这里列出本站全部已发布语言，没有对应页面时去该语言首页
 * （使用者 2026-11-21）。
 */
export function languageHref({
  target,
  locale,
  pathname,
  publicPath,
  search = '',
  alternates,
  siteLocales,
}: {
  target: string
  /** 当前页面语言 */
  locale: string
  /** 路由器内的路径（已去掉语言前缀） */
  pathname: string
  /** 浏览器地址栏中的路径（含语言前缀） */
  publicPath: string
  /** 查询串（含 `?`），只用于认证页 */
  search?: string
  alternates: PageAlternates
  /** 本站已发布、有完整页面的语言（不含东方站只有首页的 English） */
  siteLocales: readonly string[]
}): string {
  const declared = alternates?.get(target)
  if (declared !== undefined) return declared
  const auth = !isAppAreaPath(pathname) && isAuthPagePath(pathname, locales)
  if (target === locale) return auth ? `${publicPath}${search}` : publicPath
  if (auth && siteLocales.includes(target)) {
    const prefixed = prefixLocale(pathname, locales)
    const path = prefixed ? pathname.slice(localePrefix(prefixed).length) || '/' : pathname
    return localizeHref(`${path}${search}`, { locale: target as Locale })
  }
  return toolHref('/', target)
}

/**
 * 当前站点语言控件的各项：只列本站已发布的语言（rollout.ts，openspec add-locales-eu-ja 决策 5），
 * 西方站只有英语时为空（不显示控件）。`englishEntry`：东方站另列 English，指向东方站英文首页 `/`
 * （不跳到西方站）；东方站完整英文页面发布后它已在站点语言中，不重复列出。
 */
export function useLanguageLinks({ englishEntry = false } = {}): LanguageLink[] {
  const siteId = useSiteId()
  const locale = getLocale()
  const alternates = usePageAlternates()
  const pathname = useLocation({ select: (location) => location.pathname })
  const publicHref = useLocation({ select: (location) => location.publicHref })
  const search = useLocation({ select: (location) => location.searchStr })
  if (!templateConfig.i18n.enabled) return []
  const siteLocales: readonly string[] = releasedSiteLocales(siteId, templateConfig)
  const listed =
    englishEntry &&
    siteId === 'east' &&
    locales.some((item) => item === EAST_ENGLISH_LOCALE) &&
    !siteLocales.includes(EAST_ENGLISH_LOCALE)
      ? [...siteLocales, EAST_ENGLISH_LOCALE]
      : siteLocales
  if (listed.length < 2) return []
  const publicPath = (publicHref ?? pathname).replace(/[?#].*$/, '')
  return listed.map((target) => ({
    locale: target,
    label: LOCALE_AUTONYMS[target] ?? target,
    href: languageHref({
      target,
      locale,
      pathname,
      publicPath,
      search: search ?? '',
      alternates,
      siteLocales,
    }),
    current: target === locale,
  }))
}
