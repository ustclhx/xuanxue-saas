import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import type { SiteId } from '@xuanxue/config'
import { themeInitScript } from '@xuanxue/ui'
import type { ReactNode } from 'react'
import { ImpersonationBanner } from '../features/admin/impersonation-banner.tsx'
import { getAnnouncement } from '../features/admin/settings-announcement.functions.ts'
import { AnnouncementBanner } from '../features/admin/settings-announcement-banner.tsx'
import { ProductAnalytics } from '../features/analytics/analytics.tsx'
import { analyticsHeadScripts } from '../features/analytics/head.ts'
import { LanguageSuggestion } from '../features/i18n/language-controls.tsx'
import { privateMeta } from '../features/seo/metadata.ts'
import { getSafeImpersonation, getSeoOrigin } from '../features/seo/origin.functions.ts'
import { SiteContext } from '../features/site/context.tsx'
import { getCurrentSite } from '../features/site/site.functions.ts'
import { SITE_THEME_SCRIPT, siteFontScript, siteIconLinks } from '../features/site/theme.ts'
import { ThemeToggle } from '../features/theme/theme-toggle.tsx'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'
import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
  loader: async () => {
    const [impersonation, announcement, appUrl, site] = await Promise.all([
      getSafeImpersonation(),
      getAnnouncement(),
      getSeoOrigin(),
      getCurrentSite(),
    ])
    return { impersonation, announcement, appUrl, site }
  },
  staleTime: Infinity,
  head: ({ matches, loaderData }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'xuanxue' },
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
      ),
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { impersonation, announcement, site } = Route.useLoaderData()
  // 后台侧栏与认证页脚自带控件，避免浮动控件遮挡正文。
  const hasInlineControls = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId.startsWith('/(auth)/')) ||
      /^\/admin(\/|$)/.test(state.location.pathname),
  })
  return (
    <RootDocument site={site.id} floatingControls={!hasInlineControls}>
      <ProductAnalytics />
      <ImpersonationBanner viewer={impersonation} />
      <AnnouncementBanner initial={announcement} />
      {templateConfig.i18n.enabled && !hasInlineControls && <LanguageSuggestion />}
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({
  children,
  site,
  floatingControls,
}: Readonly<{ children: ReactNode; site: SiteId; floatingControls: boolean }>) {
  return (
    // 主题类名由下方内联脚本在水合前写到 <html> 上，与服务端输出不一致属预期；
    // data-site 切换两站 token（styles/site-theme.css）
    <html lang={getLocale()} data-site={site} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <SiteContext value={site}>
          {children}
          {floatingControls && <ThemeToggle className="fixed right-4 bottom-4" />}
        </SiteContext>
        <Scripts />
      </body>
    </html>
  )
}
