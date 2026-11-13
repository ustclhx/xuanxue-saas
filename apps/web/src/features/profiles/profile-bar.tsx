import { cn } from '@xuanxue/ui'
import { lazy, Suspense, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import type { BirthFormValues } from '../tools/bazi/birth-form-state.ts'
import { useViewer } from '../workspace/viewer-store.ts'

/**
 * 工具表单头部的档案入口（add-birth-profiles-daily-horoscope tasks 6.1，原型 ProfileEdit.dc.html 下半）：
 * 「从档案带入」与「另存为档案」。只在页头已识别为登录态时出现（与账户菜单共用一次 viewer 读取），
 * 未登录与预渲染 HTML 中不渲染任何内容；档案列表、填入换算与保存对话框都在用户点击后才按需加载
 * （profile-picker-panel.tsx 单独成块），页面加载、离线计算与首屏包都不受影响。
 * 填入后的计算仍在浏览器本地完成；入口本身不上报埋点，提交时的 tool_submit 载荷按白名单构造。
 */

const PickerPanel = lazy(() => import('./profile-picker-panel.tsx'))
const SaveDialog = lazy(() =>
  import('./profile-picker-panel.tsx').then((module) => ({ default: module.SaveProfileDialog })),
)

/** 东方站排盘表单：一个人的字段（双人表单用 prefix 区分） */
export interface BirthTarget {
  readonly kind: 'birth'
  /** 紫微必须有出生时间 */
  readonly tool: 'bazi' | 'ziwei'
  readonly prefix?: string
  readonly onFill: (values: Partial<BirthFormValues>) => void
}

/**
 * 西方站数字命理表单：日期字段名 birthDate，姓名字段名 name（表单有哪个就填哪个）。
 * 这些表单是非受控控件，填入时直接写所在表单的控件值，不重新挂载，用户已输入的其他字段保持不变。
 */
export interface NumerologyTarget {
  readonly kind: 'numerology'
  readonly date: boolean
  readonly name: boolean
}

export type ProfileBarTarget = BirthTarget | NumerologyTarget

/** 操作结果提示：主句与需要补全的字段提示 */
export type BarNotice = { readonly text: string; readonly hints: readonly string[] }

/**
 * 东方站填入后页面会以新值重新挂载整张表单（含本入口），提示需要跨过这次重新挂载：
 * 填入前按表单位置（prefix）暂存，新挂载的入口取出后删除。
 */
const carried = new Map<string, { notice: BarNotice; at: number }>()
const CARRY_MS = 2000
const carryKey = (target: ProfileBarTarget) =>
  target.kind === 'birth' ? `birth:${target.prefix ?? ''}` : 'numerology'

const pill =
  'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2'

export function ProfileBar({
  target,
  className,
}: {
  target: ProfileBarTarget
  className?: string
}) {
  const viewer = useViewer()
  const ref = useRef<HTMLDivElement>(null)
  const [picking, setPicking] = useState(false)
  const [saveForm, setSaveForm] = useState<HTMLFormElement | null>(null)
  const [notice, setNotice] = useState<BarNotice | null>(() => {
    const key = carryKey(target)
    const entry = carried.get(key)
    carried.delete(key)
    // 只接收刚刚发生的填入，避免旧提示出现在之后打开的页面
    return entry && Date.now() - entry.at < CARRY_MS ? entry.notice : null
  })
  const space = viewer?.signedIn ? viewer.spaces.find((item) => item.isPersonal) : undefined
  if (!space) return null
  const canSave = target.kind === 'birth' || target.date
  const loading = (
    <p role="status" className="m-0 text-ink-muted text-sm">
      {m.profiles_pick_loading()}
    </p>
  )

  return (
    <div
      ref={ref}
      data-profile-bar=""
      className={cn('col-span-full flex min-w-0 flex-col gap-2', className)}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          aria-expanded={picking}
          onClick={() => {
            setNotice(null)
            setPicking((open) => !open)
          }}
          className={cn(pill, 'border-brand text-ink hover:bg-surface-2')}
        >
          {m.profiles_pick()}
          <span aria-hidden="true">{picking ? '▴' : '▾'}</span>
        </button>
        {canSave ? (
          <button
            type="button"
            onClick={() => {
              setPicking(false)
              setNotice(null)
              setSaveForm(ref.current?.closest('form') ?? null)
            }}
            className={cn(pill, 'border-line-strong text-ink-muted hover:bg-surface-2')}
          >
            {m.profiles_save_as()}
          </button>
        ) : null}
      </div>
      {picking ? (
        <Suspense fallback={loading}>
          <PickerPanel
            slug={space.slug}
            target={target}
            form={() => ref.current?.closest('form') ?? null}
            onBeforeFill={(next) => carried.set(carryKey(target), { notice: next, at: Date.now() })}
            onDone={(next) => {
              setPicking(false)
              setNotice(next)
            }}
          />
        </Suspense>
      ) : null}
      {notice ? (
        <div role="status" className="flex flex-col gap-0.5 text-sm">
          <span className="text-ink-muted">{notice.text}</span>
          {notice.hints.map((hint) => (
            <span key={hint} className="text-brand-ink">
              {hint}
            </span>
          ))}
        </div>
      ) : null}
      {saveForm ? (
        <Suspense fallback={null}>
          <SaveDialog
            slug={space.slug}
            target={target}
            form={saveForm}
            onDone={(next) => {
              setSaveForm(null)
              if (next) setNotice(next)
            }}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
