import { useEffect, useRef } from 'react'
import { readShareFragment, type ShareInput } from '../share.ts'

/** 打开分享链接（`#r=`）时用其中的输入复现结果；只在挂载时读取一次 */
export function useSharedInput(apply: (input: ShareInput) => void) {
  const applyRef = useRef(apply)
  applyRef.current = apply
  useEffect(() => {
    const shared = readShareFragment(window.location.hash)
    if (shared) applyRef.current(shared)
  }, [])
}
