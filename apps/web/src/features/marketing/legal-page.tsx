import { supportEmail } from '@xuanxue/config'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { formatDate } from './blog/post-list.tsx'
import type { getLegalPage } from './content.functions.ts'
import { ContentHead, ContentPage, MetaLine } from './content-page.tsx'
import { SUPPORT_EMAIL_TOKEN } from './legal-tokens.ts'
import { MarketingShell } from './marketing-shell.tsx'
import { RichContent } from './rich-content.tsx'

type LegalPageData = Awaited<ReturnType<typeof getLegalPage>>

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
