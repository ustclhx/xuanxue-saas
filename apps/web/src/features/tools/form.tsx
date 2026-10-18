import { cn } from '@xuanxue/ui'
import type { ComponentProps, FormEvent, ReactNode } from 'react'
import { useTool } from './context.tsx'

/**
 * 工具页内联表单（视觉规范「布局与组件」）：真实 <label>，单选组用 <fieldset>/<legend>，
 * 所有控件 ≥44px、16px 字号（避免移动端缩放）。提交时上报 tool_submit（不含任何表单值），
 * 再把 FormData 交给工具在浏览器本地计算。
 */
export function ToolForm({
  label,
  onSubmit,
  className,
  children,
}: {
  label: string
  onSubmit: (data: FormData) => void
  className?: string
  children: ReactNode
}) {
  const { track } = useTool()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    track('tool_submit')
    onSubmit(new FormData(event.currentTarget))
  }
  return (
    <form
      aria-label={label}
      onSubmit={submit}
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5 gap-y-4 rounded-xl border border-line bg-surface p-4 sm:p-6',
        className,
      )}
    >
      {children}
    </form>
  )
}

const control =
  'min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1'

export function TextField({
  label,
  className,
  ...props
}: { label: string } & ComponentProps<'input'>) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-ink-muted text-sm', className)}>
      {label}
      <input className={control} {...props} />
    </label>
  )
}

export function SelectField({
  label,
  options,
  className,
  ...props
}: {
  label: string
  options: readonly { value: string; label: string }[]
} & ComponentProps<'select'>) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-ink-muted text-sm', className)}>
      {label}
      <select className={cn(control, 'px-2.5')} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CheckboxField({
  label,
  className,
  ...props
}: { label: string } & Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <label className={cn('flex min-h-11 items-center gap-2.5 text-[15px] text-ink', className)}>
      <input type="checkbox" className="size-5 accent-[var(--accent)]" {...props} />
      {label}
    </label>
  )
}

/**
 * 分段单选组：原生 radio 视觉隐藏但保留焦点与方向键切换，选中项用反色块（视觉规范原型的曆法 / 性別）。
 */
export function ChoiceGroup({
  legend,
  name,
  options,
  defaultValue,
  className,
}: {
  legend: string
  name: string
  options: readonly { value: string; label: string }[]
  defaultValue?: string
  className?: string
}) {
  return (
    <fieldset className={cn('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)}>
      <legend className="mb-2 p-0 text-ink-muted text-sm">{legend}</legend>
      <div className="flex gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-line-strong text-[15px] text-ink transition-colors has-checked:border-inverse has-checked:bg-inverse has-checked:text-on-inverse has-focus-visible:outline-2 has-focus-visible:outline-ring has-focus-visible:outline-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === (defaultValue ?? options[0]?.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function SubmitButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={cn(
        'min-h-12 self-end rounded-lg bg-brand px-6 font-semibold text-[17px] text-on-brand tracking-wide transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        className,
      )}
    >
      {children}
    </button>
  )
}
