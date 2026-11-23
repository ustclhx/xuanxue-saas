import { EAST_EN_CONTENT_ROUTES } from '../../east-en/paths.ts'
import { EAST_CONTENT_ROUTES } from '../routes.ts'
import type { YearlyLocale } from './paths.ts'

/**
 * 个人年度流年工具（第 7 组，集合 `yearly-tool`）的预定地址（design 决策 2）。正文可以直接链接这个地址；
 * 工具页尚未登记时，页面把这条链接还原为普通文字，避免死链（工具上线后链接自动出现）。
 */
export const YEARLY_TOOL_PLANNED_PATHS: Readonly<Record<YearlyLocale, string>> = {
  'zh-Hans': '/2027流年',
  'zh-Hant': '/2027流年',
  ko: '/2027-신년-사주',
  en: '/bazi-2027',
}

/** 已登记的个人年度工具地址（未登记时为 undefined） */
export function yearlyToolPath(
  locale: YearlyLocale,
  routes = [...EAST_CONTENT_ROUTES, ...EAST_EN_CONTENT_ROUTES],
): string | undefined {
  return routes.find((route) => route.collection === 'yearly-tool' && route.locale === locale)?.path
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 把指向未登记工具页的链接还原为锚文本（RichContent 输出的 `<a href="…">…</a>`） */
export function unlinkUnpublished(html: string, hrefs: readonly string[]): string {
  return hrefs.reduce(
    (text, href) =>
      text.replace(
        new RegExp(`<a href="${escapeRegExp(href)}"[^>]*>([\\s\\S]*?)</a>`, 'g'),
        (_, inner: string) => inner,
      ),
    html,
  )
}
