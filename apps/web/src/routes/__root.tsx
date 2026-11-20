import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { type SiteId, siteBrandName } from '@xuanxue/config'
import { themeInitScript } from '@xuanxue/ui'
import { ImpersonationBanner } from '../features/admin/impersonation-banner.tsx'
import { getAnnouncement } from '../features/admin/settings-announcement.functions.ts'
import { AnnouncementBanner } from '../features/admin/settings-announcement-banner.tsx'
import { ProductAnalytics } from '../features/analytics/analytics.tsx'
import { analyticsHeadScripts } from '../features/analytics/head.ts'
import { LocalePromptLoader } from '../features/i18n/locale-prompt-loader.tsx'
import { getBlogLocales } from '../features/marketing/content.functions.ts'
import { contentLinks } from '../features/marketing/content-links.ts'
import { ContentHead, ContentPage, inlineLinks } from '../features/marketing/content-page.tsx'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { privateMeta, titleWithSite } from '../features/seo/metadata.ts'
import {
  getPlausibleSite,
  getSafeImpersonation,
  getSeoOrigin,
} from '../features/seo/origin.functions.ts'
import { SiteContext, useSiteId } from '../features/site/context.tsx'
import { pvuvHeadScripts } from '../features/site/pvuv.ts'
import { getCurrentSite } from '../features/site/site.functions.ts'
import { siteNavLocale } from '../features/site/site.ts'
import { siteFontScript, siteIconLinks, siteThemeScript } from '../features/site/theme.ts'
import { getHtmlAttributes } from '../features/theme/html-attributes.isomorphic.ts'
import { RootDocument } from '../features/theme/root-document.tsx'
import { SiteSettings } from '../features/theme/site-settings.tsx'
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
          ? titleWithSite(m.common_not_found_title(), getLocale(), loaderData?.site.id ?? 'west')
          : rootBrand(loaderData?.site.id ?? 'west'),
      },
      ...privateMeta(matches.at(-1)?.pathname ?? '/'),
    ],
    // 全局样式（Tailwind + @xuanxue/ui 主题），SSR 输出的 <head> 中直接引用，避免首屏无样式闪烁
    links: [{ rel: 'stylesheet', href: appCss }, ...siteIconLinks(loaderData?.site.id ?? 'west')],
    // 首屏前按偏好（未设置时跟随系统）给 <html> 设置 dark 类：<head> 内同步执行，避免刷新时先浅后深的闪烁；
    // 西方站首次到访默认浅色：siteThemeScript 先写入默认选择，再由模板脚本按它设置类名（features/site/theme.ts）
    // 站点字体（docs/design/visual-system.md「字体」）：自托管，只加载本站本语言的一套，由脚本非阻塞插入
    scripts: [
      { children: siteThemeScript() },
      { children: themeInitScript() },
      { children: siteFontScript(loaderData?.site.id ?? 'west', getLocale()) },
      // 语言切换提示只在客户端按浏览器语言出现（features/i18n/locale-prompt.tsx），不在首帧脚本与 SSR HTML 中
      ...analyticsHeadScripts(
        matches.at(-1)?.pathname ?? '/',
        loaderData?.site ?? { id: 'west', known: false },
        templateConfig,
        loaderData?.plausible,
      ),
      // pvuv.ai 站点统计：与 Cloudflare beacon 同范围，只在已登记站点的公开页面（features/site/pvuv.ts）
      ...pvuvHeadScripts(
        matches.at(-1)?.pathname ?? '/',
        loaderData?.site ?? { id: 'west', known: false },
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
 * 404 页（保持 404 状态，不跳转首页；设计稿 warm-refresh/NotFound.dc.html）：小字「错误 404」、H1、一句说明
 * 与回到本站首页的主按钮。说明里链接本站的主工具与三张牌塔罗（正文内链 2 条）。
 * 链接按本站导航语言生成完整地址（siteNavLocale），不落到另一站点或本站不存在的语言路径。
 * 营销站点开启时带站点页头与页脚；关闭时只输出正文。
 */
function NotFoundPage() {
  const site = useSiteId()
  const locale = siteNavLocale(site, getLocale(), templateConfig) as Locale
  const body = (
    <ContentPage>
      <ContentHead
        eyebrow={<p className="m-0 text-caption text-ink-subtle">{m.common_not_found_eyebrow()}</p>}
        title={m.common_not_found_title()}
      >
        <p className="m-0 text-body text-ink-muted">
          {inlineLinks(m.common_not_found_body({}, { locale }), contentLinks(locale))}
        </p>
        <p className="m-0 mt-3 flex">
          <a
            href={localizeHref('/', { locale })}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-7 font-medium text-body text-on-brand no-underline transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 sm:w-auto"
          >
            {m.common_not_found_home({ brand: siteBrandName(templateConfig, site, locale) })}
          </a>
        </p>
      </ContentHead>
    </ContentPage>
  )
  if (templateConfig.marketing.enabled) return <MarketingShell>{body}</MarketingShell>
  return (
    <main data-surface="marketing" className="text-body">
      {body}
    </main>
  )
}

function RootComponent() {
  const { impersonation, announcement, site } = Route.useLoaderData()
  const { htmlAttributes } = Route.useRouteContext()
  // 后台侧栏、认证页脚与工作台侧边栏布局自带控件，路由也可用 staticData.floatingControls = false 声明不需要，
  // 避免浮动控件遮挡正文。
  const hasInlineControls = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId.startsWith('/(auth)/') ||
          match.staticData.floatingControls === false ||
          // 只在工作台壳实际渲染时；空间不存在或出错时显示浮动控件
          (templateConfig.ui.appLayout === 'sidebar' &&
            match.routeId === '/app/$slug' &&
            match.status !== 'notFound' &&
            match.status !== 'error'),
      ) || /^\/admin(\/|$)/.test(state.location.pathname),
  })
  return (
    // data-site 由 features/theme/html-attributes.ts 写到 <html>（brand.css 按它切换两站 token）。
    // SiteContext 包在 RootDocument 外：模板在 RootDocument 内渲染浮动 ThemeToggle（与 children 平级），
    // 它按站点决定是否显示，包在 children 内时会读到默认的 west 而在东方站消失。Provider 不输出 DOM。
    <SiteContext value={site.id}>
      <RootDocument floatingControls={false} htmlAttributes={htmlAttributes}>
        <ProductAnalytics />
        <ImpersonationBanner viewer={impersonation} />
        <AnnouncementBanner initial={announcement} />
        {templateConfig.i18n.enabled && !hasInlineControls && <LocalePromptLoader />}
        <Outlet />
        {/* 主题切换不再浮动（refresh-visual-system-warm D4）：RootDocument 的浮动控件始终关闭。
            没有站点页脚的页面（含 topbar 工作台）把设置行放在页面末尾，手机端底部留 80px 给右下悬浮按钮；
            有页脚时由页脚渲染，这里隐藏 */}
        {!hasInlineControls && (
          <SiteSettings className="border-t px-4 pt-4 pb-20 md:pb-4 print:hidden [body:has([data-site-footer])_&]:hidden" />
        )}
      </RootDocument>
    </SiteContext>
  )
}
