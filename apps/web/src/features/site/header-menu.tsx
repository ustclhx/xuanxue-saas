import { cn } from '@xuanxue/ui'
import { type ReactNode, useEffect, useRef } from 'react'

/** 页头菜单项的统一样式：整行可点，≥ 44px */
export const headerMenuItem =
  'flex min-h-11 w-full items-center justify-between gap-6 rounded-field px-3 text-left text-body text-ink no-underline transition-colors hover:bg-surface-2 aria-[current=page]:font-medium aria-[current=true]:font-medium'

/**
 * 页头的下拉菜单与手机导航面板（openspec refresh-visual-system-warm design.md D7）。
 * 用原生 `<details>` 实现：服务端即可输出完整结构，不依赖水合（首页水合推迟到首帧之后）；
 * 点击外部与 Esc 关闭、Esc 后焦点回到按钮由下方监听补充。
 * - `icon`：图标按钮（手机页头的语言、账户、导航）；
 * - `text`：文字加箭头（桌面导航的「排盤工具 ▾」「繁體中文 ▾」）。两者都给时手机显示图标、桌面显示文字。
 * - `wide`：面板占满页头宽度（手机导航面板），需要页头外层是定位容器。
 */
export function HeaderMenu({
  label,
  icon,
  text,
  wide = false,
  active = false,
  className,
  children,
}: {
  label: string
  icon?: ReactNode
  text?: string
  wide?: boolean
  active?: boolean
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const details = ref.current
    if (!details) return
    const onPointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) details.open = false
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.open) return
      details.open = false
      details.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])
  return (
    <details ref={ref} className={cn('group', !wide && 'relative', className)}>
      <summary
        aria-label={text && !icon ? undefined : label}
        title={text && !icon ? undefined : label}
        data-active={active || undefined}
        className={cn(
          'flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-field text-body text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 group-open:text-ink data-active:text-ink [&::-webkit-details-marker]:hidden',
          icon && 'min-w-11',
          text && icon && 'md:min-w-0',
        )}
      >
        {icon && <span className={cn('flex', text && 'md:hidden')}>{icon}</span>}
        {text && (
          <span
            className={cn('items-center gap-1', icon ? 'hidden md:inline-flex' : 'inline-flex')}
          >
            {text}
            <ChevronIcon />
          </span>
        )}
      </summary>
      <div
        className={cn(
          'absolute top-full z-50 grid gap-1 rounded-object bg-surface p-3 shadow-raise dark:bg-surface-2',
          wide ? 'inset-x-3' : 'right-0 mt-2 min-w-56',
        )}
      >
        {children}
      </div>
    </details>
  )
}

/** 菜单项被选择后收起菜单（菜单项可能导航，也可能只切换语言） */
export function closeHeaderMenu(element: HTMLElement) {
  element.closest('details')?.removeAttribute('open')
}

export function GlobeIcon() {
  return (
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
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" />
    </svg>
  )
}

export function UserIcon() {
  return (
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
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c1.4-3.6 4.1-5.4 7.5-5.4s6.1 1.8 7.5 5.4" />
    </svg>
  )
}

/** 下拉箭头：菜单展开时翻转 */
export function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-open:rotate-180"
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  )
}

/** 手机页头的导航按钮图标：面板展开时由调用方换成关闭图标 */
export function MenuIcon() {
  return (
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
      <path className="group-open:hidden" d="M4 7h16M4 12h16M4 17h16" />
      <path className="hidden group-open:block" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
