import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { AppError } from '@xuanxue/shared'
import { baseLocale, isLocale } from '../../paraglide/runtime.js'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { resolveSite } from '../site/site.ts'
import { languageUrl, PREFERENCE_COOKIE, preferredLocale, readCookie } from './preference.ts'
import { readRequestSession } from './session.server.ts'
import { prefixLocale } from './url-prefix.ts'

/** 水合后读取真实请求头，预渲染 HTML 不混入访客偏好。 */
export const getLanguageSuggestion = createServerFn({ method: 'GET' }).handler(() => {
  if (!templateConfig.i18n.enabled) return null
  const request = getRequest()
  const prefixed = prefixLocale(languageUrl(request).pathname, templateConfig.i18n.locales)
  if (prefixed || readCookie(request.headers.get('cookie') ?? '', PREFERENCE_COOKIE)) return null
  const preferred = preferredLocale(request.headers.get('accept-language'))
  // 两站分开经营（D5）：已登记站点只建议本站语言，否则切换后会落到本站的 404
  const site = resolveSite(new URL(request.url).host, templateConfig)
  if (site.known && !templateConfig.sites[site.id].locales.some((item) => item === preferred))
    return null
  return preferred === baseLocale ? null : preferred
})

/** 手动选择也应用于已登录账号；没有有效会话时只由浏览器记 Cookie。 */
export const saveLanguagePreference = createServerFn({ method: 'POST' })
  .validator((locale: unknown) => {
    if (!templateConfig.i18n.enabled) throw new AppError('NOT_FOUND', 'Not found', { status: 404 })
    if (!isLocale(locale)) throw new TypeError('Unsupported locale')
    return locale
  })
  .handler(async ({ data }) => {
    const { db, auth } = getWebRuntime()
    let signedIn = false
    try {
      await readRequestSession({ auth, db, headers: getRequest().headers })
      signedIn = true
    } catch (error) {
      if (!(error instanceof AppError && [401, 403].includes(error.status))) throw error
    }
    if (signedIn)
      await auth.api.updateUser({ headers: getRequest().headers, body: { locale: data } })
    return { ok: true }
  })
