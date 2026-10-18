import { m } from '../../../paraglide/messages.js'
import { pageHead } from '../../seo/metadata.ts'
import type { EasternPageId } from './eastern-routes.ts'

/**
 * 东方站排盘页的 head：Title 按设计文档原文（不追加站名）；canonical 与 hreflang 由 pageHead
 * 按 TOOL_ROUTES 生成（繁中八字排盤 ↔ 韩语만세력互指）。
 */
export function easternToolHead(
  page: { path: string; locale: string; title: string; description: string },
  appUrl: string,
) {
  const head = pageHead(page, appUrl)
  return {
    ...head,
    meta: head.meta.map((item) => ('title' in item ? { title: page.title } : item)),
  }
}

/** 页面的 SEO 标题与描述（按当前语言的文案） */
export function easternPageCopy(id: EasternPageId | 'home'): {
  title: string
  description: string
} {
  switch (id) {
    case 'home':
      return { title: m.bazi_home_seo_title(), description: m.bazi_home_description() }
    case 'ziwei':
      return { title: m.bazi_ziwei_seo_title(), description: m.bazi_ziwei_description() }
    case 'mingpan':
      return { title: m.bazi_mingpan_seo_title(), description: m.bazi_mingpan_description() }
    case 'gunghap':
      return { title: m.bazi_gunghap_seo_title(), description: m.bazi_gunghap_description() }
  }
}
