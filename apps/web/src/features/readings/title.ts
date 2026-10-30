import { m } from '../../paraglide/messages.js'
import { getLocale, type Locale } from '../../paraglide/runtime.js'

// 报告页路由的 head 也要用标题：单独成模块，避免把解锁卡组件带进主入口
const KIND_TITLE: Record<string, typeof m.readings_kind_bazi_full> = {
  'bazi-full': m.readings_kind_bazi_full,
  'saju-full': m.readings_kind_saju_full,
  'ziwei-full': m.readings_kind_ziwei_full,
  'saju-compat': m.readings_kind_saju_compat,
  'numerology-full': m.readings_kind_numerology_full,
  'tarot-spread': m.readings_kind_tarot_spread,
}

export function readingTitle(kind: string, locale: string = getLocale()): string {
  // 报告的 kind 与 locale 均已保存；查看时切换界面语言不应改变报告标题。
  return KIND_TITLE[kind]?.({}, { locale: locale as Locale }) ?? kind
}
