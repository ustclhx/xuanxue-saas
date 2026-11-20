import { siteBrandName } from '@xuanxue/config'
import { useId } from 'react'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { templateConfig } from '../../../server/template-config.ts'
import { useSiteId } from '../../site/context.tsx'
import { contentLinks } from '../content-links.ts'
import { inlineLinks } from '../content-page.tsx'

/**
 * 博客空列表（设计稿 warm-refresh/BlogList.dc.html 的空状态）：一个 surface 面板，
 * 说明里链接本站的主工具与三张牌塔罗（正文内链 2 条，锚文本为目标页主关键词）。
 */
export function BlogEmptyState() {
  const site = useSiteId()
  const locale = getLocale()
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-180 flex-col gap-4 rounded-object bg-surface p-6 sm:p-8"
    >
      <h2 id={headingId} className="m-0 font-heading text-ink text-subtitle">
        {m.marketing_blog_empty()}
      </h2>
      <p className="m-0 text-body text-ink-muted">
        {inlineLinks(
          m.marketing_blog_empty_description({
            brand: siteBrandName(templateConfig, site, locale),
          }),
          contentLinks(locale),
        )}
      </p>
    </section>
  )
}
