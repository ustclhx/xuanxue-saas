import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { type SiteId, siteBrandName } from '@xuanxue/config'
import { themeInitScript } from '@xuanxue/ui'
import { ImpersonationBanner } from '../features/admin/impersonation-banner.tsx'
import { getAnnouncement } from '../features/admin/settings-announcement.functions.ts'
import { AnnouncementBanner } from '../features/admin/settings-announcement-banner.tsx'
import { ProductAnalytics } from '../features/analytics/analytics.tsx'
import { analyticsHeadScripts } from '../features/analytics/head.ts'
import { LanguageSuggestion } from '../features/i18n/language-controls.tsx'
import { getBlogLocales } from '../features/marketing/content.functions.ts'
import { privateMeta } from '../features/seo/metadata.ts'
import {
  getPlausibleSite,
  getSafeImpersonation,
  getSeoOrigin,
} from '../features/seo/origin.functions.ts'
import { SiteContext, useSiteId } from '../features/site/context.tsx'
import { getCurrentSite } from '../features/site/site.functions.ts'
import { siteNavLocale } from '../features/site/site.ts'
import { SITE_THEME_SCRIPT, siteFontScript, siteIconLinks } from '../features/site/theme.ts'
import { getHtmlAttributes } from '../features/theme/html-attributes.isomorphic.ts'
import { RootDocument } from '../features/theme/root-document.tsx'
import { m } from '../paraglide/messages.js'
import { getLocale, type Locale, localizeHref } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'
import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
  beforeLoad: ({ location }) => ({
    htmlAttributes: getHtmlAttributes(location.pathname),
  }),
  loader: async () => {
    const [impersonation, announcement, appUrl, site, blogLocales, plausible] = await Promise.all([
      getSafeImpersonation(),
      getAnnouncement(),
      getSeoOrigin(),
      getCurrentSite(),
      getBlogLocales(),
      getPlausibleSite(),
    ])
    return { impersonation, announcement, appUrl, site, blogLocales, plausible }
  },
  staleTime: Infinity,
  head: ({ matches, loaderData }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: matches.some((match) => match.status === 'notFound' || match._notFound)
          ? `${m.common_not_found_title()} | ${rootBrand(loaderData?.site.id ?? 'west')}`
          : rootBrand(loaderData?.site.id ?? 'west'),
      },
      ...privateMeta(matches.at(-1)?.pathname ?? '/'),
    ],
    // 全局样式（Tailwind + @xuanxue/ui 主题），SSR 输出的 <head> 中直接引用，避免首屏无样式闪烁
    links: [{ rel: 'stylesheet', href: appCss }, ...siteIconLinks(loaderData?.site.id ?? 'west')],
    // 首屏前按偏好（未设置时跟随系统）给 <html> 设置 dark 类：<head> 内同步执行，避免刷新时先浅后深的闪烁；
    // 西方站始终为深色（features/site/theme.ts）
    // 站点字体（docs/design/visual-system.md「字体」）：自托管，只加载本站本语言的一套，由脚本非阻塞插入
    scripts: [
      { children: themeInitScript() },
      { children: SITE_THEME_SCRIPT },
      { children: siteFontScript(loaderData?.site.id ?? 'west', getLocale()) },
      ...analyticsHeadScripts(
        matches.at(-1)?.pathname ?? '/',
        loaderData?.site ?? { id: 'west', known: false },
        templateConfig,
        loaderData?.plausible,
      ),
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})

function rootBrand(site: SiteId): string {
  const config = templateConfig.sites[site]
  const locale = getLocale()
  // 无语言入口页也使用本站品牌，不能由跨站语言偏好决定站点名。
  return siteBrandName(
    templateConfig,
    site,
    config.locales.some((value) => value === locale) ? locale : config.locales[0],
  )
}

/**
 * 404 页（保持 404 状态，不跳转首页）：给出回到本站首页与定价页的入口。
 * 链接按本站导航语言生成完整地址（siteNavLocale），不落到另一站点或本站不存在的语言路径。
 */
function NotFoundPage() {
  const site = useSiteId()
  const locale = siteNavLocale(site, getLocale(), templateConfig) as Locale
  const pricing = templateConfig.marketing.enabled && templateConfig.billing.enabled
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-24 text-center">
      <h1 className="font-heading text-3xl font-semibold">{m.common_not_found_title()}</h1>
      <p className="text-ink-muted">{m.common_not_found_body()}</p>
      <nav className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <a
          href={localizeHref('/', { locale })}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-on-brand"
        >
          {m.common_not_found_home({ brand: siteBrandName(templateConfig, site, locale) })}
        </a>
        {pricing && (
          <a
            href={localizeHref('/pricing', { locale })}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-5 font-semibold text-ink"
          >
            {m.common_not_found_pricing()}
          </a>
        )}
      </nav>
    </main>
  )
}

function RootComponent() {
  const { impersonation, announcement, site } = Route.useLoaderData()
  const { htmlAttributes } = Route.useRouteContext()
  // 后台侧栏与认证页脚自带控件，避免浮动控件遮挡正文。
  const hasInlineControls = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId.startsWith('/(auth)/')) ||
      /^\/admin(\/|$)/.test(state.location.pathname),
  })
  return (
    // data-site 由 features/theme/html-attributes.ts 写到 <html>（brand.css 按它切换两站 token）
    <RootDocument floatingControls={!hasInlineControls} htmlAttributes={htmlAttributes}>
      <SiteContext value={site.id}>
        <ProductAnalytics />
        <ImpersonationBanner viewer={impersonation} />
        <AnnouncementBanner initial={announcement} />
        {templateConfig.i18n.enabled && !hasInlineControls && <LanguageSuggestion />}
        <Outlet />
      </SiteContext>
    </RootDocument>
  )
}
