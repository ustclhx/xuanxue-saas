import type { ReactNode } from 'react'
import { cn } from '../lib/utils.ts'

// 事实表（设计稿 docs/design/prototypes/content-growth-phase2 的 `.tblbox` + `table.dt`，使用者 2026-11-22 确认新增）：
// 引擎算出的逐行事实（生肖年份、地支关系、逐日黄历等）。surface 底、圆角盒，表头 caption 字号，
// 首列为键（正文色、中等字重），干支等字形列用标题字体加粗；当前行（本年、今天）用 surface-2 底标出。
// 宽表在自身容器内横向滚动；`stack` 时手机（< 640px）每行改成两列小卡，不横向滚动。

export interface FactColumn<Row> {
  /** 列标识（React key） */
  key: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  /**
   * key：键列（正文色、中等字重、不换行）；glyph：干支等字形（标题字体、加粗）；
   * nowrap：日期、时刻等不换行；text：普通说明文字（默认）
   */
  kind?: 'key' | 'glyph' | 'nowrap' | 'text'
  /**
   * 堆叠布局（`stack`）中的显示：label 在值前加列名小字；full 占满一行；plain 只显示值（默认）。
   * 列名小字只给视觉用户，读屏仍读表头。
   */
  stacked?: 'label' | 'full' | 'plain'
  /** 堆叠布局中的列名小字；省略时用 header（如表头「立春（北京时间）」在卡片中写作「立春」） */
  stackLabel?: ReactNode
  /** 只在 ≥ 640px 显示（手机上省略的次要列，如三合局） */
  desktopOnly?: boolean
}

export interface FactTableProps<Row> {
  columns: readonly FactColumn<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** 表格的可访问名称（visually hidden caption） */
  caption: string
  /** 当前行（本年、今天）：surface-2 底 */
  isCurrent?: (row: Row) => boolean
  /** 手机上每行改成两列小卡（设计稿「stack」），否则在容器内横向滚动 */
  stack?: boolean
  /** 限宽为正文宽度（720px），用于列数少的表 */
  narrow?: boolean
  className?: string
  /** 写在外层容器上的属性（如多语言测量的 data-locale-fixed） */
  containerProps?: Record<`data-${string}`, string | boolean>
}

const cellKind = {
  key: 'whitespace-nowrap font-medium text-ink',
  glyph: 'font-bold font-heading text-ink',
  nowrap: 'whitespace-nowrap',
  text: '',
} as const

export function FactTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  isCurrent,
  stack = false,
  narrow = false,
  className,
  containerProps,
}: FactTableProps<Row>) {
  return (
    <div
      {...containerProps}
      // 横向滚动的区域可用键盘聚焦（axe scrollable-region-focusable）
      tabIndex={stack ? undefined : 0}
      className={cn(
        'max-w-full overflow-x-auto rounded-object bg-surface focus-visible:outline-2 focus-visible:outline-ring',
        stack && 'max-sm:overflow-visible',
        narrow && 'max-w-180',
        className,
      )}
    >
      <table className={cn('w-full border-collapse text-left text-body', stack && 'max-sm:block')}>
        <caption className="sr-only">{caption}</caption>
        <thead className={cn(stack && 'max-sm:sr-only')}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap border-line-strong border-b px-3 py-2.5 font-medium text-caption text-ink-subtle sm:px-5 sm:py-3.5',
                  column.desktopOnly && 'max-sm:hidden',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn(stack && 'max-sm:block')}>
          {rows.map((row) => {
            const current = isCurrent?.(row) ?? false
            return (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-line border-b last:border-b-0',
                  current && 'bg-surface-2',
                  stack &&
                    'max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:px-4 max-sm:py-3.5',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-2.5 align-top text-ink-muted sm:px-5 sm:py-3',
                      cellKind[column.kind ?? 'text'],
                      column.desktopOnly && 'max-sm:hidden',
                      stack && 'max-sm:block max-sm:whitespace-normal max-sm:p-0',
                      stack && column.stacked === 'full' && 'max-sm:col-span-2',
                    )}
                  >
                    {stack && column.stacked === 'label' ? (
                      <span aria-hidden="true" className="text-caption text-ink-subtle sm:hidden">
                        {column.stackLabel ?? column.header}{' '}
                      </span>
                    ) : null}
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
