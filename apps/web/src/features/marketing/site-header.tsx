import { useLocation } from '@tanstack/react-router'
import { siteBrandName } from '@xuanxue/config'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { isAppAreaPath } from '../i18n/app-area.ts'
import { LanguageMenu } from '../i18n/language-controls.tsx'
import { AccountMenu } from '../site/account-menu.tsx'
import { SiteLogo } from '../site/brand.tsx'
import { useSiteId } from '../site/context.tsx'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH, siteNavLocale } from '../site/site.ts'
import { toolsForSite } from '../tools/registry.ts'
import { toolHref } from '../tools/tool-href.ts'
import { blogHasPosts, site, useBlogLocales } from './site.ts'
import { SiteLink } from './site-link.tsx'

// 视觉规范：可点元素 ≥44px；当前页用品牌色下划线标记
const navLink =
  'inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent text-ink-muted text-[15px] transition-colors hover:text-ink aria-[current=page]:border-brand aria-[current=page]:text-ink'

/**
 * 站点页头（specs/marketing-site「站点页头」）：左侧品牌与导航，右上角是语言菜单与账户控件。
 * 公共页面与空间页面共用，语言切换不再放在页面角落的浮层里。
 *
 * 两站分开经营（openspec product-improve-ai-content-20261030 D5，specs/multi-site「应用区导航按站点生成」）：
 * 导航只列当前站点的工具；应用区按账号语言渲染，语言不属于本站时改用本站默认语言的工具与链接，
 * 不生成跨站或本站不存在的地址。
 */
export function SiteHeader() {
  const siteId = useSiteId()
  const locale = getLocale()
  const pathname = useLocation({ select: (location) => location.pathname })
  // 东方站英文入口页没有英语工具：只保留品牌与语言菜单，入口页正文链接到各语言工具
  const englishEntry =
    siteId === 'east' && locale === EAST_ENGLISH_LOCALE && !isAppAreaPath(pathname)
  const navLocale = siteNavLocale(siteId, locale, templateConfig)
  const tools = englishEntry ? [] : toolsForSite(siteId, navLocale)
  const blog = blogHasPosts(useBlogLocales(), navLocale)
  return (
    <header className="border-line border-b bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3"
      >
        {m.site_skip_to_content()}
      </a>
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <SiteLink
          path={englishEntry ? EAST_ENGLISH_PATH : '/'}
          locale={locale}
          navLocale={englishEntry ? locale : navLocale}
          className="flex min-h-11 items-center gap-2.5 text-ink"
        >
          <SiteLogo site={siteId} />
          <span className="font-bold font-heading text-xl tracking-wide">
            {siteBrandName(templateConfig, siteId, locale)}
          </span>
        </SiteLink>
        <nav
          aria-label={m.site_nav_tools()}
          className="order-last flex basis-full flex-wrap items-center gap-x-5 sm:order-none sm:flex-1 sm:basis-auto sm:justify-end"
        >
          {tools.map((tool) => (
            <a
              key={tool.id}
              href={toolHref(tool.path, navLocale)}
              className={navLink}
              aria-current={pathname === tool.path ? 'page' : undefined}
            >
              {tool.title}
            </a>
          ))}
          {!englishEntry && templateConfig.billing.enabled && (
            <SiteLink path="/pricing" locale={locale} navLocale={navLocale} className={navLink}>
              {m.marketing_nav_pricing()}
            </SiteLink>
          )}
          {!englishEntry && blog && (
            <SiteLink path="/blog" locale={locale} navLocale={navLocale} className={navLink}>
              {m.marketing_nav_blog()}
            </SiteLink>
          )}
          {!englishEntry && site.docs && (
            <SiteLink path="/docs" locale={locale} navLocale={navLocale} className={navLink}>
              {m.marketing_nav_docs()}
            </SiteLink>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
