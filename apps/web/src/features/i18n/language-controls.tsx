import { Select, SelectContent, SelectItem, SelectTrigger } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale, isLocale, locales } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { useSiteId } from '../site/context.tsx'
import { closeHeaderMenu, GlobeIcon, HeaderMenu, headerMenuItem } from '../site/header-menu.tsx'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_URL } from '../site/site.ts'
import { LOCALE_AUTONYMS } from '../site/theme.ts'
import { useLocaleSwitch } from './locale-switch.ts'
import { releasedSiteLocales } from './rollout.ts'

const languageItem = headerMenuItem

/**
 * 页头右上角的语言菜单（specs/i18n「语言切换控件位于站点页头右上角」）。
 * 只列出当前站点的语言，语言名用各语言自己的写法（specs/multi-site「语言控件只列本站语言」）：
 * 西方站只有英语，不显示菜单；东方站另有 English，指向东方站英文入口页 `/en`，不跳到西方站。
 * 只列已发布的语言（rollout.ts，openspec add-locales-eu-ja 决策 5）：菜单随预渲染 HTML 输出，不按主机区分。
 */
export function LanguageMenu() {
  const locale = getLocale()
  const siteId = useSiteId()
  const { busy, error, select } = useLocaleSwitch()
  const siteLocales = releasedSiteLocales(siteId, templateConfig)
  const englishEntry =
    siteId === 'east' &&
    locales.some((item) => item === EAST_ENGLISH_LOCALE) &&
    !siteLocales.includes(EAST_ENGLISH_LOCALE)
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
          href={EAST_ENGLISH_URL}
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

/** 后台侧栏使用的语言下拉（自带位置，不做浮层） */
export function LanguageSelect() {
  const locale = getLocale()
  // 与页头菜单相同只列本站已发布语言；另一站语言在本站应用区不生效（request.server.ts accountLocale）
  const siteLocales = releasedSiteLocales(useSiteId(), templateConfig)
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
