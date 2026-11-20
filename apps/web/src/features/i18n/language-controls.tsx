import { type MouseEvent, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import {
  closeHeaderMenu,
  GlobeIcon,
  HeaderMenu,
  headerMenuItem,
  useDismissDetails,
} from '../site/header-menu.tsx'
import { LOCALE_AUTONYMS } from '../site/theme.ts'
import { useLanguageLinks } from './language-links.ts'
import { rememberPromptChoice } from './prompt-match.ts'

/** 选择语言时收起菜单，并写入语言建议提示的关闭记录（localStorage，设计稿 LocalePromptSpec B「记住关闭」）；导航由链接自身完成 */
function onLanguageClick(event: MouseEvent<HTMLAnchorElement>) {
  rememberPromptChoice()
  closeHeaderMenu(event.currentTarget)
}

/**
 * 页头右上角的语言菜单（specs/i18n「语言切换控件位于站点页头右上角」）。
 * 只列出当前站点的语言，语言名用各语言自己的写法（specs/multi-site「语言控件只列本站语言」）：
 * 西方站只有英语，不显示菜单；东方站另有 English，指向东方站英文首页 `/`，不跳到西方站。
 * 只列已发布的语言（rollout.ts，openspec add-locales-eu-ja 决策 5）：菜单随预渲染 HTML 输出，不按主机区分。
 * 每一项是指向该语言对应页面的普通链接（多语言 SEO 规范 ML-08，地址规则见 language-links.ts），
 * `<details>` 菜单不依赖脚本即可展开。
 */
export function LanguageMenu() {
  const locale = getLocale()
  const links = useLanguageLinks({ englishEntry: true })
  if (links.length === 0) return null
  return (
    <HeaderMenu
      label={m.i18n_language()}
      icon={<GlobeIcon />}
      text={LOCALE_AUTONYMS[locale] ?? locale}
    >
      {links.map((link) => (
        <a
          key={link.locale}
          href={link.href}
          hrefLang={link.locale}
          lang={link.locale}
          aria-current={link.current ? 'page' : undefined}
          className={headerMenuItem}
          onClick={onLanguageClick}
        >
          <span>{link.label}</span>
          {link.current ? <span aria-hidden="true">✓</span> : null}
        </a>
      ))}
    </HeaderMenu>
  )
}

/**
 * 设置行（页脚与手机导航面板）里的语言下拉：外观与 Select 的触发器、弹层一致，但用 `<details>` 加普通链接实现
 * （多语言 SEO 规范 ML-08）——不依赖水合与脚本，选项是 `<a href hreflang lang>`，点了才整页导航。
 * 只列本站有完整页面的已发布语言（东方站的 English 入口在页头菜单）。
 */
export function LanguageDropdown() {
  const locale = getLocale()
  const links = useLanguageLinks()
  const ref = useRef<HTMLDetailsElement>(null)
  useDismissDetails(ref)
  if (links.length === 0) return null
  const label = m.i18n_language()
  const text = LOCALE_AUTONYMS[locale] ?? locale
  return (
    <details ref={ref} className="group/language relative">
      <summary
        aria-label={`${label} ${text}`}
        className="inline-flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-field-border px-3 text-body text-foreground transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <span lang={locale}>{text}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted-foreground transition-colors group-hover/language:text-foreground"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute top-full left-0 z-(--z-popover) mt-1.5 flex min-w-full flex-col rounded-xl bg-surface-3 p-1 shadow-surface-3">
        {links.map((link) => (
          <a
            key={link.locale}
            href={link.href}
            hrefLang={link.locale}
            lang={link.locale}
            aria-current={link.current ? 'page' : undefined}
            className="flex h-9 items-center justify-between gap-2 whitespace-nowrap rounded-lg px-2 text-caption text-muted-foreground no-underline transition-colors hover:bg-hover hover:text-foreground aria-[current=page]:bg-hover aria-[current=page]:text-foreground max-md:h-11"
            onClick={onLanguageClick}
          >
            {link.label}
            {link.current ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : null}
          </a>
        ))}
      </div>
    </details>
  )
}
