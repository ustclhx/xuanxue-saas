import { Link } from '@tanstack/react-router'
import { type MouseEvent, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'
import { getViewerSpaces } from '../workspace/viewer.functions.ts'
import { closeHeaderMenu, HeaderMenu, UserIcon } from './header-menu.tsx'

type Viewer = Awaited<ReturnType<typeof getViewerSpaces>>

/**
 * 登录入口附加回跳地址（specs/user-auth「登录后的去向」）：`here` 为当前页面的路径与查询（含语言前缀）。
 * 只在点击时调用，页面上渲染的链接始终是不带参数的登录页（specs/seo「认证页不进索引」）。
 */
export function loginWithReturn(loginHref: string, here: string): string {
  return `${loginHref}?redirect=${encodeURIComponent(here)}`
}

/**
 * 页头右上角的账户控件。未登录：进入登录页，点击时带上当前页面；已登录：列出可进入的空间。
 * 服务端只输出未登录结构，水合后再查询空间，不让会话读取阻塞营销页预渲染。
 * 会话 Cookie 是 HttpOnly，客户端读不到，因此不做前置判断：未登录时服务端直接返回，代价只是一次轻量请求。
 * 登录链接的 href 固定为不带参数的登录页并加 nofollow：曾在水合后改写为 `/login?redirect=<当前页>`，
 * 爬虫渲染后每个公开页都会多出一个登录地址变体（openspec fix-seo-canonical-indexing design.md 决策 7）。
 */
export function AccountMenu() {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const loginHref = localizeHref('/login', { locale: getLocale() })
  useEffect(() => {
    let active = true
    void getViewerSpaces().then(
      (value) => {
        if (active) setViewer(value)
      },
      () => {
        if (active) setViewer({ signedIn: false, name: '', spaces: [] })
      },
    )
    return () => {
      active = false
    }
  }, [])

  // 普通左键点击时带上当前页面；修饰键 / 中键打开新标签时进入不带参数的登录页
  const goLogin = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    window.location.assign(
      loginWithReturn(loginHref, `${window.location.pathname}${window.location.search}`),
    )
  }

  if (!viewer?.signedIn)
    return (
      <a
        href={loginHref}
        rel="nofollow"
        onClick={goLogin}
        aria-label={m.marketing_nav_sign_in()}
        title={m.marketing_nav_sign_in()}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <UserIcon />
      </a>
    )

  return (
    <HeaderMenu label={m.site_account_menu()} icon={<UserIcon />}>
      <p className="px-3 pt-1 pb-0.5 text-ink-muted text-sm">{viewer.name}</p>
      <p className="px-3 pb-1 font-semibold text-xs text-ink-subtle">{m.site_account_spaces()}</p>
      {viewer.spaces.map((space) => (
        <Link
          key={space.id}
          to="/app/$slug"
          params={{ slug: space.slug }}
          onClick={(event) => closeHeaderMenu(event.currentTarget)}
          className="flex min-h-11 items-center justify-between gap-6 rounded-lg px-3 text-[15px] text-ink transition-colors hover:bg-surface-2"
        >
          <span>{space.name}</span>
          {space.isPersonal ? (
            <span className="text-ink-subtle text-xs">{m.app_personal_workspace()}</span>
          ) : null}
        </Link>
      ))}
    </HeaderMenu>
  )
}
