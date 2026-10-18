import { cn } from '@xuanxue/ui'
import { type ReactNode, useEffect, useMemo } from 'react'
import { m } from '../../paraglide/messages.js'
import { useSiteId } from '../site/context.tsx'
import { ToolContext } from './context.tsx'
import { Disclaimer } from './disclaimer.tsx'
import { type FaqItem, ToolFaq } from './faq.tsx'
import { type ToolLink, ToolLinks } from './tool-links.tsx'
import { useToolEvents } from './use-tool-events.ts'

/**
 * 工具页外壳（openspec add-dual-site-foundation 决策 5，specs/tool-pages）：
 * H1、导语、首屏内联表单、结果区、合规声明、订阅 / 解锁插槽、内链矩阵与 FAQ。
 * 标题、导语、表单标签与区块说明都在服务端输出，禁用脚本时可抓取；结果在浏览器本地计算后填入。
 */
export function ToolPage({
  tool,
  title,
  intro,
  form,
  result,
  links = [],
  faq = [],
  children,
}: {
  /** 工具标识（注册表 id），埋点 tool 字段 */
  tool: string
  title: string
  intro: ReactNode
  form: ReactNode
  /** 结果区块；为 null 时只显示表单与声明 */
  result?: ReactNode
  links?: readonly ToolLink[]
  faq?: readonly FaqItem[]
  /** 结果之后的订阅卡与付费卡（不得以弹窗出现） */
  children?: ReactNode
}) {
  const site = useSiteId()
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  const hasResult = result != null
  useEffect(() => {
    if (hasResult) track('result_view')
  }, [hasResult, track])
  return (
    <ToolContext value={context}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6">
        <header className="flex flex-col gap-2.5">
          <h1
            className={cn(
              'm-0 font-heading text-ink',
              site === 'east'
                ? 'font-bold text-[32px] leading-tight sm:text-[40px]'
                : 'font-semibold text-[40px] leading-[1.05] sm:text-[56px]',
            )}
          >
            {title}
          </h1>
          <div className="max-w-[720px] text-[17px] text-ink-muted leading-relaxed">{intro}</div>
        </header>
        {form}
        <section
          id="result"
          aria-label={m.tools_results_label()}
          aria-live="polite"
          className="flex scroll-mt-6 flex-col gap-5 empty:hidden"
        >
          {result}
        </section>
        <Disclaimer />
        {children}
        <ToolLinks links={links} />
        <ToolFaq items={faq} />
      </div>
    </ToolContext>
  )
}
