import type { ReactNode } from 'react'
import { AiEntry } from './ai-entry.tsx'
import { site } from './site.ts'
import { SiteFooter } from './site-footer.tsx'
import { SiteHeader } from './site-header.tsx'

/**
 * 营销页、工具页、博客、法律页与文档共用的页头与页脚。
 * data-surface="marketing"：brand.css 在该作用域内把字号角色（text-display … text-caption）换成营销取值
 * （openspec refresh-visual-system-warm design.md D5、D14）；应用区不带该属性，沿用模板默认字号。
 */
export function MarketingShell({
  children,
  freeTools = false,
}: {
  children: ReactNode
  freeTools?: boolean
}) {
  const aiEntry = freeTools ? null : site.marketing.aiEntry
  return (
    <div
      data-surface="marketing"
      className="flex min-h-screen flex-col bg-background text-body text-foreground"
    >
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter floatingEntry={aiEntry !== null} freeTools={freeTools} />
      {aiEntry !== null && <AiEntry href={aiEntry} />}
    </div>
  )
}
