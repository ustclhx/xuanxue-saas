import { useId } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../components/combobox.tsx'
import { cn } from '../lib/utils.ts'

// 出生地自动补全（设计稿 docs/design/prototypes/content-growth-v2-batch2/Main.dc.html 的 place 态，使用者 2026-11-24
// 确认的 A1「基于现有 Combobox」）：只是 Combobox 的组合，选项由调用方按输入异步检索后传入（组件不再二次过滤），
// 每行两层文字：地名加粗，下一行为行政区与国家。标签、提示与错误文字都由页面按语言传入。

export interface PlaceOption {
  /** 稳定值（如切片中的行号） */
  value: string
  /** 选中后显示在输入框里的文字 */
  label: string
  /** 选项第一行：地名 */
  name: string
  /** 选项第二行：行政区、国家等 */
  detail: string
}

export interface PlaceComboboxProps {
  label: string
  placeholder: string
  /** 当前检索结果 */
  items: readonly PlaceOption[]
  /** 已选的 `value`，未选为空字符串 */
  value: string
  onValueChange: (value: string) => void
  /** 每次输入变化（未选定时）收到原始文字，由调用方检索 */
  onQueryChange: (query: string) => void
  /** 列表为空时的说明（如「至少输入两个字母」「没有匹配的地名」） */
  emptyText: string
  /** 字段下方的提示（时区等），有错误时不显示 */
  hint?: string | undefined
  error?: string | undefined
  clearLabel: string
  className?: string
}

const acceptAll = () => true

export function PlaceCombobox({
  label,
  placeholder,
  items,
  value,
  onValueChange,
  onQueryChange,
  emptyText,
  hint,
  error,
  clearLabel,
  className,
}: PlaceComboboxProps) {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-caption text-ink-muted">
        {label}
      </label>
      <Combobox items={items} value={value} onValueChange={onValueChange} filter={acceptAll}>
        <ComboboxInput
          id={inputId}
          placeholder={placeholder}
          {...(error ? { error } : {})}
          clearable
          clearLabel={clearLabel}
          aria-describedby={hint && !error ? hintId : undefined}
          onInput={(event) => onQueryChange(event.currentTarget.value)}
          className="min-h-12 bg-background"
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyText}</ComboboxEmpty>
          <ComboboxList>
            {(item) =>
              typeof item === 'string' ? null : (
                <ComboboxItem value={item.value}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-ink">
                      {(item as PlaceOption).name}
                    </span>
                    <span className="truncate text-caption text-ink-muted">
                      {(item as PlaceOption).detail}
                    </span>
                  </span>
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {hint && !error ? (
        <p id={hintId} className="m-0 text-caption text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
