import type { BirthInput, InputIssue } from '@xuanxue/bazi'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readShareFragment, type ShareInput } from '../share.ts'
import {
  BIRTH_STORAGE_KEY,
  type BirthFormValues,
  defaultBirthValues,
  fromShareInput,
  loadBirthValues,
  readBirthForm,
  saveBirthValues,
  sessionStore,
  toBirthInput,
} from './birth-form-state.ts'

export type ToolState<R> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'invalid'; readonly issues: readonly InputIssue[] }
  | { readonly status: 'error' }
  | { readonly status: 'done'; readonly result: R }

/** 引擎的 BaziInputError；按形状判断，八字与紫微两个 chunk 各自加载也能识别 */
export function inputIssuesOf(error: unknown): InputIssue[] | null {
  if (
    error instanceof Error &&
    error.name === 'BaziInputError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  )
    return (error as Error & { issues: InputIssue[] }).issues
  return null
}

/**
 * 一个人的表单值：挂载后从 sessionStorage 恢复（切页保留），变化时写回；
 * 恢复时更换 formKey，让非受控控件以新值重新挂载。
 */
export function useBirthValues(
  storageKey: string,
  locale: string,
  initial?: Partial<BirthFormValues>,
) {
  // 默认值只在挂载时确定（initial 为页面常量）
  const [defaults] = useState(() => ({ ...defaultBirthValues(locale), ...initial }))
  const [values, setValues] = useState(defaults)
  const [formKey, setFormKey] = useState(0)
  const restore = useCallback((next: BirthFormValues) => {
    setValues(next)
    setFormKey((key) => key + 1)
  }, [])
  const update = useCallback(
    (next: BirthFormValues) => {
      setValues(next)
      saveBirthValues(sessionStore(), storageKey, next)
    },
    [storageKey],
  )
  const loadStored = useCallback(
    () => loadBirthValues(sessionStore(), storageKey, defaults),
    [storageKey, defaults],
  )
  return { values, formKey, defaults, restore, update, loadStored }
}

/** 打开分享链接（`#r=`）时读取输入；只在挂载时读取一次 */
export function useShareFragment(onShared: (shared: ShareInput) => void, onNone: () => void) {
  const handlers = useRef({ onShared, onNone })
  handlers.current = { onShared, onNone }
  useEffect(() => {
    const shared = readShareFragment(window.location.hash)
    if (shared) handlers.current.onShared(shared)
    else handlers.current.onNone()
  }, [])
}

/** 提交后把结果区滚到视口（手机上结果在表单下方）；减少动态效果时直接跳转 */
export function scrollToResult(blockId = 'result') {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  document.getElementById(blockId)?.scrollIntoView({
    behavior: reduce ? 'auto' : 'smooth',
    block: 'start',
  })
}

/**
 * 单人排盘工具（八字、紫微、命盘查询、만세력）：恢复输入 → 提交 → 懒加载引擎计算 → 结果或字段错误。
 * 分享链接优先于已保存的输入，并直接出结果。
 */
export function useBirthTool<R>({
  locale,
  compute,
  focusBlock,
  initial,
}: {
  locale: string
  /** 页面级默认值（如韩语页진태양시开关） */
  initial?: Partial<BirthFormValues>
  compute: (input: BirthInput) => Promise<R>
  /** 概念页嵌入时提交后滚动到的区块 id */
  focusBlock?: string | undefined
}) {
  const person = useBirthValues(BIRTH_STORAGE_KEY, locale, initial)
  const [state, setState] = useState<ToolState<R>>({ status: 'idle' })
  const [submitted, setSubmitted] = useState<BirthFormValues | null>(null)
  const pendingScroll = useRef(false)

  const run = useCallback(
    async (values: BirthFormValues) => {
      const parsed = toBirthInput(values)
      if (!parsed.ok) {
        setState({ status: 'invalid', issues: parsed.issues })
        return
      }
      setState({ status: 'loading' })
      try {
        const result = await compute(parsed.input)
        setSubmitted(values)
        pendingScroll.current = true
        setState({ status: 'done', result })
      } catch (error) {
        const issues = inputIssuesOf(error)
        setState(issues ? { status: 'invalid', issues } : { status: 'error' })
      }
    },
    [compute],
  )

  useEffect(() => {
    if (state.status !== 'done' || !pendingScroll.current) return
    pendingScroll.current = false
    scrollToResult(focusBlock)
  }, [state, focusBlock])

  const { restore, update, defaults, loadStored } = person
  useShareFragment(
    (shared) => {
      const values = fromShareInput(shared, defaults)
      if (!values) return
      restore(values)
      void run(values)
    },
    () => {
      const stored = loadStored()
      if (stored) restore(stored)
    },
  )

  const onChange = useCallback((data: FormData) => update(readBirthForm(data)), [update])
  const onSubmit = useCallback(
    (data: FormData) => {
      const values = readBirthForm(data)
      update(values)
      void run(values)
    },
    [update, run],
  )
  const issues = state.status === 'invalid' ? state.issues : []
  return { ...person, state, submitted, issues, onChange, onSubmit }
}
