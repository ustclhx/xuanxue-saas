import { siteBrandName } from '@xuanxue/config'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { templateConfig } from '../../../server/template-config.ts'
import { useSiteId } from '../../site/context.tsx'
import { toolsForSite } from '../../tools/registry.ts'
import { toolHref } from '../../tools/tool-href.ts'

export function BlogEmptyState() {
  const site = useSiteId()
  const locale = getLocale()
  const tools = toolsForSite(site, locale).filter((tool) =>
    ['bazi', 'life-path', 'tarot-three-card'].includes(tool.id),
  )

  return (
    <section className="grid gap-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div className="grid gap-3">
        <h2 className="font-heading font-semibold text-2xl">{m.marketing_blog_empty()}</h2>
        <p className="max-w-prose text-ink-muted leading-relaxed">
          {m.marketing_blog_empty_description({
            brand: siteBrandName(templateConfig, site, locale),
          })}
        </p>
      </div>
      <ul className="flex flex-wrap gap-3">
        {tools.map((tool) => (
          <li key={tool.id}>
            <a
              href={toolHref(tool.path, locale)}
              className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 py-2 font-semibold text-brand-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              {m.marketing_blog_empty_tool({ tool: tool.title })}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
