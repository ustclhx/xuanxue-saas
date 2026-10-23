import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { GrowthForm } from '../features/growth/forms.tsx'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { m } from '../paraglide/messages.js'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'
export const Route = createFileRoute('/newsletter')({
  beforeLoad: () => {
    if (!templateConfig.features.newsletter) throw notFound()
  },
  head: ({ matches }) =>
    pageHead(
      {
        ...staticPage('/newsletter', getLocale()),
        title: m.growth_newsletter_title(),
        description: m.growth_newsletter_intro(),
      },
      originFromMatches(matches),
    ),
  component: () => (
    <MarketingShell>
      <div className="mx-auto w-full max-w-[1120px] px-4 py-12 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-brand-ink text-sm hover:underline"
        >
          ← {m.growth_back_home()}
        </Link>
        <GrowthForm feature="newsletter" headingLevel={1} />
      </div>
    </MarketingShell>
  ),
})
