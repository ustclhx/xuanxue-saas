import { type ComponentType, useEffect, useState } from 'react'

/**
 * 语言建议提示的按需加载（locale-prompt.tsx）：提示本来就在水合后浏览器空闲时才出现，
 * 组件与六种语言文案不必进入首页脚本闭包（首页包预算，openspec add-locales-eu-ja 决策 11）。
 * 服务端与首次渲染输出 null，与 SSR HTML 一致。
 */
export function LocalePromptLoader() {
  const [Prompt, setPrompt] = useState<ComponentType | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = () => {
      void import('./locale-prompt.tsx').then((module) => {
        if (!cancelled) setPrompt(() => module.LocalePrompt)
      })
    }
    const idle = window.requestIdleCallback
    const id = idle ? idle(load, { timeout: 3000 }) : window.setTimeout(load, 1)
    return () => {
      cancelled = true
      if (idle) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
  }, [])
  return Prompt ? <Prompt /> : null
}
