import { useEffect, useRef } from 'react'
import { unlockShareOf } from '../../readings/unlock.ts'
import { readShareFragment, type ShareInput } from '../share.ts'

/**
 * 打开分享链接（`#r=`）时用其中的输入复现结果；只在挂载时读取一次。
 * 登录 / 支付回跳的 `?unlock=` 令牌同样携带分享输入（完整计算器的解锁卡在结果出现后才挂载）。
 */
export function useSharedInput(apply: (input: ShareInput) => void) {
  const applyRef = useRef(apply)
  applyRef.current = apply
  useEffect(() => {
    const shared = readShareFragment(window.location.hash) ?? unlockShareOf(window.location.search)
    if (shared) applyRef.current(shared)
  }, [])
}
