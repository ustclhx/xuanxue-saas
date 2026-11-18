import { cn } from '@xuanxue/ui'
import { ThemeToggle } from './theme-toggle.tsx'

/**
 * 随页面滚动的设置行（openspec refresh-visual-system-warm design.md D4）：主题切换不再浮动，
 * 桌面与手机都放在页脚（没有站点页脚的页面放在页面末尾），两站都显示。
 * 本项目的语言切换在页头右上角（specs/i18n「语言切换控件位于站点页头右上角」），这里只放主题切换。
 */
export function SiteSettings({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <ThemeToggle />
    </div>
  )
}
