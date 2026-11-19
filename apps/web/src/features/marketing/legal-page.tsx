import { supportEmail } from '@xuanxue/config'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { ogImagePath, originFromMatches, pageHead } from '../seo/metadata.ts'
import { formatDate } from './blog/post-list.tsx'
import { getLegalPage } from './content.functions.ts'
import { ContentHead, ContentPage, MetaLine } from './content-page.tsx'
import { type LegalSlug, SUPPORT_EMAIL_TOKEN } from './legal-tokens.ts'
import { MarketingShell } from './marketing-shell.tsx'
import { RichContent } from './rich-content.tsx'

/**
 * 法律页只有四个，路径不带 /legal 前缀，只从页脚进入（launch-v1-production 法律页需求）。
 * 正文按站点分开（product-improve-ai-content D4），两站共用一段运营主体说明；站点缺少某种语言时
 * 显示同站点默认语言的正文并标注，且不进索引。
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

/**
 * 法律页版式（设计稿 warm-refresh/Legal.dc.html）：H1、一行「最后更新」元信息，正文限宽 720px。
 * 正文内链（服务条款、退款政策等）写在各页的 MDX 里；联系邮箱在正文末尾。
 */
export function LegalPage({ page }: { page: LegalPageData }) {
  const fallback = page.locale !== getLocale()
  // 联系邮箱按当前站点替换构建时留下的标记
  const email = supportEmail(templateConfig, getLocale())
  const html = page.html.replaceAll(SUPPORT_EMAIL_TOKEN, email)
  return (
    <MarketingShell>
      <ContentPage>
        <ContentHead title={<span lang={page.locale}>{page.title}</span>}>
          <MetaLine
            items={[m.marketing_legal_updated({ date: formatDate(page.updatedAt, page.locale) })]}
          />
          {fallback && (
            <p role="note" className="m-0 rounded-field bg-surface-2 px-4 py-3 text-body text-ink">
              {m.marketing_legal_english_only()}
            </p>
          )}
        </ContentHead>
        <article
          lang={page.locale}
          aria-label={page.title}
          className="flex max-w-180 flex-col gap-5"
        >
          <RichContent html={html} />
          <p className="m-0 text-caption text-ink-subtle">
            {m.marketing_legal_contact()}{' '}
            <a href={`mailto:${email}`} className="text-brand-ink">
              {email}
            </a>
          </p>
        </article>
      </ContentPage>
    </MarketingShell>
  )
}
