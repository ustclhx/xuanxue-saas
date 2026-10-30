import { useLocation } from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { baseLocale, getLocale, isLocale, type Locale, locales } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { isPrerenderedPath } from '../marketing/prerender.ts'
import { useSiteId } from '../site/context.tsx'
import { closeHeaderMenu, GlobeIcon, HeaderMenu } from '../site/header-menu.tsx'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH } from '../site/site.ts'
import { LOCALE_AUTONYMS } from '../site/theme.ts'
import { useLocaleSwitch } from './locale-switch.ts'
import { getLanguageSuggestion } from './preference.functions.ts'
import { rememberLocale } from './preference.ts'

const languageItem =
  'flex min-h-11 w-full items-center justify-between gap-6 rounded-lg px-3 text-left text-[15px] text-ink transition-colors hover:bg-surface-2 aria-[current=true]:font-semibold aria-[current=page]:font-semibold'

/**
 * 页头右上角的语言菜单（specs/i18n「语言切换控件位于站点页头右上角」）。
 * 只列出当前站点的语言，语言名用各语言自己的写法（specs/multi-site「语言控件只列本站语言」）：
 * 西方站只有英语，不显示菜单；东方站另有 English，指向东方站英文入口页 `/en`，不跳到西方站。
 */
export function LanguageMenu() {
  const locale = getLocale()
  const siteId = useSiteId()
  const { busy, error, select } = useLocaleSwitch()
  const siteLocales = templateConfig.sites[siteId].locales
  const englishEntry = siteId === 'east' && locales.some((item) => item === EAST_ENGLISH_LOCALE)
  if (!templateConfig.i18n.enabled || siteLocales.length + (englishEntry ? 1 : 0) < 2) return null
  return (
    <HeaderMenu label={m.i18n_language()} icon={<GlobeIcon />}>
      {siteLocales.map((item) => (
        <button
          key={item}
          type="button"
          lang={item}
          disabled={busy}
          aria-current={item === locale ? 'true' : undefined}
          className={languageItem}
          onClick={(event) => {
            closeHeaderMenu(event.currentTarget)
            void select(item)
          }}
        >
          <span>{LOCALE_AUTONYMS[item] ?? item}</span>
          {item === locale ? <span aria-hidden="true">✓</span> : null}
        </button>
      ))}
      {englishEntry && (
        // 英文入口页只有一页，是普通链接：不改账号语言，应用区仍按原语言显示
        <a
          href={EAST_ENGLISH_PATH}
          lang={EAST_ENGLISH_LOCALE}
          hrefLang={EAST_ENGLISH_LOCALE}
          aria-current={locale === EAST_ENGLISH_LOCALE ? 'page' : undefined}
          className={languageItem}
        >
          <span>{LOCALE_AUTONYMS[EAST_ENGLISH_LOCALE] ?? EAST_ENGLISH_LOCALE}</span>
          {locale === EAST_ENGLISH_LOCALE ? <span aria-hidden="true">✓</span> : null}
        </a>
      )}
      {error ? (
        <p role="alert" className="px-3 pb-1 text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </HeaderMenu>
  )
}

/**
 * 营销页的语言建议：水合后按 Accept-Language 提示一次，不改变 URL（specs/i18n「语言选择与记忆」）。
 * 认证页与应用区不展示；语言的手动切换在页头菜单中完成。
 */
export function LanguageSuggestion() {
  const location = useLocation()
  const [suggestion, setSuggestion] = useState<Locale | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locale = getLocale()
  const siteId = useSiteId()
  const { busy, select } = useLocaleSwitch()
  useEffect(() => {
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

  if (!suggestion && !error) return null
  return (
    <>
      {suggestion && (
        // 建议在水合后才取得：用固定定位浮层呈现，不推挤已渲染的正文，避免布局位移（CLS）
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
      {error && (
        <p role="alert" className="fixed bottom-16 left-4 z-50">
          {error}
        </p>
      )}
    </>
  )
}

/** 后台侧栏使用的语言下拉（自带位置，不做浮层） */
export function LanguageSelect() {
  const locale = getLocale()
  const { busy, error, select } = useLocaleSwitch()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <>
      <label className="inline-flex min-h-11 w-fit items-center rounded-md border bg-background px-3 text-sm shadow-xs">
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
              {LOCALE_AUTONYMS[value] ?? value}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </>
  )
}
