import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { type Locale, localizeHref } from '../../paraglide/runtime.js'
import { EAST_ENGLISH_PATH } from '../site/site.ts'

type SitePath =
  | '/'
  | '/pricing'
  | '/blog'
  | '/docs'
  | '/privacy'
  | '/terms'
  | '/refund'
  | '/disclaimer'
  | typeof EAST_ENGLISH_PATH

/**
 * 页头与页脚的站内链接（openspec product-improve-ai-content-20261030 D5）：当前语言即本站导航语言时
 * 用路由器 Link（按当前语言加前缀、客户端跳转）；否则——应用区账号语言不属于本站、东方站英文入口页——
 * 按导航语言（features/site/site.ts 的 siteNavLocale）生成完整地址，不落到另一站点或本站不存在的路径。
 */
export function SiteLink({
  path,
  locale,
  navLocale,
  className,
  children,
}: {
  path: SitePath
  locale: string
  navLocale: string
  className: string
  children: ReactNode
}) {
  if (path === EAST_ENGLISH_PATH)
    return (
      <a href={path} className={className}>
        {children}
      </a>
    )
  if (locale === navLocale)
    return (
      <Link to={path} className={className} activeProps={{ 'aria-current': 'page' }}>
        {children}
      </Link>
    )
  return (
    <a href={localizeHref(path, { locale: navLocale as Locale })} className={className}>
      {children}
    </a>
  )
}
