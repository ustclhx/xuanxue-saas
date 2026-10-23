import { useLocation } from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import {
  baseLocale,
  getLocale,
  isLocale,
  type Locale,
  locales,
  localizeUrl,
} from '../../paraglide/runtime.js'
import { isPrerenderedPath } from '../marketing/prerender.ts'
import { useSiteId } from '../site/context.tsx'
import { isAppAreaPath } from './app-area.ts'
import { getLanguageSuggestion, saveLanguagePreference } from './preference.functions.ts'
import { rememberLocale } from './preference.ts'
import { switchLocalePath } from './switch-path.ts'

/**
 * 独立组件，预渲染页只在水合后获取 Accept-Language 建议，不改变 URL。
 * 默认固定在左下角；`placement="inline"` 用于后台侧栏等自带位置的容器，避免浮层遮挡内容。
 */
export function LanguageControls({
  placement = 'floating',
}: {
  placement?: 'floating' | 'inline'
} = {}) {
  const floating = placement === 'floating'
  const location = useLocation()
  const [suggestion, setSuggestion] = useState<Locale | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locale = getLocale()
  const siteId = useSiteId()
  useEffect(() => {
    setReady(true)
    setSuggestion(null)
    if (
      !(isPrerenderedPath(location.pathname, locales) || location.pathname === '/pricing') ||
      locale !== baseLocale
    )
      return
    // 东方站根路径的语言入口页已用卡片标出推荐语言，不再弹出建议浮层；
    // 浮层在水合后才出现，会成为首屏最大文字块，拖慢 LCP（2.3 trace）
    if (siteId === 'east' && location.pathname === '/') return
    let active = true
    void getLanguageSuggestion().then(
      (value) => {
        if (active) setSuggestion(value)
      },
      () => {
        if (active) setError(m.i18n_suggestion_failed())
      },
    )
    return () => {
      active = false
    }
  }, [location.pathname, locale, siteId])

  async function select(next: Locale) {
    setBusy(true)
    setError(null)
    try {
      await saveLanguagePreference({ data: next })
      rememberLocale(next)
      // 完整导航让账号语言、SSR 与客户端同时刷新；营销页始终以目的 URL 为准。
      // 工具页各语言路径不同，先按注册表换成目标语言的页面，再加语言前缀
      if (isAppAreaPath(window.location.pathname)) window.location.assign(window.location.href)
      else {
        const url = new URL(window.location.href)
        url.pathname = encodeURI(switchLocalePath(url.pathname, next, locales))
        window.location.assign(localizeUrl(url, { locale: next }).href)
      }
    } catch {
      setError(m.i18n_save_failed())
      setBusy(false)
    }
  }

  return (
    <>
      {suggestion && (
        // 建议在水合后才取得：用固定定位浮层（语言选择上方）呈现，不推挤已渲染的正文，避免布局位移（CLS）
        <aside
          aria-label={m.i18n_suggestion_label()}
          className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-lg border bg-muted px-4 py-3 shadow-md"
        >
          <p>
            {m.i18n_suggestion({
              language:
                new Intl.DisplayNames([suggestion], { type: 'language' }).of(suggestion) ??
                suggestion,
            })}
          </p>
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            onClick={() => void select(suggestion)}
          >
            {m.i18n_switch()}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              rememberLocale(locale)
              setSuggestion(null)
            }}
          >
            {m.i18n_dismiss()}
          </Button>
        </aside>
      )}
      <label
        className={
          floating
            ? 'fixed bottom-4 left-4 z-50 inline-flex min-h-11 items-center rounded-md border bg-background px-3 text-sm shadow-sm'
            : 'inline-flex min-h-11 w-fit items-center rounded-md border bg-background px-3 text-sm shadow-xs'
        }
      >
        <span className="sr-only">{m.i18n_language()}</span>
        <select
          className="min-h-11 min-w-11"
          aria-label={m.i18n_language()}
          value={locale}
          disabled={!ready || busy}
          onChange={(event) => {
            if (isLocale(event.target.value)) void select(event.target.value)
          }}
        >
          {locales.map((value) => (
            <option key={value} value={value}>
              {new Intl.DisplayNames([value], { type: 'language' }).of(value) ?? value}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p
          role="alert"
          className={floating ? 'fixed bottom-16 left-4' : 'text-destructive text-sm'}
        >
          {error}
        </p>
      )}
    </>
  )
}
