import { useLocation } from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { getLocale, locales } from '../../paraglide/runtime.js'
import { isPrerenderedPath } from '../marketing/prerender.ts'
import { useSiteId } from '../site/context.tsx'
import { GlobeIcon } from '../site/header-menu.tsx'
import { CHINESE_PAIR_COPY, PROMPT_COPY, PROMPT_LANGUAGE_NAMES } from './locale-prompt-copy.ts'
import { promptDismissedKey, promptLocales } from './prompt-match.ts'

/**
 * 语言建议提示 LocalePrompt（使用者 2026-11-20 网址规则；设计稿
 * docs/design/prototypes/warm-refresh/LocalePrompt*.dc.html，规格见 LocalePromptSpec）。取代模板的 LanguageSuggestion。
 *
 * - 只在客户端：水合后浏览器空闲时读取 navigator.languages；服务端与预渲染 HTML 里没有任何标记，爬虫看不到。
 * - 不自动跳转、不写 Cookie：「切换」是指向当前页对应语言版本的真实 `<a href hreflang>`，点了才整页导航。
 * - 候选只取当前页 `<link rel="alternate" hreflang>` 中列出的语言（hreflang 只含本站已发布、且该页确有的版本），
 *   当前页没有浏览器语言的版本时不提示。不带地区的 `zh` 在简繁都有时并列两个候选。
 * - 固定在视口底部、不占文档流（CLS 0），出现时只淡入上移；显示期间给 <html> 加 scroll-padding-bottom。
 * - 关闭或点切换后在 localStorage 按站点永久记住（promptDismissedKey）；语言控件手动选择也写同一记录。
 * - 无障碍：<section aria-label lang>（地标，名称用目标语言），提示句 role="status" 下一帧填入；Esc 关闭，
 *   键盘关闭后焦点移到 <main>。不锁焦点。
 * 视觉细节（尺寸、两候选手机两行）按画板用现有 token 实现，后续由设计统一精修。
 */
export function LocalePrompt() {
  const siteId = useSiteId()
  const pathname = useLocation({ select: (location) => location.pathname })
  const [offer, setOffer] = useState<{ targets: string[]; hrefs: Record<string, string> } | null>(
    null,
  )
  const [announced, setAnnounced] = useState(false)
  const section = useRef<HTMLElement>(null)

  useEffect(() => {
    setOffer(null)
    setAnnounced(false)
    // 只在公开页面提示（应用区按账号语言、认证页不提示）
    if (!isPrerenderedPath(pathname, locales) && !pathname.endsWith('/pricing')) return
    const decide = () => {
      let dismissed = false
      try {
        dismissed = window.localStorage.getItem(promptDismissedKey(siteId)) === '1'
      } catch {
        // localStorage 不可用：照常提示，关闭只在本次浏览内有效
      }
      const hrefs: Record<string, string> = {}
      for (const link of document.querySelectorAll<HTMLLinkElement>(
        'link[rel="alternate"][hreflang]',
      )) {
        const lang = link.getAttribute('hreflang') ?? ''
        if (lang === 'x-default') continue
        const url = new URL(link.href, window.location.href)
        // 站内地址：同一 Worker 在正式域名与预览地址上提供相同路径
        hrefs[lang] = `${url.pathname}${url.search}`
      }
      const targets = promptLocales({
        languages: navigator.languages?.length ? navigator.languages : [navigator.language ?? ''],
        locales,
        offerable: Object.keys(hrefs),
        current: getLocale(),
        dismissed,
      })
      if (targets.length) setOffer({ targets, hrefs })
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(decide, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(decide, 1)
    return () => clearTimeout(id)
  }, [pathname, siteId])

  useEffect(() => {
    if (!offer) return
    // 先插入空的 status，下一帧再填入文字：读屏在当前内容读完后播报一次；同一帧开始淡入上移 8px
    const frame = window.requestAnimationFrame(() => setAnnounced(true))
    const root = document.documentElement
    const height = section.current?.offsetHeight ?? 0
    root.style.scrollPaddingBottom = `${height + 24}px`
    return () => {
      window.cancelAnimationFrame(frame)
      root.style.scrollPaddingBottom = ''
    }
  }, [offer])

  if (!offer) return null
  const pair = offer.targets.length > 1
  const target = offer.targets[0] ?? ''
  const copy = PROMPT_COPY[target] ?? PROMPT_COPY.en
  if (!copy) return null
  const lang = pair ? CHINESE_PAIR_COPY.lang : target
  const message = pair ? CHINESE_PAIR_COPY.message : copy.message
  const dismissLabel = pair ? CHINESE_PAIR_COPY.dismiss : copy.dismiss

  function remember() {
    try {
      window.localStorage.setItem(promptDismissedKey(siteId), '1')
    } catch {
      // 只关闭本次
    }
  }
  function close(byKeyboard: boolean) {
    remember()
    setOffer(null)
    if (byKeyboard) {
      const main = document.getElementById('main')
      if (main) {
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
        main.focus()
      }
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close(true)
    }
  }

  return (
    <section
      ref={section}
      lang={lang}
      aria-label={pair ? CHINESE_PAIR_COPY.region : copy.region}
      data-nosnippet=""
      data-locale-prompt={offer.targets.join(' ')}
      onKeyDown={onKeyDown}
      // 手机底部另留安全区（刘海屏 home indicator）
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      className={`fixed inset-x-3 bottom-3 z-sticky flex flex-wrap items-center gap-3 rounded-object border border-line-strong bg-surface py-2 pr-1 pl-4 text-ink shadow-raise transition duration-200 motion-reduce:transition-opacity md:inset-x-auto md:bottom-6 md:left-1/2 md:max-w-150 md:-translate-x-1/2 md:gap-4 md:pr-2 md:pl-5 dark:bg-surface-2 dark:shadow-none ${announced ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 motion-reduce:translate-y-0'}`}
    >
      <span aria-hidden="true" className="hidden text-ink-muted md:inline-flex">
        <GlobeIcon />
      </span>
      <p role="status" className="min-w-0 flex-1 py-1">
        {announced ? message : ''}
      </p>
      <div className="flex flex-none items-center gap-2">
        {offer.targets.map((locale) => {
          const own = PROMPT_COPY[locale]
          const visible = pair ? (PROMPT_LANGUAGE_NAMES[locale] ?? locale) : (own?.switch ?? locale)
          return (
            <Button
              key={locale}
              asChild
              variant={pair ? 'outline' : 'default'}
              className="min-h-11 min-w-16 px-4 md:px-5"
            >
              <a
                href={offer.hrefs[locale]}
                hrefLang={locale}
                lang={locale}
                aria-label={pair ? undefined : own?.switchLabel}
                onClick={remember}
              >
                {visible}
              </a>
            </Button>
          )
        })}
        <Button
          type="button"
          variant="ghost"
          className="size-11 p-0"
          aria-label={dismissLabel}
          onClick={(event) => close(event.detail === 0)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Button>
      </div>
    </section>
  )
}
