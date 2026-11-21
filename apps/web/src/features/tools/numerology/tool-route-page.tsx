import type { ReactNode } from 'react'
import { getLocale } from '../../../paraglide/runtime.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { ToolArticle } from '../tool-article.tsx'
import { ToolPage } from '../tool-page.tsx'
import { relatedNumerologyLinks, toolFaq } from './copy.ts'
import { numerologyToolExtraFaq, numerologyToolGuide } from './guide-copy.ts'
import type { NumerologyToolId } from './routes.ts'

/**
 * 四个工具内页的统一外壳：ToolPage（H1、导语、表单与结果、声明、说明长文、FAQ、3–4 个相关工具）。
 * 说明长文与补充 FAQ 来自 guide-copy.ts，只随本组件的分包加载，不进首页与公共入口包。
 */
export function NumerologyToolPage({
  id,
  title,
  intro,
  children,
}: {
  id: NumerologyToolId
  title: string
  intro: string
  children: ReactNode
}) {
  const guide = numerologyToolGuide(id)
  const extra = numerologyToolExtraFaq(id)
  // 新语言（es）的补充问答写成说明长文的小节，页面 FAQ 只保留与 FAQPage 一致的基本问答；
  // 英语保持原结构（长文后接全部问答）
  const inArticle = getLocale() === 'es'
  return (
    <MarketingShell>
      <ToolPage
        tool={id}
        title={title}
        intro={<p className="m-0">{intro}</p>}
        form={children}
        article={
          <ToolArticle
            title={guide.title}
            sections={
              inArticle
                ? [
                    ...guide.sections,
                    ...extra.map(({ question, answer }) => ({ heading: question, body: answer })),
                  ]
                : guide.sections
            }
          />
        }
        links={relatedNumerologyLinks(id)}
        faq={inArticle ? toolFaq(id) : [...toolFaq(id), ...extra]}
      />
    </MarketingShell>
  )
}
