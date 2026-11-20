import { useLocation } from '@tanstack/react-router'
import type { SiteId } from '@xuanxue/config'
import { Button, Select, SelectContent, SelectItem, SelectTrigger } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { baseLocale, getLocale, isLocale, locales, localizeHref } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { isPrerenderedPath } from '../marketing/prerender.ts'
import { useSiteId } from '../site/context.tsx'
import { closeHeaderMenu, GlobeIcon, HeaderMenu, headerMenuItem } from '../site/header-menu.tsx'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH } from '../site/site.ts'
import { LOCALE_AUTONYMS } from '../site/theme.ts'
import { useLocaleSwitch } from './locale-switch.ts'
import { rememberLocale } from './preference.ts'
import { siteSuggestableLocales } from './site-suggestion.ts'
import {
  detachPrehydrationListener,
  handledBeforeHydration,
  SUGGESTION_ATTRIBUTE,
  suggestionCss,
  suggestionTargets,
} from './suggestion.ts'
import { switchLocalePath } from './switch-path.ts'

const languageItem = headerMenuItem

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
    <HeaderMenu
      label={m.i18n_language()}
      icon={<GlobeIcon />}
      text={LOCALE_AUTONYMS[locale] ?? locale}
    >
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
        <p role="alert" className="px-3 pb-1 text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </HeaderMenu>
  )
}

/**
 * 营销页的语言建议，只提示、不改变 URL（specs/i18n「语言选择与记忆」）。认证页与应用区不展示；
 * 语言的手动切换在页头菜单中完成。
 *
 * 建议在首帧前由 <head> 脚本按浏览器语言决定（suggestion.ts，模板 0.5.10）：这里在服务端就输出每个候选语言的
 * 浮层（默认隐藏），只显示与 <html data-locale-suggestion> 相符的一条；水合后不再请求、插入或移除。
 * 浮层固定定位，不推挤正文；首帧即可操作（「切换语言」是真实链接，水合前的点击由首帧脚本记住选择）。
 * 可建议的语言按站点与路径决定（site-suggestion.ts，与首帧脚本同值，模板 0.5.11 的 suggestableLocales）：
 * 已登记站点只建议本站语言，未登记的预览 Host 建议全部语言，带语言前缀的页面（东方站英文入口页 `/en`）不建议。
 * 浮层在水合后带 data-hydrated（仅属性），供 e2e 判断水合完成。
 */
export function LanguageSuggestion({ site }: { site: { id: SiteId; known: boolean } }) {
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)
  const locale = getLocale()
  const [ready, setReady] = useState(false)
  const { busy, error, select } = useLocaleSwitch()
  useEffect(() => {
    setReady(true)
    // 水合完成：浮层的点击改由 React 处理，摘除首帧脚本注册的水合前监听
    detachPrehydrationListener()
  }, [])
  // 与根路由首帧脚本取同一个值（site-suggestion.ts）：本站语言、预览 Host 全部、带语言前缀的页面不建议
  const suggestableLocales = siteSuggestableLocales(site, location.pathname)
  // 服务端与水合首次渲染一致，显示与否只由首帧前脚本写入的属性决定
  const suggestions =
    !dismissed &&
    locale === baseLocale &&
    (isPrerenderedPath(location.pathname, locales) || location.pathname === '/pricing')
      ? suggestionTargets({ baseLocale, locales, suggestableLocales })
      : []

  function dismiss() {
    rememberLocale(locale)
    // 去掉首帧脚本写入的属性：之后客户端导航回到营销页也不再显示
    document.documentElement.removeAttribute(SUGGESTION_ATTRIBUTE)
    setDismissed(true)
  }

  if (suggestions.length === 0 && !error) return null
  return (
    <>
      {suggestions.length > 0 && <style>{suggestionCss(suggestions)}</style>}
      {suggestions.map((suggestion) => (
        <aside
          key={suggestion}
          data-locale-suggestion-for={suggestion}
          data-link-zone="nav"
          data-hydrated={ready ? '' : undefined}
          aria-label={m.i18n_suggestion_label()}
          className="hidden fixed inset-x-4 bottom-20 z-50 mx-auto max-w-xl flex-wrap items-center justify-center gap-3 rounded-lg border bg-muted px-4 py-3 shadow-md"
        >
          {/* 横幅文案属于界面提示而非页面内容：data-nosnippet 让搜索引擎不把它用作摘要
              （Google 仅认 div/span/section 上的该属性；display: contents 保持外层 flex 布局） */}
          <div data-nosnippet="" className="contents">
            <p>
              {m.i18n_suggestion({
                language:
                  new Intl.DisplayNames([suggestion], { type: 'language' }).of(suggestion) ??
                  suggestion,
              })}
            </p>
            {/* 真实链接：水合前与关闭 JS 时也能切换（水合前的 Cookie 由首帧脚本写入）；水合后保存账号语言再导航。
                工具页各语言路径不同，按注册表换成目标语言的页面（switch-path.ts） */}
            <Button asChild className="min-h-11" aria-disabled={busy || undefined}>
              <a
                href={localizeHref(switchLocalePath(location.pathname, suggestion, locales), {
                  locale: suggestion,
                })}
                data-locale-suggestion-action="switch"
                onClick={(event) => {
                  if (handledBeforeHydration(event.nativeEvent)) return
                  event.preventDefault()
                  if (!busy) void select(suggestion)
                }}
              >
                {m.i18n_switch()}
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              data-locale-suggestion-action="dismiss"
              onClick={(event) => {
                if (handledBeforeHydration(event.nativeEvent)) setDismissed(true)
                else dismiss()
              }}
            >
              {m.i18n_dismiss()}
            </Button>
          </div>
        </aside>
      ))}
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
  // 与页头菜单相同只列本站语言；另一站语言在本站应用区不生效（request.server.ts accountLocale）
  const siteLocales = templateConfig.sites[useSiteId()].locales
  const { busy, error, select } = useLocaleSwitch()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (siteLocales.length < 2) return null
  const currentLabel = LOCALE_AUTONYMS[locale] ?? locale
  return (
    <>
      <div className="inline-flex min-h-11 w-fit items-center">
        <span className="sr-only">{m.i18n_language()}</span>
        <Select
          value={siteLocales.some((value) => value === locale) ? locale : ''}
          disabled={!ready || busy}
          onValueChange={(value) => {
            if (isLocale(value)) void select(value)
          }}
        >
          <SelectTrigger
            aria-label={m.i18n_language()}
            className="min-h-11 w-full min-w-0"
            placeholder={m.i18n_language()}
            valueLabel={currentLabel}
          />
          <SelectContent>
            {siteLocales.map((value, index) => (
              <SelectItem key={value} index={index} value={value}>
                {LOCALE_AUTONYMS[value] ?? value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </>
  )
}

/**
 * 模板工作台侧边栏布局（ui.appLayout='sidebar'）使用的语言切换入口；本项目目前用 topbar 布局，
 * 这里复用后台侧栏的下拉，保证切换到侧边栏布局时语言列表同样只列本站语言。
 */
export function LanguageControls(
  _props: { placement?: 'floating' | 'inline' | 'bare'; suggest?: boolean } = {},
) {
  return <LanguageSelect />
}
