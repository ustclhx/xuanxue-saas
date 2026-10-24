import { createAuthClient } from 'better-auth/client'
import {
  emailOTPClient,
  inferAdditionalFields,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from 'better-auth/client/plugins'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { safeReturnPath } from '../site/return-path.ts'

/**
 * 浏览器端的 Better Auth 客户端（接口挂在同源的 /api/auth/*）。
 * 关闭默认的 redirect 插件：登录接口的 `callbackURL` 同时用作验证邮件中的回跳地址（/verify-email），
 * 登录成功后由页面自己跳转到 signInCallbackURL()（回跳地址或站点首页），而不是跳到 callbackURL。
 */
function create() {
  return createAuthClient({
    basePath: '/api/auth',
    disableDefaultFetchPlugins: true,
    plugins: [
      organizationClient(),
      emailOTPClient(),
      magicLinkClient(),
      twoFactorClient(),
      inferAdditionalFields({
        user: {
          locale: { type: 'string', required: false },
          timezone: { type: 'string', required: false },
        },
      }),
    ],
  })
}

let client: ReturnType<typeof create> | undefined

/** 只在浏览器事件处理中调用（SSR 时不创建客户端） */
export function authClient() {
  client ??= create()
  return client
}

/**
 * 登录成功后的站点首页（当前语言）。东方站没有无前缀的默认语言，首页必须带语言前缀，
 * 否则会落到入口页（specs/user-auth「登录后的去向」）。
 */
export function homePath(): string {
  return localizeHref('/', { locale: getLocale() })
}

/**
 * 登录成功后的去处：只允许本站可回跳的路径（账户中心、有效的邀请、本站公开页面），
 * 其余情况（包括回跳地址未通过校验）回到站点首页，不再默认进入 `/app`。
 */
export function signInDestination(search: string, home: string = '/'): string {
  const redirect = new URLSearchParams(search).get('redirect')
  if (
    redirect === '/account' ||
    (redirect &&
      /^\/accept-invitation\?id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        redirect,
      ))
  )
    return redirect
  return safeReturnPath(redirect, templateConfig.i18n.locales) ?? home
}

export function signInCallbackURL() {
  return signInDestination(window.location.search, homePath())
}

/** OAuth 失败时回到当前登录页（保留语言前缀与 redirect），Better Auth 追加 `error` */
export function signInErrorCallbackURL() {
  const url = new URL(window.location.href)
  url.searchParams.delete('error')
  return `${url.pathname}${url.search}`
}

/** 整页跳转：让服务端以新的会话 Cookie 渲染应用区 */
export function goAfterSignIn() {
  window.location.assign(signInCallbackURL())
}
