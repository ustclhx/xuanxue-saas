import type { NumberResult } from '@xuanxue/numerology'
import { cn } from '@xuanxue/ui'
import { m } from '../../paraglide/messages.js'
import type { WestPersonalFacts } from './facts.ts'

// 个人年 / 月 / 日三格：西方站每日页与空间首页的今日面板共用。独立成小模块，今日面板（随空间首页路由进入全站
// 静态闭包）不再把整个每日数字页组件带进首页脚本（首页包预算，add-locales-eu-ja 决策 11）
export function PersonalNumbers({
  result,
  className,
}: {
  result: WestPersonalFacts
  className?: string
}) {
  const tiles: [string, NumberResult, boolean][] = [
    [m.daily_west_personal_year(), result.personalYear, false],
    [m.daily_west_personal_month(), result.personalMonth, false],
    [m.daily_west_personal_day(), result.personalDay, true],
  ]
  return (
    <div className={cn('grid grid-cols-3 gap-2 text-center', className)}>
      {tiles.map(([label, value, current]) => (
        <div
          key={label}
          className={cn(
            'flex flex-col items-center gap-1 rounded-field bg-surface-2 px-1 py-3',
            // 当前项（个人日）用站点强调色描边，不改底色
            current && 'ring-1 ring-mark ring-inset',
          )}
        >
          <span className="text-caption text-ink-subtle">{label}</span>
          <span className="font-bold font-heading text-ink text-title">{value.value}</span>
        </div>
      ))}
    </div>
  )
}
