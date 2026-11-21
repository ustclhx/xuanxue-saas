import { getLocale } from '../../../paraglide/runtime.js'

/**
 * 东方站八字组件（八字排盤 / 四柱推命、紫微斗数）页面的语言：简体访客（`/zh-hans/`）用 zh-Hans，
 * 日语访客（`/ja/`）用 ja，其余页面用 zh-Hant。
 * 只在渲染时调用，不放在模块顶层，避免服务端按请求读取语言时使用过期值。
 */
export function eastChineseLocale(): 'zh-Hant' | 'zh-Hans' | 'ja' {
  const locale = getLocale()
  return locale === 'zh-Hans' || locale === 'ja' ? locale : 'zh-Hant'
}
