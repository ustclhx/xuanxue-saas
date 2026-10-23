import { Link, useLocation } from '@tanstack/react-router'
import { siteBrandName } from '@xuanxue/config'
import { Button } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { SiteLogo } from '../site/brand.tsx'
import { useSiteId } from '../site/context.tsx'
import { LOCALE_AUTONYMS } from '../site/theme.ts'
import { toolsForLocale } from '../tools/registry.ts'
import { toolHref } from '../tools/tool-href.ts'
import { site } from './site.ts'

// 视觉规范：可点元素 ≥44px；当前页用品牌色下划线标记
const navLink =
  'inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent text-ink-muted text-[15px] transition-colors hover:text-ink aria-[current=page]:border-brand aria-[current=page]:text-ink'

/** 站点页头：品牌（按站点）、工具导航（工具注册表）、同站其他语言入口与账户入口 */
export function SiteHeader() {
  const siteId = useSiteId()
  const locale = getLocale()
  const pathname = useLocation({ select: (location) => location.pathname })
  // 东方站无前缀入口用 en 渲染壳，但没有英语工具或无前缀营销页；沿用语言入口，避免串到西方导航。
  const isLanguageEntry = siteId === 'east' && !templateConfig.sites.east.locales.includes(locale)
  const tools = isLanguageEntry ? [] : toolsForLocale(locale)
  const otherLocales = templateConfig.sites[siteId].locales.filter((item) => item !== locale)
  return (
    <header className="border-line border-b bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3"
      >
        {m.site_skip_to_content()}
      </a>
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Link to="/" className="flex min-h-11 items-center gap-2.5 text-ink">
          <SiteLogo site={siteId} />
          <span className="font-bold font-heading text-xl tracking-wide">
            {siteBrandName(templateConfig, siteId, locale)}
          </span>
        </Link>
        <nav
          aria-label={m.site_nav_tools()}
          className="order-last flex basis-full flex-wrap items-center gap-x-5 sm:order-none sm:flex-1 sm:basis-auto sm:justify-end"
        >
          {tools.map((tool) => (
            <a
              key={tool.id}
              href={toolHref(tool.path, locale)}
              className={navLink}
              aria-current={pathname === tool.path ? 'page' : undefined}
            >
              {tool.title}
            </a>
          ))}
          {!isLanguageEntry && templateConfig.billing.enabled && (
            <Link to="/pricing" className={navLink} activeProps={{ 'aria-current': 'page' }}>
              {m.marketing_nav_pricing()}
            </Link>
          )}
          {!isLanguageEntry && site.blog && (
            <Link to="/blog" className={navLink}>
              {m.marketing_nav_blog()}
            </Link>
          )}
          {!isLanguageEntry && site.docs && (
            <Link to="/docs" className={navLink}>
              {m.marketing_nav_docs()}
            </Link>
          )}
          {otherLocales.map((item) => (
            <a
              key={item}
              href={`${localePrefix(item)}/`}
              hrefLang={item}
              lang={item}
              className={navLink}
            >
              {LOCALE_AUTONYMS[item] ?? item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="min-h-11">
            <Link to="/login">{m.marketing_nav_sign_in()}</Link>
          </Button>
          <Button asChild className="min-h-11">
            <Link to="/register">{m.marketing_nav_get_started()}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
