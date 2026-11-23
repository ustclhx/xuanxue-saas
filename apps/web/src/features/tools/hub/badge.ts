import { m } from '../../../paraglide/messages.js'
import type { ToolBadge } from '../registry.ts'

/**
 * 小标文字：「新」，或年份小标登记的文字（未登记时取到期日的年份）。传入的是仍在有效期内的小标
 * （registry.ts activeBadge），过期的小标为 undefined，不渲染。
 * 单独一个模块：页头下拉只需要这一句文案，不带入工具卡的说明与分组文案。
 */
export function badgeText(badge: ToolBadge | undefined): string | null {
  if (!badge) return null
  return badge.kind === 'new' ? m.tools_hub_badge_new() : (badge.label ?? badge.until.slice(0, 4))
}
