import { createFileRoute, notFound } from '@tanstack/react-router'
import { PageWidth } from '@xuanxue/ui/project'
import { GrowthForm } from '../features/growth/forms.tsx'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

// 候补名单页（设计稿 warm-refresh/Waitlist.dc.html）：与电子报订阅页同一版式，带站点页头与页脚
export const Route = createFileRoute('/waitlist')({
  beforeLoad: () => {
    if (!templateConfig.features.waitlist) throw notFound()
  },
  head: ({ matches }) => pageHead(staticPage('/waitlist', getLocale()), originFromMatches(matches)),
  component: () => (
    <MarketingShell>
      <PageWidth className="pb-16 sm:pb-28">
        <GrowthForm feature="waitlist" headingLevel={1} />
      </PageWidth>
    </MarketingShell>
  ),
})
