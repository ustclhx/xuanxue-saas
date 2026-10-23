import { getLocale } from '../../../paraglide/runtime.js'

/**
 * 东方站中文排盘页的语言：简体访客（`/zh-hans/`）用 zh-Hans，其余中文页面用 zh-Hant。
 * 只在渲染时调用，不放在模块顶层，避免服务端按请求读取语言时使用过期值。
 */
export function eastChineseLocale(): 'zh-Hant' | 'zh-Hans' {
  return getLocale() === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant'
}
