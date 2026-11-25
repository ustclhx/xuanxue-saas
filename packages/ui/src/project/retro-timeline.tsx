import { cn } from '../lib/utils.ts'

// 逆行时间条（设计稿 docs/design/prototypes/content-growth-v2-batch2/ProposalsB.dc.html 提议 A3「RetroTimeline」，
// 使用者 2026-11-24 确认）：每颗行星一行，轨道 surface-2、逆行区间为站点强调色（mark）、今天为一条 ink 竖线。
// 只作概览：图整体是 role="img"，同一页必须另有逐项日期表；手机上月份标签隔一个显示。
// 只接收 0–1 的年内比例与已本地化的文字，不做日期换算。

export interface RetroTimelineRow {
  /** 稳定 key（React key） */
  key: string
  /** 行名（行星名） */
  label: string
  /** 年内区间，0 = 1 月 1 日开始，1 = 12 月 31 日结束 */
  bars: readonly { readonly start: number; readonly end: number }[]
}

export interface RetroTimelineProps {
  rows: readonly RetroTimelineRow[]
  /** 12 个月份的短名 */
  months: readonly string[]
  /** 今天在年内的位置（0–1）；不在本年时省略 */
  today?: number | undefined
  /** 图的可访问名称（应说明同样的日期见下方表格） */
  label: string
  className?: string
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const percent = (value: number) => `${(clamp(value) * 100).toFixed(2)}%`

export function RetroTimeline({ rows, months, today, label, className }: RetroTimelineProps) {
  return (
    <div role="img" aria-label={label} className={cn('flex flex-col gap-2.5', className)}>
      <div aria-hidden="true" className="flex items-center gap-2 sm:gap-3">
        <span className="w-16 shrink-0 sm:w-22" />
        <span className="grid min-w-0 flex-1 grid-cols-12 text-caption text-ink-subtle">
          {months.map((month, i) => (
            <span key={month} className={cn('truncate', i % 2 === 1 && 'max-sm:invisible')}>
              {month}
            </span>
          ))}
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.key} aria-hidden="true" className="flex items-center gap-2 sm:gap-3">
          <span className="w-16 shrink-0 truncate text-caption text-ink sm:w-22">{row.label}</span>
          <span className="relative block h-5 min-w-0 flex-1 rounded-sm bg-surface-2">
            {row.bars.map((bar) => (
              <i
                key={`${bar.start}-${bar.end}`}
                className="absolute inset-y-0 block rounded-sm bg-mark"
                style={{
                  left: percent(bar.start),
                  width: percent(clamp(bar.end) - clamp(bar.start)),
                }}
              />
            ))}
            {today === undefined ? null : (
              <b
                className="absolute -inset-y-1 block w-0.5 bg-ink"
                style={{ left: percent(today) }}
              />
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
