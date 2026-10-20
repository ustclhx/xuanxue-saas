import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { ogImagePath, originFromMatches, pageHead } from '../seo/metadata.ts'
import { formatDate } from './blog/post-list.tsx'
import { getLegalPage } from './content.functions.ts'
import { MarketingShell } from './marketing-shell.tsx'
import { RichContent } from './rich-content.tsx'

/**
 * 法律页只有四个，路径不带 /legal 前缀，只从页脚进入（launch-v1-production 法律页需求）。
 * 合规按语言而不是国家处理：先只有英文一份，其他语言的同一路径显示英文正文并标注，且不进索引。
 */
export const LEGAL_SLUGS = ['privacy', 'terms', 'disclaimer', 'refund'] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]
export const LEGAL_PATHS = LEGAL_SLUGS.map((slug) => `/${slug}` as const)

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
          // 分享图只为英文页生成
          ...(fallback
            ? { cover: ogImagePath({ path: `/${slug}`, locale: loaderData.locale }) }
            : {}),
        },
        originFromMatches(matches),
      )
      // 其他语言显示的是英文原文：不进索引，避免与英文页重复
      if (!fallback) return head
      return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex, follow' }] }
    },
  }
}

export function LegalPage({ page }: { page: LegalPageData }) {
  const fallback = page.locale !== getLocale()
  return (
    <MarketingShell>
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-16">
        {fallback && (
          <p
            role="note"
            className="m-0 rounded-lg border border-line px-4 py-3 text-ink-muted text-sm"
          >
            {m.marketing_legal_english_only()}
          </p>
        )}
        <article lang={page.locale} className="grid gap-4">
          <h1 className="font-bold text-4xl tracking-tight">{page.title}</h1>
          <RichContent html={page.html} />
          <footer className="mt-8 grid gap-1 border-line border-t pt-4 text-muted-foreground text-sm">
            <p className="m-0">Last updated: {formatDate(page.updatedAt, 'en')}</p>
            <p className="m-0">
              Contact:{' '}
              <a href={`mailto:${templateConfig.app.supportEmail}`} className="underline">
                {templateConfig.app.supportEmail}
              </a>
            </p>
          </footer>
        </article>
      </div>
    </MarketingShell>
  )
}
