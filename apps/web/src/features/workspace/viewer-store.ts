import { useEffect, useState } from 'react'
import { getViewerSpaces } from './viewer.functions.ts'

/**
 * 当前访客（是否登录与可进入的空间）的页面级共享读取：页头账户菜单与工具页的档案入口共用同一次请求
 * （add-birth-profiles-daily-horoscope design D4「复用页头的 viewer 状态，不另发请求」）。
 * 只在浏览器水合后调用；请求失败按未登录处理，且允许之后重试。
 */
export type Viewer = Awaited<ReturnType<typeof getViewerSpaces>>

const SIGNED_OUT: Viewer = { signedIn: false, name: '', spaces: [] }
let pending: Promise<Viewer> | undefined

export function loadViewer(): Promise<Viewer> {
  pending ??= getViewerSpaces().catch(() => {
    pending = undefined
    return SIGNED_OUT
  })
  return pending
}

/** 测试与登录状态变化后清除缓存 */
export function resetViewer(): void {
  pending = undefined
}

/** 水合前与读取中为 null */
export function useViewer(): Viewer | null {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  useEffect(() => {
    let active = true
    void loadViewer().then((value) => {
      if (active) setViewer(value)
    })
    return () => {
      active = false
    }
  }, [])
  return viewer
}
