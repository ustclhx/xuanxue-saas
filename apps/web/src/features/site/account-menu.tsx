import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'
import { getViewerSpaces } from '../workspace/viewer.functions.ts'
import { closeHeaderMenu, HeaderMenu, UserIcon } from './header-menu.tsx'

type Viewer = Awaited<ReturnType<typeof getViewerSpaces>>

/**
 * 页头右上角的账户控件。未登录：进入登录页并带回当前页面；已登录：列出可进入的空间。
 * 服务端只输出未登录结构，水合后再查询空间，不让会话读取阻塞营销页预渲染。
 * 会话 Cookie 是 HttpOnly，客户端读不到，因此不做前置判断：未登录时服务端直接返回，代价只是一次轻量请求。
 */
export function AccountMenu() {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [loginHref, setLoginHref] = useState(() => localizeHref('/login', { locale: getLocale() }))
  useEffect(() => {
    // 登录入口带上当前页面（含语言前缀），登录后回到发起页面（specs/user-auth「登录后的去向」）
    const here = `${window.location.pathname}${window.location.search}`
    setLoginHref(
      `${localizeHref('/login', { locale: getLocale() })}?redirect=${encodeURIComponent(here)}`,
    )
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

  if (!viewer?.signedIn)
    return (
      <a
        href={loginHref}
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
