import { cn } from '@xuanxue/ui'
import { PROSE_ELEMENTS } from '@xuanxue/ui/project'

/**
 * 构建期由 MDX 渲染出的 HTML（content-collections.ts）。内容来自仓库文件，不含用户输入。
 * 排版与 `Prose` 同一套规则（PROSE_ELEMENTS：小标题、链接、列表、提示块、代码），这里补上块间距与表格；
 * 字号只用角色类，颜色只用主题变量，深浅色自动适配。限宽由调用方决定（正文页 720px）。
 */
const prose = [
  'min-w-0 text-body text-ink-muted',
  PROSE_ELEMENTS,
  // 块间距：段落之间 20px，H2 之上 40px（设计稿 .article 的 gap 20 + h2 margin-top 20）
  '[&_p]:my-5 [&_ul]:my-5 [&_ol]:my-5 [&_blockquote]:my-5 [&_pre]:my-5',
  '[&_h2]:mt-10 [&_h2]:mb-5 [&_h3]:mt-7 [&_h3]:mb-5',
  '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
  '[&_blockquote>:first-child]:mt-0 [&_blockquote>:last-child]:mb-0',
  '[&_.rich-table-scroll]:my-6 [&_.rich-table-scroll]:max-w-full [&_.rich-table-scroll]:overflow-x-auto [&_.rich-table-scroll]:rounded-field [&_.rich-table-scroll]:border [&_.rich-table-scroll]:border-line',
  '[&_.rich-table-scroll]:focus-visible:outline-2 [&_.rich-table-scroll]:focus-visible:outline-ring',
  '[&_table]:w-full [&_table]:min-w-xl [&_table]:border-collapse [&_table]:text-left [&_table]:text-caption',
  '[&_thead]:bg-surface-2 [&_th]:font-semibold [&_th]:text-ink',
  '[&_th]:border-line [&_th]:border-b [&_th]:px-4 [&_th]:py-3 [&_th]:align-top',
  '[&_td]:border-line [&_td]:border-b [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:break-words [&_tbody_tr:last-child_td]:border-b-0',
].join(' ')

export function RichContent({ html, className }: { html: string; className?: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: 构建期由仓库中的 MDX 文件渲染
  return <div className={cn(prose, className)} dangerouslySetInnerHTML={{ __html: html }} />
}
