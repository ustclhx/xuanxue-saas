import { useLocation } from '@tanstack/react-router'
import { Button, cn } from '@xuanxue/ui'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { getLocale, locales } from '../../paraglide/runtime.js'
import { isPrerenderedPath } from '../marketing/prerender.ts'
import { useSiteId } from '../site/context.tsx'
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
 * - 固定在视口底部、不占文档流（CLS 0），出现时只淡入上移 8px（200ms，减少动态效果时只淡入）；
 *   显示期间给 <html> 加 scroll-padding-bottom（提示实际占用的底部高度 + 12px，随提示高度变化更新）。
 * - 关闭或点切换后在 localStorage 按站点永久记住（promptDismissedKey）；语言控件手动选择也写同一记录。
 * - 无障碍：<section aria-label lang>（地标，名称用目标语言），提示句 role="status" 下一帧填入；Esc 关闭，
 *   键盘关闭后焦点移到 <main>。不锁焦点。
 * 视觉按画板（prompt.css）：桌面居中、最宽 600px、单行高 62px；手机左右下各 12px 另加安全区。
 *   挂在根布局（营销外壳之外），自带 data-surface="marketing" 才取到营销字号（东方站 16px、西方站 17px，行高 28px）。
 *   按钮是画板的胶囊形（高 44px、字重 500）；两个候选时手机排两行，第二行两个等宽按钮。
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
    const element = section.current
    // 键盘焦点滚动到的元素停在提示上方：提示高度 + 距视口底部的距离（含安全区）+ 12px 间距。
    // 提示句下一帧才填入、手机上会折行，字体载入与旋转屏幕也会改变高度，所以随尺寸变化重新计算
    const reserve = () => {
      if (!element) return
      const style = window.getComputedStyle(element)
      const offset =
        (Number.parseFloat(style.bottom) || 0) + (Number.parseFloat(style.marginBottom) || 0)
      root.style.scrollPaddingBottom = `${Math.ceil(element.offsetHeight + offset) + 12}px`
    }
    // 这里读取一次布局，起始状态（透明、下移 8px）先生效，下一帧的过渡才会播放
    reserve()
    const observer = element ? new ResizeObserver(reserve) : null
    if (element) observer?.observe(element)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
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
      // 根布局在营销外壳之外：自带作用域，text-body 才是营销字号
      data-surface="marketing"
      onKeyDown={onKeyDown}
      // 手机底部另留安全区（刘海屏 home indicator）
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      className={cn(
        'fixed inset-x-3 bottom-3 z-(--z-sticky) flex items-center gap-3 rounded-object border border-line-strong bg-surface py-2 pr-1 pl-4 text-body text-ink shadow-raise dark:bg-surface-2',
        // 桌面：水平居中、宽度随文字（w-max），最宽 600px
        'md:inset-x-0 md:bottom-6 md:mx-auto md:w-max md:max-w-150 md:gap-4 md:pr-2 md:pl-5',
        // 两个候选的手机版：第一行提示句与关闭，第二行两个等宽按钮
        pair && 'max-md:flex-wrap max-md:gap-x-2 max-md:gap-y-1 max-md:pt-1 max-md:pb-3',
        // 进场只动 opacity 与 translate，不触发布局
        'transition duration-200 ease-out motion-reduce:transition-opacity',
        announced
          ? 'translate-y-0 opacity-100'
          : 'translate-y-2 opacity-0 motion-reduce:translate-y-0',
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden size-5 flex-none text-ink-muted md:block"
      >
        <circle cx="10" cy="10" r="7" />
        <path d="M3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14" />
      </svg>
      <p role="status" className="min-w-0 flex-1 py-1">
        {announced ? message : ''}
      </p>
      <div
        className={cn(
          'flex flex-none items-center gap-2',
          pair && 'max-md:order-last max-md:basis-full max-md:pr-3',
        )}
      >
        {offer.targets.map((locale) => {
          const own = PROMPT_COPY[locale]
          const visible = pair ? (PROMPT_LANGUAGE_NAMES[locale] ?? locale) : (own?.switch ?? locale)
          return (
            <Button
              key={locale}
              asChild
              variant={pair ? 'outline' : 'default'}
              className={cn(
                'min-h-11 min-w-16 rounded-full px-4 font-medium md:px-5',
                pair && 'before:ring-field-border max-md:flex-1',
              )}
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
      </div>
      {/* 与页头图标按钮同款（画板 .iconbtn）：44×44、ink-muted、6px 圆角，不画底色 */}
      <button
        type="button"
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-field text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        aria-label={dismissLabel}
        onClick={(event) => close(event.detail === 0)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="size-5"
        >
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </section>
  )
}
