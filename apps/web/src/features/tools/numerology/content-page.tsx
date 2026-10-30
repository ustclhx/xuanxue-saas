import type { ReactNode } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { ContentFunnel } from '../reading-guide.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolPage } from '../tool-page.tsx'
import type { NumerologyPage } from './content.functions.ts'
import { numerologyLinks } from './copy.ts'
import { NumberGrid, NumerologyArticle } from './parts.tsx'
import { NUMEROLOGY_LOCALE, NUMEROLOGY_TOOLS } from './routes.ts'
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
  const fullCalculator = toolHref(NUMEROLOGY_TOOLS['numerology-calculator'].path, NUMEROLOGY_LOCALE)
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
        {/* 只有 12 个生命灵数含义页加入口；枢纽页本身就是姓名计算器 */}
        {content.number != null && (
          <ContentFunnel
            tool={{
              href: fullCalculator,
              label: m.funnel_content_life_path_tool(),
              target: 'numerology-calculator',
            }}
            reading={{
              kind: 'numerology-full',
              href: fullCalculator,
              label: m.funnel_content_reading(),
              target: 'reading-numerology-full',
            }}
          />
        )}
      </ToolPage>
    </MarketingShell>
  )
}
