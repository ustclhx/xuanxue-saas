import { createFileRoute } from '@tanstack/react-router'
import { ContentHead, ContentPage, linkPhrases } from '../features/marketing/content-page.tsx'
import { faqSections } from '../features/marketing/faq.ts'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { ToolFaq } from '../features/tools/faq.tsx'
import { faqPageData } from '../features/tools/numerology/seo.ts'
import { m } from '../paraglide/messages.js'
import { getLocale, localizeHref } from '../paraglide/runtime.js'

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

/**
 * 常见问题页（设计稿 warm-refresh/Faq.dc.html）：页头 + 各组问答。页尾不再单列一行链接，
 * 链接放进提到它们的答案里（退款政策、隐私政策）：只给答案里已有的名称加链接，不为放链接改写句子。
 * 可见答案与 FAQPage 结构化数据仍是同一份文字。
 */
function FaqPage() {
  const locale = getLocale()
  const phrases = [
    { phrase: m.marketing_footer_refund(), href: localizeHref('/refund', { locale }) },
    { phrase: m.marketing_footer_privacy(), href: localizeHref('/privacy', { locale }) },
  ]
  // 每个目标页在本页只链接一次：取第一条提到它的答案
  const linked = new Set<string>()
  return (
    <MarketingShell>
      <ContentPage>
        <ContentHead title={m.marketing_faq_title()}>
          <p className="m-0 text-body text-ink-muted">{m.marketing_faq_page_intro()}</p>
        </ContentHead>
        {faqSections(locale).map((section) => (
          <ToolFaq
            key={section.title}
            title={section.title}
            items={section.items.map((item) => {
              const fresh = phrases.filter(
                ({ phrase, href }) => !linked.has(href) && item.answer.includes(phrase),
              )
              for (const { href } of fresh) linked.add(href)
              return { question: item.question, answer: linkPhrases(item.answer, fresh) }
            })}
          />
        ))}
      </ContentPage>
    </MarketingShell>
  )
}
