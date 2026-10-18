import { useMemo } from 'react'
import { m } from '../../../paraglide/messages.js'
import { ToolContext } from '../context.tsx'
import { Disclaimer } from '../disclaimer.tsx'
import { ToolFaq } from '../faq.tsx'
import { ToolLinks } from '../tool-links.tsx'
import { useToolEvents } from '../use-tool-events.ts'
import type { NumerologyPage } from './content.functions.ts'
import { numerologyLinks } from './copy.ts'
import { LifePathCalculator } from './life-path-calculator.tsx'
import { NumberGrid, NumerologyArticle } from './parts.tsx'
import { faqItems } from './seo.ts'

/**
 * 西方站首页（openspec add-numerology-tools design.md 决策 3，原型 LifePath.dc.html）：
 * H1 → 计算器 → 结果 → 1–33 数字网格 → 「What is a life path number」长文 → FAQ → 完整计算器入口。
 * 首屏为左右两栏，不套用 ToolPage 的单栏布局，组件与埋点仍复用 features/tools。
 */
export function LifePathHome({ content }: { content: NumerologyPage }) {
  const track = useToolEvents('life-path')
  const context = useMemo(() => ({ tool: 'life-path', track }), [track])
  return (
    <ToolContext value={context}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-10 px-4 pt-10 pb-16 sm:px-6 sm:pt-12 sm:pb-[72px]">
        <LifePathCalculator
          heading={
            <h1 className="m-0 font-heading font-semibold text-[40px] text-ink leading-[1.05] sm:text-[56px]">
              {m.numerology_home_title()}
            </h1>
          }
          intro={m.numerology_home_intro()}
        />
        <Disclaimer />
        <NumberGrid />
        <NumerologyArticle html={content.html} />
        <ToolFaq items={faqItems(content.faq)} />
        <ToolLinks links={numerologyLinks('life-path')} title={m.numerology_more_tools()} />
      </div>
    </ToolContext>
  )
}
