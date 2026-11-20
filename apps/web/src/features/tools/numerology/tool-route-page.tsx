import type { ReactNode } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { ToolPage } from '../tool-page.tsx'
import { relatedNumerologyLinks, toolFaq } from './copy.ts'
import type { NumerologyToolId } from './routes.ts'

/** 四个工具内页的统一外壳：ToolPage（H1、导语、表单与结果、声明、FAQ、3–4 个相关工具） */
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
  return (
    <MarketingShell>
      <ToolPage
        tool={id}
        title={title}
        intro={<p className="m-0">{intro}</p>}
        form={children}
        links={relatedNumerologyLinks(id)}
        faq={toolFaq(id)}
      />
    </MarketingShell>
  )
}
