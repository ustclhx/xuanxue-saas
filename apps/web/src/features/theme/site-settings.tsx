import { cn } from '@xuanxue/ui'
import { useSiteId } from '../site/context.tsx'
import { ThemeToggle } from './theme-toggle.tsx'

/**
 * 手机端（< md）的设置行（设计稿 docs/design-system/prototypes/mobile-footer-controls）：
 * 小屏上浮动控件会遮挡正文，改为随页面滚动的一行；桌面仍用根布局的浮动控件。
 * 本项目的语言切换在页头右上角（specs/i18n「语言切换控件位于站点页头右上角」），手机端页头同样可见，
 * 这里只放主题切换，不重复语言控件；西方站只有深色主题、没有主题切换，整行不渲染。
 */
export function SiteSettings({ className }: { className?: string }) {
  if (useSiteId() === 'west') return null
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <ThemeToggle />
    </div>
  )
}
