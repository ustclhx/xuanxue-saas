import { supportEmail } from '@xuanxue/config'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { ogImagePath, originFromMatches, pageHead } from '../seo/metadata.ts'
import { formatDate } from './blog/post-list.tsx'
import { getLegalPage } from './content.functions.ts'
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

export function LegalPage({ page }: { page: LegalPageData }) {
  const fallback = page.locale !== getLocale()
  // 联系邮箱按当前站点替换构建时留下的标记
  const email = supportEmail(templateConfig, getLocale())
  const html = page.html.replaceAll(SUPPORT_EMAIL_TOKEN, email)
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
          <RichContent html={html} />
          <footer className="mt-8 grid gap-1 border-line border-t pt-4 text-muted-foreground text-sm">
            <p className="m-0">
              {m.marketing_legal_updated({ date: formatDate(page.updatedAt, page.locale) })}
            </p>
            <p className="m-0">
              {m.marketing_legal_contact()}{' '}
              <a href={`mailto:${email}`} className="underline">
                {email}
              </a>
            </p>
          </footer>
        </article>
      </div>
    </MarketingShell>
  )
}
