import { cn } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import { templateConfig } from '../../server/template-config.ts'
import { LanguageDropdown } from '../i18n/language-controls.tsx'
import { releasedSiteLocales } from '../i18n/rollout.ts'
import { useSiteId } from '../site/context.tsx'
import { ThemeToggle } from './theme-toggle.tsx'

const row = 'flex min-h-11 items-center justify-between gap-3'
const label = 'text-caption text-ink-subtle'

/** 设置行中的主题切换：标签加三选一按钮组（浅色 / 深色 / 跟随系统），两站都显示 */
export function ThemeSetting({ className }: { className?: string }) {
  return (
    <div className={cn(row, className)}>
      <span className={label}>{m.theme_toggle_label()}</span>
      <ThemeToggle />
    </div>
  )
}

/**
 * 设置行中的语言下拉（选项是普通链接）：只有一种已发布语言的站点不渲染（与页头语言菜单相同只看已发布语言，
 * features/i18n/rollout.ts；未发布的新语言写入配置后，正式站的页脚不出现空的语言行）
 */
export function LanguageSetting({ className }: { className?: string }) {
  const siteId = useSiteId()
  if (releasedSiteLocales(siteId, templateConfig).length < 2) return null
  return (
    <div className={cn(row, className)}>
      <span className={label}>{m.i18n_language()}</span>
      <LanguageDropdown />
    </div>
  )
}

/**
 * 随页面滚动的设置行（openspec refresh-visual-system-warm design.md D4）：主题切换不再浮动，
 * 桌面与手机都放在页脚（没有站点页脚的页面放在页面末尾），两站都显示。
 * 站点页脚与手机导航面板直接使用 ThemeSetting / LanguageSetting；这里是没有站点页脚的页面
 * （应用区等）在页面末尾的兜底，只放主题切换——这些页面的语言切换在页头或侧栏。
 */
export function SiteSettings({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <ThemeToggle />
    </div>
  )
}
