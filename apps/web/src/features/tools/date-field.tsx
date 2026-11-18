import { cn } from '@xuanxue/ui'
import { type ComponentProps, type ReactNode, useEffect, useId, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import {
  type DateParts,
  joinDateParts,
  joinTimeParts,
  splitDateValue,
  splitTimeValue,
  type TimeParts,
} from './date-parts.ts'
import { FieldError, fieldLabel } from './form.tsx'

/**
 * 按页面语言显示的日期 / 时间字段：用带标签的数字分段代替原生 date / time 控件
 * （原生控件的占位符与上下午跟随浏览器界面语言，不跟随页面 lang）。
 * 各段本身不带 name，表单经隐藏字段提交与原生控件相同的值（`YYYY-MM-DD` / `HH:MM`），规则见 date-parts.ts。
 *
 * 可访问性：外层 fieldset 经 aria-labelledby 以字段标题命名（Playwright 的 getByLabel 仍能按标题找到该组），
 * 错误状态标在每个分段上，并用 aria-describedby 关联错误文字。
 */

/**
 * 单个数字分段（东方站出生年月日同样使用，保持一致的尺寸与焦点样式）。
 * 外框是 <label>：单位（年 / 月 / 日、时 / 分）排在数字右侧（设计稿 ToolBazi 的「1990 年」），同时是输入框的标签文字；
 * 焦点、错误与禁用状态由内部输入框决定，画在外框上。`className` 作用于外框（如所在卡片需要不同底色）。
 */
export function DatePart({
  label,
  invalid,
  className,
  ...props
}: { label: string; invalid: boolean } & ComponentProps<'input'>) {
  return (
    <label className={cn(segmentBox, className)}>
      <input
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className="w-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
        {...props}
      />
      <span className="shrink-0 text-caption text-ink-subtle">{label}</span>
    </label>
  )
}

/** 分段外框：与 form.tsx 的 fieldControl 同一套尺寸与色调，状态取自内部输入框 */
const segmentBox =
  'flex min-h-12 w-full min-w-0 cursor-text items-center gap-1 rounded-field border border-field-border bg-background px-3 has-focus-visible:outline-2 has-focus-visible:outline-ring has-focus-visible:outline-offset-2 has-aria-invalid:border-danger has-aria-invalid:ring-1 has-aria-invalid:ring-danger has-disabled:opacity-50'

interface PartSpec<K extends string> {
  readonly key: K
  readonly label: string
  readonly placeholder: string
  readonly maxLength: number
  /** 该段在栅格中占的列数（年份四位数，比月 / 日宽） */
  readonly span?: string
}

interface FieldProps {
  label: string
  /** 隐藏字段名：提交的值与原生控件一致 */
  name: string
  defaultValue?: string | undefined
  required?: boolean | undefined
  disabled?: boolean | undefined
  /** 由外部显示错误文字时只标记无效，并传入错误文字的 id */
  invalid?: boolean | undefined
  describedBy?: string | undefined
  /** 字段下方显示的错误文字（自带 id 关联） */
  error?: string | undefined
  /** 每次值变化时收到新的表单值（受控用法，如个人日即时计算） */
  onValueChange?: ((value: string) => void) | undefined
  className?: string | undefined
  /** 分段外框的额外样式（如所在卡片底色不同） */
  inputClassName?: string | undefined
  /** 标题行右侧的附属控件（如「不知道出生时辰」） */
  aside?: ReactNode
}

function SegmentedField<P extends Readonly<Record<string, string>>>({
  label,
  name,
  defaultValue = '',
  required,
  disabled,
  invalid,
  describedBy,
  error,
  onValueChange,
  className,
  inputClassName,
  aside,
  specs,
  split,
  join,
  gridClassName,
}: FieldProps & {
  specs: readonly PartSpec<keyof P & string>[]
  split: (value: string) => P
  join: (parts: P) => string
  gridClassName: string
}) {
  const labelId = useId()
  const errorId = useId()
  const hidden = useRef<HTMLInputElement>(null)
  // 分段为非受控输入：水合前已输入的内容由浏览器保留（受控输入会在水合时被重置为空）
  const inputs = useRef<Partial<Record<string, HTMLInputElement | null>>>({})
  const initial = split(defaultValue)
  // 监听器只注册一次，经 ref 取最新的回调与初始值
  const latest = useRef({ specs, split, join, onValueChange, defaultValue })
  latest.current = { specs, split, join, onValueChange, defaultValue }

  useEffect(() => {
    const input = hidden.current
    if (!input) return
    const { specs } = latest.current
    const read = () =>
      Object.fromEntries(
        specs.map((spec) => [spec.key, inputs.current[spec.key]?.value ?? '']),
      ) as unknown as P
    const publish = (value: string) => {
      input.value = value
      latest.current.onValueChange?.(value)
    }
    // 挂载时按分段的实际内容写入隐藏字段（含初始值与水合前的输入）
    const current = latest.current.join(read())
    if (current !== input.value) publish(current)
    // 外部直接写入隐藏字段（从档案填入表单）后派发 change：按新值写回各段
    const sync = () => {
      const parts = latest.current.split(input.value)
      for (const spec of specs) {
        const part = inputs.current[spec.key]
        if (part) part.value = parts[spec.key] ?? ''
      }
      latest.current.onValueChange?.(input.value)
    }
    // 表单 reset 会恢复各段的默认值，但不会恢复隐藏字段（其值即属性），这里手动回到初始值
    const reset = () => {
      const { split, join, defaultValue } = latest.current
      publish(join(split(defaultValue)))
    }
    const form = input.form
    input.addEventListener('change', sync)
    form?.addEventListener('reset', reset)
    return () => {
      input.removeEventListener('change', sync)
      form?.removeEventListener('reset', reset)
    }
  }, [])

  const update = () => {
    const parts = Object.fromEntries(
      specs.map((spec) => [spec.key, inputs.current[spec.key]?.value ?? '']),
    ) as unknown as P
    const value = join(parts)
    // 同步写入隐藏字段：表单的 onChange 在本次事件冒泡中就会读取 FormData，不能等重新渲染
    if (hidden.current) hidden.current.value = value
    onValueChange?.(value)
  }

  const isInvalid = Boolean(invalid || error)
  const described = error ? errorId : describedBy
  return (
    <fieldset
      aria-labelledby={labelId}
      data-field={name}
      className={cn('m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0', className)}
    >
      {/* 有附属控件时标题与它排成一行（legend 不能参与弹性布局）：legend 只给读屏，可见标题另行输出 */}
      <legend id={labelId} className={aside ? 'sr-only' : cn('mb-1.5 p-0', fieldLabel)}>
        {label}
      </legend>
      {aside ? (
        <div className="flex items-center justify-between gap-3">
          <span aria-hidden="true" className={fieldLabel}>
            {label}
          </span>
          {aside}
        </div>
      ) : null}
      <div className={cn('grid gap-2', gridClassName)}>
        {specs.map((spec) => (
          <DatePart
            key={spec.key}
            label={spec.label}
            data-part={spec.key}
            placeholder={spec.placeholder}
            maxLength={spec.maxLength}
            ref={(element) => {
              inputs.current[spec.key] = element
            }}
            defaultValue={initial[spec.key]}
            onChange={update}
            required={required}
            disabled={disabled}
            invalid={isInvalid}
            aria-describedby={described}
            className={cn(spec.span, inputClassName)}
          />
        ))}
      </div>
      {/* 隐藏字段的值只由本组件写入（挂载时与每次输入）：不交给 React 的 defaultValue，
          否则重新渲染时 React 会把属性（即隐藏字段的值）改回初始值 */}
      <input ref={hidden} type="hidden" name={name} disabled={disabled} />
      <FieldError id={errorId} error={error} />
    </fieldset>
  )
}

const dateSpecs = (): readonly PartSpec<keyof DateParts>[] => [
  {
    key: 'year',
    label: m.date_field_year(),
    placeholder: '1990',
    maxLength: 4,
    span: 'col-span-3',
  },
  {
    key: 'month',
    label: m.date_field_month(),
    placeholder: '5',
    maxLength: 2,
    span: 'col-span-2',
  },
  { key: 'day', label: m.date_field_day(), placeholder: '15', maxLength: 2, span: 'col-span-2' },
]

const timeSpecs = (): readonly PartSpec<keyof TimeParts>[] => [
  { key: 'hour', label: m.date_field_hour(), placeholder: '10', maxLength: 2 },
  { key: 'minute', label: m.date_field_minute(), placeholder: '30', maxLength: 2 },
]

/** 日期字段：年 / 月 / 日三段，提交 `YYYY-MM-DD`（各语言同一顺序，标签消除歧义） */
export function DateField(props: FieldProps) {
  return (
    <SegmentedField<DateParts>
      {...props}
      specs={dateSpecs()}
      split={splitDateValue}
      join={joinDateParts}
      gridClassName="grid-cols-7"
    />
  )
}

/** 时间字段：时（0–23）/ 分两段，提交 `HH:MM`；不显示上下午，避免随浏览器语言变化 */
export function TimeField(props: FieldProps) {
  return (
    <SegmentedField<TimeParts>
      {...props}
      specs={timeSpecs()}
      split={splitTimeValue}
      join={joinTimeParts}
      gridClassName="grid-cols-2"
    />
  )
}
