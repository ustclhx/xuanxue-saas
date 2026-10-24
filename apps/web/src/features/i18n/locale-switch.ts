import { useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { type Locale, locales, localizeUrl } from '../../paraglide/runtime.js'
import { isAppAreaPath } from './app-area.ts'
import { saveLanguagePreference } from './preference.functions.ts'
import { rememberLocale } from './preference.ts'
import { switchLocalePath } from './switch-path.ts'

/** 切换语言：保存账号语言、记住本设备选择，再整页导航到目标语言的同一页面 */
export function useLocaleSwitch() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function select(next: Locale) {
    setBusy(true)
    setError(null)
    try {
      await saveLanguagePreference({ data: next })
      rememberLocale(next)
      // 完整导航让账号语言、SSR 与客户端同时刷新；营销页始终以目的 URL 为准。
      // 工具页各语言路径不同，先按注册表换成目标语言的页面，再加语言前缀
      if (isAppAreaPath(window.location.pathname)) window.location.assign(window.location.href)
      else {
        const url = new URL(window.location.href)
        url.pathname = encodeURI(switchLocalePath(url.pathname, next, locales))
        window.location.assign(localizeUrl(url, { locale: next }).href)
      }
    } catch {
      setError(m.i18n_save_failed())
      setBusy(false)
    }
  }
  return { busy, error, select }
}
