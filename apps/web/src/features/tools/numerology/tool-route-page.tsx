import type { ReactNode } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { ToolArticle } from '../tool-article.tsx'
import { ToolPage } from '../tool-page.tsx'
import { relatedNumerologyLinks, toolFaq } from './copy.ts'
import type { NumerologyToolGuide } from './guide.functions.ts'
import type { NumerologyToolId } from './routes.ts'

/**
 * 四个工具内页的统一外壳：ToolPage（H1、导语、表单与结果、声明、说明长文、FAQ、3–4 个相关工具）。
 * 说明长文与补充 FAQ 由路由 loader 经 getNumerologyToolGuide 在服务端取出（文案不进客户端包）。
 */
export function NumerologyToolPage({
  id,
  title,
  intro,
  guide,
  children,
}: {
  id: NumerologyToolId
  title: string
  intro: string
  guide: NumerologyToolGuide
  children: ReactNode
}) {
  return (
    <MarketingShell>
      <ToolPage
        tool={id}
        title={title}
        intro={<p className="m-0">{intro}</p>}
        form={children}
        article={<ToolArticle title={guide.title} sections={guide.sections} />}
        links={relatedNumerologyLinks(id)}
        faq={[...toolFaq(id), ...guide.faq]}
      />
    </MarketingShell>
  )
}
