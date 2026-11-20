import { createFileRoute, notFound } from '@tanstack/react-router'
import { PageWidth } from '@xuanxue/ui/project'
import { GrowthForm } from '../features/growth/forms.tsx'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { m } from '../paraglide/messages.js'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

// 电子报订阅页（设计稿 warm-refresh/Newsletter.dc.html）：页头标志已是首页入口，不再放「返回首页」；
// 表单下方链接隐私政策，提交成功与失败各有状态。
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
      <PageWidth className="pb-16 sm:pb-28">
        <GrowthForm feature="newsletter" headingLevel={1} />
      </PageWidth>
    </MarketingShell>
  ),
})
