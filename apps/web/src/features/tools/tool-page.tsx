import { PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useEffect, useMemo } from 'react'
import { m } from '../../paraglide/messages.js'
import { ToolContext } from './context.tsx'
import { Disclaimer } from './disclaimer.tsx'
import { type FaqItem, ToolFaq } from './faq.tsx'
import { type ToolLink, ToolLinks } from './tool-links.tsx'
import { useToolEvents } from './use-tool-events.ts'

/**
 * 工具页外壳（specs/tool-pages「工具页紧凑布局」；设计稿 docs/design/prototypes/warm-refresh/ToolBazi.dc.html）：
 * 面包屑、H1、一到两句简介、表单 → 结果（底部是合规声明）→ 订阅 / 解锁插槽 → 说明长文 → FAQ → 内链。
 * 长文、FAQ 与内链都在结果之后，不放在 H1 与表单之间；手机首屏（390×844）内可见提交按钮。
 * 标题、导语、表单标签与长文都在服务端输出，禁用脚本时可抓取；结果在浏览器本地计算后填入。
 */
export function ToolPage({
  tool,
  title,
  intro,
  form,
  result,
  links = [],
  linksTitle,
  faq = [],
  article,
  nav,
  children,
  breadcrumb,
  titleBadge,
}: {
  /** 工具标识（注册表 id），埋点 tool 字段 */
  tool: string
  title: string
  intro: ReactNode
  form: ReactNode
  /**
   * 结果区块。传 null 表示尚未出结果：此时页面中不显示声明（声明在页脚）；
   * 不传表示结果由 form 插槽自己渲染（数字命理计算器），声明固定显示在其后。
   */
  result?: ReactNode
  links?: readonly ToolLink[]
  linksTitle?: string
  faq?: readonly FaqItem[]
  /** 说明长文、概念解释等：位于结果与订阅 / 解锁插槽之后、FAQ 之前 */
  article?: ReactNode
  /** FAQ 与内链之间的附加导航（如 1–33 数字网格） */
  nav?: ReactNode
  /** 结果之后的订阅卡与付费卡（不得以弹窗出现） */
  children?: ReactNode
  /** 面包屑（H1 之上）：与页面 head 的 BreadcrumbList 同一组层级 */
  breadcrumb?: ReactNode
  /** H1 右侧的小标（如「New」）；省略时 H1 单独成行 */
  titleBadge?: ReactNode
}) {
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  const hasResult = result != null
  useEffect(() => {
    if (hasResult) track('result_view')
  }, [hasResult, track])
  return (
    <ToolContext value={context}>
      <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
        <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
          {breadcrumb}
          {titleBadge ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="m-0 text-balance font-heading text-ink text-title">{title}</h1>
              {titleBadge}
            </div>
          ) : (
            <h1 className="m-0 text-balance font-heading text-ink text-title">{title}</h1>
          )}
          <div className="text-body text-ink-muted">{intro}</div>
        </header>
        {/* data-locale-fixed：计算器与结果是引擎输出（数字、步骤、表格），多语言相似度测量不计其中的数字
            （scripts/locale-similarity.mjs FIXED_DIGITS_SELECTOR）；contents 不产生布局盒 */}
        <div data-locale-fixed className="contents">
          {form}
        </div>
        <section
          data-locale-fixed
          id="result"
          aria-label={m.tools_results_label()}
          aria-live="polite"
          className="flex scroll-mt-6 flex-col gap-6 empty:hidden"
        >
          {result}
        </section>
        {(hasResult || result === undefined) && <Disclaimer />}
        {children}
        {article}
        <ToolFaq items={faq} />
        {nav}
        <ToolLinks links={links} title={linksTitle} />
      </PageWidth>
    </ToolContext>
  )
}
