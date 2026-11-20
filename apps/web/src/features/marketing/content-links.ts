import { type Locale, localizeHref } from '../../paraglide/runtime.js'
import { toolsForLocale } from '../tools/registry.ts'
import { mainToolHref, toolHref } from '../tools/tool-href.ts'
import type { InlineLink } from './content-page.tsx'

/**
 * 内容页正文里的站内链接（Proposals79 D「每页的正文内链」）：按 key 取地址，配合文案中的
 * `[锚文本](key)` 使用。全部是本站本语言的地址（语言只属于一个站点），不指向另一个站点。
 * - main：本语言的主工具页（八字排盤 / 만세력 / Life Path Number）；
 * - tarot：三张牌塔罗；
 * - privacy / refund / terms：法律页。
 */
export function contentLinks(locale: Locale): Record<string, InlineLink | undefined> {
  const tarot = toolsForLocale(locale).find((tool) => tool.id === 'tarot-three-card')
  const page = (path: string): InlineLink => ({ href: localizeHref(path, { locale }) })
  return {
    main: { href: mainToolHref(locale) },
    tarot: tarot ? { href: toolHref(tarot.path, locale) } : undefined,
    privacy: page('/privacy'),
    refund: page('/refund'),
    terms: page('/terms'),
  }
}
