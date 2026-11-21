import type { AnyRouteMatch } from '@tanstack/react-router'
import { m } from '../../../paraglide/messages.js'
import { breadcrumbData, webApplicationData } from '../../seo/structured-data.ts'
import { getNumerologyPage, type NumerologyPage } from './content.functions.ts'
import { toolFaq } from './copy.ts'
import {
  isNumerologyLocale,
  type NumerologyLocale,
  type NumerologyPageId,
  type NumerologyToolId,
  numerologyPageOfPath,
  numerologyPath,
  numerologyTool,
} from './routes.ts'
import { faqItems, numerologyHead } from './seo.ts'

/**
 * routes/$slug.tsx 中本地化路径的数字命理单段页面（add-locales-eu-ja 决策 2，首页包预算见 slug-page.tsx）：
 * 英语保留各自的路由文件，地址与输出不变；新语言（es）的单段页面经 `/$slug` 匹配到这里。
 */
export interface NumerologySlugMatch {
  readonly locale: NumerologyLocale
  readonly id: NumerologyPageId
}

/** `/$slug` 的 slug 在该语言下对应的数字命理页面；英语与其他语言返回 undefined */
export function numerologySlugPage(locale: string, slug: string): NumerologySlugMatch | undefined {
  if (locale === 'en' || !isNumerologyLocale(locale)) return undefined
  const id = numerologyPageOfPath(`/${slug}`, locale)
  return id && { locale, id }
}

/** loader：正文页（Life Path 工具页长文与两个枢纽页）读取内容集合 */
export async function numerologySlugContent({
  locale,
  id,
}: NumerologySlugMatch): Promise<NumerologyPage | null> {
  // 正文页：Life Path 工具页的长文（life-path-number）与两个枢纽页（slug 与页面 id 相同）
  const slug =
    id === 'life-path'
      ? 'life-path-number'
      : id === 'destiny-number' || id === 'soul-urge-number'
        ? id
        : null
  return slug ? getNumerologyPage({ data: { slug, locale } }) : null
}

/** head：与英文对应路由文件相同的 Title、description、FAQPage 与结构化数据 */
export function numerologySlugHead(
  { locale, id }: NumerologySlugMatch,
  content: NumerologyPage | null,
  matches: readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[],
) {
  const path = numerologyPath(id, locale)
  if (!content)
    return numerologyHead(
      { ...numerologyTool(id as NumerologyToolId, locale), locale },
      matches,
      toolFaq(id as NumerologyToolId),
    )
  const page = { path, locale, title: content.title, description: content.description }
  const extra =
    id === 'life-path'
      ? [
          webApplicationData(page, m.numerology_home_title()),
          breadcrumbData(
            [
              { name: m.marketing_nav_home(), path: '/' },
              { name: m.numerology_number_life_path(), path },
            ],
            locale,
          ),
        ]
      : []
  return numerologyHead(page, matches, faqItems(content.faq), extra)
}
