import { useRouter } from '@tanstack/react-router'
import { cn } from '@xuanxue/ui'
import {
  type ComponentProps,
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react'
import { m } from '../../paraglide/messages.js'
import { useTool } from './context.tsx'

/** 表单是否已水合：水合前提交按钮禁用，避免原生提交 */
const FormReadyContext = createContext(true)

/**
 * 当前页的公开地址（含语言前缀，不含查询串与片段），作为原生提交的兜底 action；
 * 不在路由内渲染（组件单测）时返回 undefined。
 */
function useCurrentPath(): string | undefined {
  const router = useRouter({ warn: false })
  const href = router?.state.location.publicHref
  return href ? new URL(href, 'http://localhost').pathname : undefined
}

/**
 * 工具页内联表单（视觉规范「布局与组件」）：真实 <label>，单选组用 <fieldset>/<legend>，
 * 所有控件 ≥44px、16px 字号（避免移动端缩放）。提交时上报 tool_submit（不含任何表单值），
 * 再把 FormData 交给工具在浏览器本地计算。
 *
 * 隐私：表单含出生日期等个人信息，绝不能以原生 GET 提交（会进入查询串、服务端日志与浏览器历史）。
 * 因此 method 固定为 post、action 为当前页无查询串地址，且提交按钮在水合前禁用；
 * 禁用脚本时显示提示（requiresJs）。
 */
export function ToolForm({
  label,
  onSubmit,
  onChange,
  requiresJs,
  className,
  children,
}: {
  label: string
  onSubmit: (data: FormData) => void
  /** 任一控件变化时收到整张表单的值（如跨页保留输入、按选项显示字段） */
  onChange?: (data: FormData) => void
  /** 禁用脚本时的提示，默认通用文案 */
  requiresJs?: string
  className?: string
  children: ReactNode
}) {
  const { track } = useTool()
  const action = useCurrentPath()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    track('tool_submit')
    onSubmit(new FormData(event.currentTarget))
  }
  return (
    <form
      aria-label={label}
      method="post"
      action={action}
      onSubmit={submit}
      onChange={onChange && ((event) => onChange(new FormData(event.currentTarget)))}
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5 gap-y-4 rounded-xl border border-line bg-surface p-4 sm:p-6',
        className,
      )}
    >
      <FormReadyContext value={ready}>{children}</FormReadyContext>
      <noscript>
        <p className="m-0 self-center text-brand-ink text-sm">
          {requiresJs ?? m.tools_requires_js()}
        </p>
      </noscript>
    </form>
  )
}

const control =
  'min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1'

/** 字段级错误：控件标记 aria-invalid，并用 aria-describedby 关联错误文字 */
function FieldError({ id, error }: { id: string; error?: string | undefined }) {
  return error ? (
    <span id={id} className="text-brand-ink text-sm">
      {error}
    </span>
  ) : null
}

export function TextField({
  label,
  error,
  className,
  ...props
}: { label: string; error?: string | undefined } & ComponentProps<'input'>) {
  const errorId = useId()
  return (
    <label className={cn('flex flex-col gap-1.5 text-ink-muted text-sm', className)}>
      {label}
      <input
        className={cn(control, 'aria-invalid:border-brand disabled:opacity-50')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      <FieldError id={errorId} error={error} />
    </label>
  )
}

export function SelectField({
  label,
  options,
  error,
  className,
  ...props
}: {
  label: string
  options: readonly { value: string; label: string }[]
  error?: string | undefined
} & ComponentProps<'select'>) {
  const errorId = useId()
  return (
    <label className={cn('flex flex-col gap-1.5 text-ink-muted text-sm', className)}>
      {label}
      <select
        className={cn(control, 'px-2.5 aria-invalid:border-brand')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} error={error} />
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
  const ready = useContext(FormReadyContext)
  return (
    <button
      type="submit"
      disabled={!ready}
      className={cn(
        'min-h-12 self-end rounded-lg bg-brand px-6 font-semibold text-[17px] text-on-brand tracking-wide transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  )
}
