import type { ReactNode } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { InlineLinks, LinkBand } from '../inline-links.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolPage } from '../tool-page.tsx'
import type { NumerologyPage } from './content.functions.ts'
import { asLifePath, NUMBER_THEME, neighborNumbers } from './copy.ts'
import { NumerologyArticle } from './parts.tsx'
import { lifePathPath, NUMEROLOGY_LOCALE, NUMEROLOGY_TOOLS } from './routes.ts'
import { faqItems } from './seo.ts'

/** 「相邻数字」一段：句子里链接 2–3 个数字页，锚文本为「Life Path Number n」 */
function NeighborNumbers({ number }: { number: number }) {
  const { pair, root } = neighborNumbers(asLifePath(number))
  const link = (value: number) => ({
    href: toolHref(lifePathPath(value), NUMEROLOGY_LOCALE),
    target: `life-path-${value}`,
  })
  const inputs = {
    number,
    a: pair[0],
    b: pair[1],
    themeA: NUMBER_THEME[pair[0]](),
    themeB: NUMBER_THEME[pair[1]](),
  }
  return (
    <section aria-labelledby="numerology-neighbors" className="flex max-w-180 flex-col gap-3">
      <h2 id="numerology-neighbors" className="m-0 text-balance font-heading text-ink text-title">
        {m.numerology_neighbors_title()}
      </h2>
      <p className="m-0 text-body text-ink-muted">
        <InlineLinks
          text={root ? m.numerology_neighbors_master(inputs) : m.numerology_neighbors(inputs)}
          links={pair.map(link)}
        />
        {root && (
          <>
            {' '}
            <InlineLinks
              text={m.numerology_neighbors_root({ number, root, theme: NUMBER_THEME[root]() })}
              links={[link(root)]}
            />
          </>
        )}
      </p>
    </section>
  )
}

/**
 * 数字页与枢纽页（specs/numerology-pages「数字页」；设计稿 warm-refresh/NumPage.dc.html、NumHub.dc.html）：
 * H1 与导语来自 frontmatter，首屏内嵌计算器与结果，正文长文在结果之后（specs/tool-pages「工具页紧凑布局」），
 * 数字页再接一段相邻数字（句子里 2–3 条链接），然后是 FAQ（同时输出 FAQPage）与页尾一条转化条。
 * 12 个数字的网格只留在父页 `/life-path-number`，这里不再放网格与工具链接行（使用者 2026-11-19 确认）。
 */
export function NumerologyContentPage({
  tool,
  content,
  calculator,
  breadcrumb,
}: {
  tool: string
  content: NumerologyPage
  calculator: ReactNode
  /** 面包屑（H1 之上），数字页指向父页 `/life-path-number` */
  breadcrumb?: ReactNode
}) {
  const fullCalculator = toolHref(NUMEROLOGY_TOOLS['numerology-calculator'].path, NUMEROLOGY_LOCALE)
  return (
    <MarketingShell>
      <ToolPage
        tool={tool}
        breadcrumb={breadcrumb}
        title={content.title}
        intro={<p className="m-0">{content.description}</p>}
        form={calculator}
        article={
          <>
            <NumerologyArticle html={content.html} />
            {content.number != null && <NeighborNumbers number={content.number} />}
          </>
        }
        faq={faqItems(content.faq)}
        nav={
          <LinkBand
            link={{ href: fullCalculator, target: 'numerology-calculator' }}
            label={m.numerology_band_link()}
          >
            {content.number != null ? m.numerology_band_number() : m.numerology_band_hub()}
          </LinkBand>
        }
      />
    </MarketingShell>
  )
}
