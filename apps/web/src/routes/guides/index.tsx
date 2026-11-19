import { createFileRoute } from '@tanstack/react-router'
import { getGuideIndex } from '../../features/marketing/content.functions.ts'
import { ContentHead, ContentPage } from '../../features/marketing/content-page.tsx'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageHead, staticPage } from '../../features/seo/metadata.ts'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'

export const Route = createFileRoute('/guides/')({
  loader: () => getGuideIndex({ data: { locale: getLocale() } }),
  head: ({ matches }) => pageHead(staticPage('/guides', getLocale()), originFromMatches(matches)),
  component: GuideIndexPage,
})

/** 指南列表：细线分隔的列表，标题是每条唯一的链接（锚文本为指南标题） */
function GuideIndexPage() {
  const guides = Route.useLoaderData()
  const locale = getLocale()
  return (
    <MarketingShell>
      <ContentPage>
        <ContentHead title={m.marketing_guides_title()}>
          <p className="m-0 text-body text-ink-muted">{m.marketing_guides_subtitle()}</p>
        </ContentHead>
        <ul className="m-0 flex max-w-180 list-none flex-col border-line border-t p-0">
          {guides.map((guide) => (
            <li key={guide.slug} className="flex flex-col gap-2 border-line border-b py-7">
              <h2 className="m-0 font-heading text-ink text-subtitle">
                <a
                  href={localizeHref(`/guides/${encodeURIComponent(guide.slug)}`, { locale })}
                  className="text-brand-ink"
                >
                  {guide.title}
                </a>
              </h2>
              <p className="m-0 text-body text-ink-muted">{guide.answer_summary}</p>
            </li>
          ))}
        </ul>
      </ContentPage>
    </MarketingShell>
  )
}
