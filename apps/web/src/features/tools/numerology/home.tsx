import { m } from '../../../paraglide/messages.js'
import { Breadcrumb } from '../breadcrumb.tsx'
import { ToolPage } from '../tool-page.tsx'
import type { NumerologyPage } from './content.functions.ts'
import { numerologyLinks } from './copy.ts'
import { LifePathCalculator } from './life-path-calculator.tsx'
import { NumberGrid, NumerologyArticle } from './parts.tsx'
import { faqItems } from './seo.ts'

/**
 * Life Path Number 工具页 `/life-path-number`（openspec separate-landing-homepage design.md D1；
 * 设计稿 warm-refresh/ToolLifePath.dc.html）：面包屑、H1、简介 → 只含出生日期的表单 → 结果卡 →
 * 「What is a life path number」长文 → FAQ → 1–33 数字网格 → 其他数字命理工具。
 * 长文与 FAQ 在结果之后（specs/numerology-pages「Life Path 工具页」）。
 */
export function LifePathHome({ content }: { content: NumerologyPage }) {
  return (
    <ToolPage
      tool="life-path"
      breadcrumb={
        <Breadcrumb
          items={[
            { name: m.marketing_nav_home(), href: '/' },
            { name: m.numerology_number_life_path() },
          ]}
        />
      }
      title={m.numerology_home_title()}
      intro={<p className="m-0">{m.numerology_home_intro()}</p>}
      form={<LifePathCalculator unlock />}
      article={<NumerologyArticle html={content.html} />}
      faq={faqItems(content.faq)}
      nav={<NumberGrid />}
      links={numerologyLinks('life-path')}
      linksTitle={m.numerology_more_tools()}
    />
  )
}
