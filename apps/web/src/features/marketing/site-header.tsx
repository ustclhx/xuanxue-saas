import { useLocation } from '@tanstack/react-router'
import { siteBrandName } from '@xuanxue/config'
import { PageWidth, ToolLabel } from '@xuanxue/ui/project'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { isAppAreaPath } from '../i18n/app-area.ts'
import { LanguageMenu } from '../i18n/language-controls.tsx'
import { AccountMenu } from '../site/account-menu.tsx'
import { SiteLogo } from '../site/brand.tsx'
import { useSiteId } from '../site/context.tsx'
import { HeaderMenu, headerMenuItem, MenuIcon } from '../site/header-menu.tsx'
import {
  EAST_ENGLISH_LOCALE,
  EAST_ENGLISH_PATH,
  siteNavLocale,
  siteServesLocale,
} from '../site/site.ts'
import { LanguageSetting, ThemeSetting } from '../theme/site-settings.tsx'
import { badgeText } from '../tools/hub/badge.ts'
import { toolsHubPath } from '../tools/hub/routes.ts'
import { type ToolBadge, toolsForSite } from '../tools/registry.ts'
import { toolHref } from '../tools/tool-href.ts'
import { featuredNavTools, selectFeatured } from './home-hub/featured.ts'
import { SiteLink } from './site-link.tsx'

// 可点元素 ≥ 44px；当前页用站点强调色下划线标记
const navLink =
  'inline-flex min-h-11 items-center whitespace-nowrap border-transparent border-b-2 text-body text-ink-muted no-underline transition-colors hover:text-ink aria-[current=page]:border-mark aria-[current=page]:text-ink'

/** 每日运势 / Number of the Day 在导航中单列，不进工具下拉（design.md D7） */
const DAILY_TOOL_IDS = new Set(['daily', 'daily-numerology'])

/**
 * 站点页头（specs/marketing-site「站点页头」；openspec refresh-visual-system-warm design.md D7，
 * 设计稿 docs/design/prototypes/warm-refresh/Components*.dc.html）：
 * - 导航不超过 5 项：工具下拉、每日运势、定价、语言、账户；博客、指南与文档的入口在页脚。
 * - 工具下拉只列首页精选与「历法与生肖」分组，末行是「全部工具」枢纽页；手机菜单中「全部工具」在工具分组之后、
 *   其他页头项之前（openspec content-growth-v2-tools 决策 5，设计稿 content-growth-v2-tools/Nav.dc.html）。
 * - 手机为单行页头（标志、语言、账户、导航按钮），导航收进 `<details>` 面板，面板内含主题切换与语言；
 *   面板不依赖水合即可展开。
 * 公共页面与空间页面共用。
 *
 * 两站分开经营（openspec product-improve-ai-content-20261030 D5，specs/multi-site「应用区导航按站点生成」）：
 * 导航只列当前站点的工具；应用区按账号语言渲染，语言不属于本站时改用本站默认语言的工具与链接，
 * 不生成跨站或本站不存在的地址。
 * data-link-zone="nav"：链接图检查（scripts/check-links.mjs）据此把页头当作导航层，登录等入口不算正文链接。
 */
export function SiteHeader() {
  const siteId = useSiteId()
  const locale = getLocale()
  const pathname = useLocation({ select: (location) => location.pathname })
  // 东方站英文入口页没有英语工具：只保留品牌与语言菜单，入口页正文链接到各语言工具。
  // 东方站根路径英文（5b）发布后有自己的工具与导航（siteServesLocale）；发布前的预览按入口页处理
  const englishEntry =
    siteId === 'east' &&
    locale === EAST_ENGLISH_LOCALE &&
    !isAppAreaPath(pathname) &&
    !siteServesLocale(siteId, locale, templateConfig)
  const navLocale = siteNavLocale(siteId, locale, templateConfig)
  const all = englishEntry ? [] : toolsForSite(siteId, navLocale)
  const daily = all.find((tool) => DAILY_TOOL_IDS.has(tool.id))
  // 工具下拉只列首页精选（主卡、季节位的年度内容、副卡，最多 5 项）与「历法与生肖」分组，末行是「全部工具」；
  // 其余工具从枢纽页进入（content-growth-v2-tools 决策 5，设计稿 Nav.dc.html）
  const featured = englishEntry ? [] : featuredNavTools(selectFeatured(siteId, navLocale))
  const calendar = all.filter((tool) => tool.navGroup === 'calendar')
  const hubPath = englishEntry ? undefined : toolsHubPath(siteId, navLocale)
  const tools = [...featured, ...calendar]
  const pricing = !englishEntry && templateConfig.billing.enabled
  const current = (path: string) => (pathname === path ? 'page' : undefined)
  const toolLink = (tool: {
    id: string
    path: string
    title: string
    badge?: ToolBadge | undefined
  }) => {
    const badge = badgeText(tool.badge)
    return (
      <a
        key={tool.id}
        href={toolHref(tool.path, navLocale)}
        className={headerMenuItem}
        aria-current={current(tool.path)}
      >
        {tool.title}
        {badge && <ToolLabel kind="new">{badge}</ToolLabel>}
      </a>
    )
  }
  // 「历法与生肖」分组（content-growth-phase2 设计稿 EastNavVariant 方案 C）：同一下拉中分隔线之后的一组；
  // 该语言没有分组页面时不出现
  const toolLinks = [
    ...featured.map(toolLink),
    ...(calendar.length > 0
      ? [
          <hr key="calendar-rule" className="mx-3 my-2 border-line" />,
          <p key="calendar-label" className="m-0 px-3 pt-2 pb-1 text-caption text-ink-subtle">
            {m.site_nav_calendar_group()}
          </p>,
          ...calendar.map(toolLink),
        ]
      : []),
    ...(hubPath
      ? [
          <hr key="hub-rule" className="mx-3 my-2 border-line" />,
          <a
            key="tools-hub"
            href={toolHref(hubPath, navLocale)}
            data-nav-hub
            className={`${headerMenuItem} font-medium`}
            aria-current={current(hubPath)}
          >
            {m.tools_hub_title()}
            <span aria-hidden="true">→</span>
          </a>,
        ]
      : []),
  ]
  return (
    <header data-link-zone="nav" className="relative bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-field focus:bg-surface focus:px-4 focus:py-3"
      >
        {m.site_skip_to_content()}
      </a>
      <PageWidth className="flex h-14 items-center justify-between gap-6 md:h-18">
        <SiteLink
          path={englishEntry ? EAST_ENGLISH_PATH : '/'}
          locale={locale}
          navLocale={englishEntry ? locale : navLocale}
          className="flex min-h-11 items-center gap-2.5 text-ink no-underline"
        >
          <SiteLogo site={siteId} />
          <span className="font-heading text-subtitle">
            {siteBrandName(templateConfig, siteId, locale)}
          </span>
        </SiteLink>
        <div className="flex items-center md:gap-9">
          <nav aria-label={m.site_nav_tools()} className="hidden items-center gap-9 md:flex">
            {tools.length > 0 && (
              <HeaderMenu
                label={m.site_nav_tools_menu()}
                text={m.site_nav_tools_menu()}
                active={tools.some((tool) => tool.path === pathname) || hubPath === pathname}
              >
                {toolLinks}
              </HeaderMenu>
            )}
            {daily && (
              <a
                href={toolHref(daily.path, navLocale)}
                className={navLink}
                aria-current={current(daily.path)}
              >
                {daily.title}
              </a>
            )}
            {pricing && (
              <SiteLink path="/pricing" locale={locale} navLocale={navLocale} className={navLink}>
                {m.marketing_nav_pricing()}
              </SiteLink>
            )}
          </nav>
          <div className="-mr-3 flex items-center md:mr-0 md:gap-9">
            <LanguageMenu />
            <AccountMenu />
            {!englishEntry && (
              <HeaderMenu label={m.site_nav_menu()} icon={<MenuIcon />} wide className="md:hidden">
                <nav aria-label={m.site_nav_menu()} className="grid gap-1">
                  {tools.length > 0 && (
                    <p className="m-0 px-3 pt-2 pb-1 text-caption text-ink-subtle">
                      {m.site_nav_tools_menu()}
                    </p>
                  )}
                  {toolLinks}
                  <hr className="mx-3 my-2 border-line" />
                  {daily && (
                    <a
                      href={toolHref(daily.path, navLocale)}
                      className={headerMenuItem}
                      aria-current={current(daily.path)}
                    >
                      {daily.title}
                    </a>
                  )}
                  {pricing && (
                    <SiteLink
                      path="/pricing"
                      locale={locale}
                      navLocale={navLocale}
                      className={headerMenuItem}
                    >
                      {m.marketing_nav_pricing()}
                    </SiteLink>
                  )}
                </nav>
                <hr className="mx-3 my-2 border-line" />
                <ThemeSetting className="px-3 py-1" />
                <LanguageSetting className="px-3 py-1" />
              </HeaderMenu>
            )}
          </div>
        </div>
      </PageWidth>
    </header>
  )
}
