import { useSyncExternalStore } from 'react'
import { getLocale } from '../../paraglide/runtime.js'

/**
 * 按访问者本地时区显示时间，且不产生水合差异。
 * 服务端（Workers 恒为 UTC）不知道访问者时区，若首屏直接用运行时默认时区格式化，
 * 服务端与浏览器输出不同，React 抛 #418。做法：SSR 与水合首帧固定按 UTC 输出并标注「UTC」，
 * 水合完成后再切到浏览器时区；客户端内导航时组件直接以本地时间渲染，没有闪动。
 */

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

const subscribe = () => () => {}

/** 水合前（含 SSR）为 false，之后为 true */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}

/** local 为 false 时按 UTC 格式化并附「UTC」，供 SSR 与水合首帧使用 */
export function formatDisplayTime(
  value: Date | string,
  local: boolean,
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTIONS,
  locale: string = getLocale(),
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : ''
  if (local) return new Intl.DateTimeFormat(locale, options).format(date)
  return `${new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date)} UTC`
}

/** 便捷组件：输出带机器可读 dateTime 的 <time> */
export function LocalDateTime({
  value,
  options,
}: {
  value: Date | string
  options?: Intl.DateTimeFormatOptions
}) {
  const hydrated = useHydrated()
  const date = typeof value === 'string' ? new Date(value) : value
  const iso = Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  return <time dateTime={iso}>{formatDisplayTime(date, hydrated, options)}</time>
}
