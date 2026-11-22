import { LinkCardGrid } from '@xuanxue/ui'
import type { ReactNode } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { InlineLinks, LinkBand } from '../inline-links.tsx'
import { toolHref } from '../tool-href.ts'
import { ToolPage } from '../tool-page.tsx'
import type { NumerologyPage } from './content.functions.ts'
import { asLifePath, NUMBER_THEME, neighborNumbers } from './copy.ts'
import { lifePathHref, numerologyHref, numerologyLocale } from './href.ts'
import { NumerologyArticle } from './parts.tsx'
import { faqItems } from './seo.ts'

/**
 * 「相邻数字」一段：句子里链接 2–3 个数字页，锚文本为「Life Path Number n」。
 * `text` 为 frontmatter 的逐数字文案（openspec content-growth-phase1 决策 1），`[锚文本]` 依次对应
 * `neighborNumbers()` 的 pair 与 root；缺失时用 messages 的通用句式。
 */
export function NeighborNumbers({ number, text }: { number: number; text?: string | undefined }) {
  const { pair, root } = neighborNumbers(asLifePath(number))
  const link = (value: number) => ({
    href: lifePathHref(value),
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
    // 相邻数字是固定事实（data-locale-fixed：相似度测量不计其中的数字）
    <section
      data-locale-fixed
      aria-labelledby="numerology-neighbors"
      className="flex max-w-180 flex-col gap-3"
    >
      <h2 id="numerology-neighbors" className="m-0 text-balance font-heading text-ink text-title">
        {m.numerology_neighbors_title()}
      </h2>
      <p className="m-0 text-body text-ink-muted">
        {text ? (
          <InlineLinks text={text} links={[...pair, ...(root ? [root] : [])].map(link)} />
        ) : (
          <>
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
          </>
        )}
      </p>
    </section>
  )
}

/**
 * 「相关」区块（入门页，content-growth-phase1 决策 7；设计稿 numerology-intro/Main.dc.html）：LinkCardGrid 列出
 * 7 个计算器页，锚文本为目标页 titleMain、一行说明为目标页 description，data-link-zone="related"。
 * 地址来自公开页面清单（不带语言前缀），这里按当前语言加前缀；没有 related 的页面不渲染。
 */
export function RelatedPages({ links }: { links: NumerologyPage['related'] }) {
  const locale = numerologyLocale()
  return (
    <LinkCardGrid
      title={m.marketing_linking_related()}
      items={links.map(({ href, label, description }) => ({
        href: toolHref(href, locale),
        title: label,
        description,
      }))}
    />
  )
}

/**
 * 数字页、枢纽页与入门页（specs/numerology-pages「数字页」；设计稿 warm-refresh/NumPage.dc.html、NumHub.dc.html，
 * 入门页 numerology-intro/Main.dc.html 在 FAQ 与转化条之间多一块「相关」）：
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
  const fullCalculator = numerologyHref('numerology-calculator')
  return (
    <MarketingShell>
      <ToolPage
        tool={tool}
        breadcrumb={breadcrumb}
        title={content.heading ?? content.title}
        intro={<p className="m-0">{content.description}</p>}
        form={calculator}
        article={
          <>
            <NumerologyArticle html={content.html} />
            {content.number != null && (
              <NeighborNumbers number={content.number} text={content.neighbors} />
            )}
          </>
        }
        faq={faqItems(content.faq)}
        nav={
          <>
            <RelatedPages links={content.related} />
            <LinkBand
              link={{ href: fullCalculator, target: 'numerology-calculator' }}
              label={m.numerology_band_link()}
            >
              {content.number != null ? m.numerology_band_number() : m.numerology_band_hub()}
            </LinkBand>
          </>
        }
      />
    </MarketingShell>
  )
}
