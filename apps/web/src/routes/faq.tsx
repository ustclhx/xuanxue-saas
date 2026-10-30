import { createFileRoute, Link } from '@tanstack/react-router'
import { faqSections } from '../features/marketing/faq.ts'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { ToolFaq } from '../features/tools/faq.tsx'
import { faqPageData } from '../features/tools/numerology/seo.ts'
import { m } from '../paraglide/messages.js'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

// 常见问题汇总页（product-improve-ai-content 4.7）：纯静态文案，构建期预渲染，不读数据库；
// 页面与 FAQPage 结构化数据共用 faqSections，保证问答与可见内容一致。
export const Route = createFileRoute('/faq')({
  head: ({ matches }) => {
    const locale = getLocale()
    return pageHead(staticPage('/faq', locale), originFromMatches(matches), [
      faqPageData(faqSections(locale).flatMap((section) => section.items)),
    ])
  },
  component: FaqPage,
})

const link = 'text-brand-ink underline'

function FaqPage() {
  return (
    <MarketingShell>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-4 py-12 sm:px-6">
        <header className="flex max-w-[720px] flex-col gap-3">
          <h1 className="m-0 font-heading font-semibold text-3xl text-ink">
            {m.marketing_faq_title()}
          </h1>
          <p className="m-0 text-ink-muted leading-relaxed">{m.marketing_faq_page_intro()}</p>
        </header>
        {faqSections(getLocale()).map((section) => (
          <ToolFaq key={section.title} title={section.title} items={section.items} />
        ))}
        <p className="m-0 flex flex-wrap gap-x-4 text-sm">
          {templateConfig.billing.enabled && (
            <Link to="/pricing" className={link}>
              {m.marketing_nav_pricing()}
            </Link>
          )}
          <Link to="/refund" className={link}>
            {m.marketing_footer_refund()}
          </Link>
          <Link to="/privacy" className={link}>
            {m.marketing_footer_privacy()}
          </Link>
          <Link to="/disclaimer" className={link}>
            {m.marketing_footer_disclaimer()}
          </Link>
        </p>
      </div>
    </MarketingShell>
  )
}
