import { useRouter } from '@tanstack/react-router'
import { cn, Select, SelectContent, SelectItem, SelectTrigger } from '@xuanxue/ui'
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
 * 工具页内联表单（视觉规范「布局与组件」；设计稿 docs/design/prototypes/warm-refresh/ToolBazi.dc.html）：
 * 表单面板是工具区唯一抬起的对象（surface、14px 圆角、浅色主题带阴影，不画边框）；≥ 640px 两列，手机单列。
 * 真实 <label>，单选组用 <fieldset>/<legend>，所有控件 ≥ 44px、正文字号（≥ 16px，避免移动端缩放）。提交时上报 tool_submit（不含任何表单值），
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
        'grid max-w-190 grid-cols-1 gap-x-6 gap-y-4 rounded-object bg-surface p-6 shadow-raise sm:grid-cols-2 sm:p-8',
        className,
      )}
    >
      <FormReadyContext value={ready}>{children}</FormReadyContext>
      <noscript>
        <p className="col-span-full m-0 text-caption text-danger">
          {requiresJs ?? m.tools_requires_js()}
        </p>
      </noscript>
    </form>
  )
}

/** 字段标签与提示：caption 字号 */
export const fieldLabel = 'text-caption text-ink-muted'
/** 输入控件：页面底色填充、对比度 ≥ 3:1 的外框、6px 圆角、48px 高；错误态用 danger 外框 */
export const fieldControl =
  'min-h-12 w-full min-w-0 rounded-field border border-field-border bg-background px-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger disabled:opacity-50'

/** 字段级错误：控件标记 aria-invalid，并用 aria-describedby 关联错误文字；只在错误态使用 danger 色 */
export function FieldError({
  id,
  error,
  alert = false,
}: {
  id?: string
  error?: string | undefined
  /** 提交后才出现的错误用 role="alert" 播报 */
  alert?: boolean
}) {
  return error ? (
    <span
      id={id}
      role={alert ? 'alert' : undefined}
      className="flex items-start gap-1.5 text-caption text-danger"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="mt-0.5 shrink-0"
      >
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6.5v4.5M10 13.6v.2" />
      </svg>
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
    <label className={cn('flex min-w-0 flex-col gap-1.5', fieldLabel, className)}>
      {label}
      <input
        className={fieldControl}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      <FieldError id={errorId} error={error} />
    </label>
  )
}

/**
 * 下拉选择：`@xuanxue/ui` 的 Select（不使用原生 <select>，docs/design-system.md §4.1）。
 * 表单为非受控：`name` 交给 Select，它渲染隐藏的原生控件，FormData、表单的 change 事件与 `#r=` 分享恢复
 * （页面更换 key 重新挂载、传入新的 defaultValue）都与原生控件一致。
 * `valueLabel` 让服务端输出与预渲染页直接显示当前选项的文字，不必等列表挂载。
 */
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  error,
  disabled,
  required,
  className,
}: {
  label: string
  name: string
  options: readonly { value: string; label: string }[]
  defaultValue?: string | undefined
  error?: string | undefined
  disabled?: boolean | undefined
  required?: boolean | undefined
  className?: string
}) {
  const id = useId()
  const errorId = useId()
  const [value, setValue] = useState(defaultValue ?? '')
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <Select
        name={name}
        value={value}
        onValueChange={setValue}
        {...(disabled !== undefined && { disabled })}
        {...(required !== undefined && { required })}
      >
        <SelectTrigger
          id={id}
          placeholder={label}
          valueLabel={options.find((option) => option.value === value)?.label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(fieldControl, 'justify-between')}
        />
        <SelectContent>
          {options.map((option, index) => (
            <SelectItem key={option.value} index={index} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} error={error} />
    </div>
  )
}

export function CheckboxField({
  label,
  className,
  ...props
}: { label: string } & Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <label
      className={cn('flex min-h-11 items-center gap-2 text-caption text-ink-muted', className)}
    >
      <input type="checkbox" className="size-5 shrink-0 accent-primary" {...props} />
      {label}
    </label>
  )
}

/**
 * 分段单选组：原生 radio 视觉隐藏但保留焦点与方向键切换；surface-2 轨道，选中项为页面底色加细线
 * （设计稿的曆法 / 性別）。`compact` 用于放在字段标签行右侧的小号切换（曆法）。
 */
export function ChoiceGroup({
  legend,
  name,
  options,
  defaultValue,
  compact = false,
  className,
}: {
  legend: string
  name: string
  options: readonly { value: string; label: string }[]
  defaultValue?: string
  compact?: boolean
  className?: string
}) {
  return (
    <fieldset
      className={cn(
        'm-0 flex min-w-0 border-0 p-0',
        compact ? 'items-center' : 'flex-col gap-1.5',
        className,
      )}
    >
      <legend className={cn('p-0', compact ? 'sr-only' : fieldLabel)}>{legend}</legend>
      <div className={cn('flex gap-0.5 rounded-field bg-surface-2 p-1', !compact && 'min-h-12')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors has-checked:bg-surface has-checked:text-ink has-checked:ring-1 has-checked:ring-line has-focus-visible:outline-2 has-focus-visible:outline-ring has-focus-visible:outline-offset-2',
              compact ? 'min-h-9 px-3.5 text-caption' : 'min-h-10 text-body',
            )}
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
        // 主按钮：药丸形、文字色填充；手机占满一行，桌面按内容宽度靠左，单独占一行。
        // 打印默认不输出背景色，白字会印不出来；按钮在纸面上无用，不打印
        'col-span-full inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-7 font-medium text-body text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56 sm:justify-self-start print:hidden',
        className,
      )}
    >
      {children}
    </button>
  )
}
