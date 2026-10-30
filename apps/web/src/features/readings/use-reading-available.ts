import { useEffect, useState } from 'react'
import { getLocale } from '../../paraglide/runtime.js'
import { getReadingOffer } from './readings.functions.ts'

/**
 * 某种详批在当前语言下是否可解锁（product-improve-ai-content 决策 5）：与解锁卡读取同一报价接口，
 * 只在客户端挂载后读取。服务端渲染与预渲染阶段、读取中、读取失败时均返回 false，
 * 因此引导入口默认隐藏，不会在详批关闭或数据库不可达时承诺可以解锁。
 */
export function useReadingAvailable(kind: string): boolean {
  const locale = getLocale()
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let active = true
    getReadingOffer({ data: { kind, locale } })
      .then((offer) => {
        if (active) setAvailable(offer.available)
      })
      .catch(() => {
        if (active) setAvailable(false)
      })
    return () => {
      active = false
    }
  }, [kind, locale])
  return available
}
