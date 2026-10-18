import type { ReactNode } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { ToolPage } from '../tool-page.tsx'
import type { NumerologyPage } from './content.functions.ts'
import { numerologyLinks } from './copy.ts'
import { NumberGrid, NumerologyArticle } from './parts.tsx'
import { faqItems } from './seo.ts'

/**
 * 数字页与枢纽页（specs/numerology-pages「数字页」）：H1 与导语来自 frontmatter，首屏内嵌计算器，
 * 之后是正文、12 个数字页网格（当前页高亮）、工具互链与 FAQ（同时输出 FAQPage）。
 */
export function NumerologyContentPage({
  tool,
  content,
  calculator,
}: {
  tool: string
  content: NumerologyPage
  calculator: ReactNode
}) {
  return (
    <MarketingShell>
      <ToolPage
        tool={tool}
        title={content.title}
        intro={<p className="m-0">{content.description}</p>}
        form={calculator}
        links={numerologyLinks(tool)}
        faq={faqItems(content.faq)}
      >
        <NumerologyArticle html={content.html} />
        <NumberGrid current={content.number ?? undefined} />
      </ToolPage>
    </MarketingShell>
  )
}
