import { m } from '../../../paraglide/messages.js'
import { pageHead } from '../../seo/metadata.ts'
import { breadcrumbData, webApplicationData } from '../../seo/structured-data.ts'
import { faqPageData } from '../numerology/seo.ts'
import type { EasternPageId } from './eastern-routes.ts'

/**
 * 东方站排盘页的 head：Title 为设计文档原文加站名（openspec separate-landing-homepage design.md D3a，
 * 由 pageHead 统一追加）；canonical 与 hreflang 由 pageHead 按 TOOL_ROUTES 生成
 * （繁中八字排盤 ↔ 简体八字排盘 ↔ 韩语만세력互指）。
 */
export function easternToolHead(
  page: { path: string; locale: string; title: string; description: string },
  appUrl: string,
  structuredData: readonly unknown[] = [],
) {
  return pageHead(page, appUrl, structuredData)
}

/** 页面的 SEO 标题与描述（按当前语言的文案） */
export function easternPageCopy(id: EasternPageId): {
  title: string
  description: string
} {
  switch (id) {
    // 八字排盤 / 만세력主工具页沿用迁移前语言首页的文案键（文字不变，键名不改以免四语文案重排）
    case 'bazi':
      return { title: m.bazi_home_seo_title(), description: m.bazi_home_description() }
    case 'ziwei':
      return { title: m.bazi_ziwei_seo_title(), description: m.bazi_ziwei_description() }
    case 'mingpan':
      return { title: m.bazi_mingpan_seo_title(), description: m.bazi_mingpan_description() }
    case 'gunghap':
      return { title: m.bazi_gunghap_seo_title(), description: m.bazi_gunghap_description() }
  }
}

/**
 * 八字排盤 / 만세력主工具页的结构化数据（design.md D3）：WebApplication、面包屑「首页 › 工具」与 FAQPage。
 * 问答与页面上可见的 FAQ 同一组文案（bazi-home.tsx、manseryeok-home.tsx 的 bazi_home_faq_*）。
 */
export function baziToolStructuredData(page: {
  path: string
  locale: string
  description: string
}) {
  return [
    webApplicationData(page, m.bazi_home_title()),
    breadcrumbData(
      [
        { name: m.marketing_nav_home(), path: '/' },
        { name: m.bazi_home_title(), path: page.path },
      ],
      page.locale,
    ),
    faqPageData([
      { question: m.bazi_home_faq_q1(), answer: m.bazi_home_faq_a1() },
      { question: m.bazi_home_faq_q2(), answer: m.bazi_home_faq_a2() },
      { question: m.bazi_home_faq_q3(), answer: m.bazi_home_faq_a3() },
    ]),
  ]
}
