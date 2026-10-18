import { ThemeToggle as BaseThemeToggle } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import { useSiteId } from '../site/context.tsx'

/** 带当前语言文案的主题切换（浅色 / 深色 / 跟随系统）；西方站只有深色主题，不显示 */
export function ThemeToggle({ className }: { className?: string }) {
  if (useSiteId() === 'west') return null
  return (
    <BaseThemeToggle
      className={className}
      labels={{
        group: m.theme_toggle_label(),
        light: m.theme_light(),
        dark: m.theme_dark(),
        system: m.theme_system(),
      }}
    />
  )
}
