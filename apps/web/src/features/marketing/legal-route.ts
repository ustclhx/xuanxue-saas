import { getLocale } from '../../paraglide/runtime.js'
import { ogImagePath, originFromMatches, pageHead } from '../seo/metadata.ts'
import { getLegalPage } from './content.functions.ts'
import type { LegalSlug } from './legal-tokens.ts'

/**
 * 法律页只有四个，路径不带 /legal 前缀，只从页脚进入（launch-v1-production 法律页需求）。
 * 正文按站点分开（product-improve-ai-content D4），两站共用一段运营主体说明；站点缺少某种语言时
 * 显示同站点默认语言的正文并标注，且不进索引。
 *
 * 路由选项（loader、head）不随页面组件拆分，会进入客户端入口：单独成模块，避免把法律页版式、博客列表
 * 与正文渲染带进首页的静态闭包（check-home-bundle 的 gzip 预算）。
 */

type LegalPageData = Awaited<ReturnType<typeof getLegalPage>>

export function legalRouteOptions(slug: LegalSlug) {
  return {
    loader: () => getLegalPage({ data: { locale: getLocale(), slug } }),
    head: ({
      loaderData,
      matches,
    }: {
      loaderData?: LegalPageData
      matches: Parameters<typeof originFromMatches>[0]
    }) => {
      if (!loaderData) return {}
      const locale = getLocale()
      const fallback = loaderData.locale !== locale
      const head = pageHead(
        {
          path: `/${slug}`,
          locale,
          title: loaderData.title,
          description: loaderData.description,
          // 分享图只为有原文的语言生成
          ...(fallback
            ? { cover: ogImagePath({ path: `/${slug}`, locale: loaderData.locale }) }
            : {}),
        },
        originFromMatches(matches),
      )
      // 回退显示的是另一语言的原文：不进索引，避免与原文页重复
      if (!fallback) return head
      return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex, follow' }] }
    },
  }
}
