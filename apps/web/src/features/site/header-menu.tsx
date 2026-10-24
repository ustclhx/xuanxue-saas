import { type ReactNode, useEffect, useRef } from 'react'

/**
 * 页头右上角的下拉菜单（参考 openfate 的语言与账户按钮）。
 * 用原生 `<details>` 实现：服务端即可输出完整结构，不依赖水合；点击外部与 Esc 关闭由下方监听补充。
 */
export function HeaderMenu({
  label,
  icon,
  children,
}: {
  label: string
  icon: ReactNode
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
    <details ref={ref} className="relative">
      <summary
        aria-label={label}
        title={label}
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
      >
        {icon}
      </summary>
      <div className="absolute top-full right-0 z-50 mt-2 grid min-w-52 gap-1 rounded-xl border border-line bg-surface p-2 shadow-md">
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
