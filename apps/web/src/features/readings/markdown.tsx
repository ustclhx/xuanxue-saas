import { Fragment, type ReactNode } from 'react'

/**
 * 报告正文的白名单 Markdown 渲染（add-reading-monetization design 决策 2）：只识别二、三级标题、
 * 段落、引用、有序 / 无序列表、分隔线与行内粗体、斜体；其余一律按纯文本输出。
 * 不使用 dangerouslySetInnerHTML，模型输出中的 HTML、链接与图片都不会成为可执行或可点击的内容。
 */

export type MarkdownBlock =
  | { readonly type: 'heading'; readonly level: 2 | 3; readonly text: string }
  | { readonly type: 'paragraph'; readonly text: string }
  | { readonly type: 'quote'; readonly text: string }
  | { readonly type: 'list'; readonly ordered: boolean; readonly items: readonly string[] }
  | { readonly type: 'rule' }

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/
const BULLET = /^[ \t]*[-*+][ \t]+(.*)$/
const ORDERED = /^[ \t]*\d{1,3}[.)][ \t]+(.*)$/
const QUOTE = /^>[ \t]?(.*)$/
const RULE = /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []
  let quote: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    if (quote.length) blocks.push({ type: 'quote', text: quote.join(' ') })
    if (list) blocks.push({ type: 'list', ...list })
    paragraph = []
    quote = []
    list = null
  }
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flush()
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flush()
      // 一级标题降为二级，四级及以下并入三级，页面标题层级保持 h1 → h2 → h3
      const level = (heading[1] ?? '').length <= 2 ? 2 : 3
      blocks.push({ type: 'heading', level, text: heading[2] ?? '' })
      continue
    }
    if (RULE.test(line)) {
      flush()
      blocks.push({ type: 'rule' })
      continue
    }
    const quoted = QUOTE.exec(line)
    if (quoted) {
      if (paragraph.length || list) flush()
      quote.push(quoted[1] ?? '')
      continue
    }
    const bullet = BULLET.exec(line)
    const ordered = bullet ? null : ORDERED.exec(line)
    const item = bullet ?? ordered
    if (item) {
      const isOrdered = Boolean(ordered)
      if (paragraph.length || quote.length || (list && list.ordered !== isOrdered)) flush()
      list ??= { ordered: isOrdered, items: [] }
      list.items.push(item[1] ?? '')
      continue
    }
    // 列表项的续行并入上一项
    if (list && /^[ \t]+/.test(raw)) {
      const last = list.items.length - 1
      list.items[last] = `${list.items[last]} ${line.trim()}`
      continue
    }
    if (quote.length || list) flush()
    paragraph.push(line.trim())
  }
  flush()
  return blocks
}

/** 行内只识别 `**粗体**` 与 `*斜体*` / `_斜体_`；反引号去掉后按文本显示 */
export function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = []
  const pattern =
    /\*\*(.+?)\*\*|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)|`([^`]+)`/g
  let last = 0
  let key = 0
  const textPart = (value: string) => <Fragment key={key++}>{value}</Fragment>
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) parts.push(textPart(text.slice(last, index)))
    if (match[1] !== undefined) parts.push(<strong key={key++}>{match[1]}</strong>)
    else if (match[2] !== undefined || match[3] !== undefined)
      parts.push(<em key={key++}>{match[2] ?? match[3]}</em>)
    else parts.push(textPart(match[4] ?? ''))
    last = index + match[0].length
  }
  if (last < text.length) parts.push(textPart(text.slice(last)))
  return parts
}

/** 章节标题的锚点 id：报告内跳转用，只保留字母数字与 CJK */
export function sectionId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  return `s${index + 1}${slug ? `-${slug}` : ''}`
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  let headingIndex = 0
  return (
    <div className="flex flex-col gap-4 text-[17px] text-ink leading-[1.8]">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`
        switch (block.type) {
          case 'heading': {
            const id = sectionId(block.text, headingIndex++)
            return block.level === 2 ? (
              <h2
                key={key}
                id={id}
                className="m-0 mt-4 scroll-mt-6 border-line border-t pt-6 font-heading font-semibold text-[24px] text-ink leading-snug first:mt-0 first:border-0 first:pt-0"
              >
                {renderInline(block.text)}
              </h2>
            ) : (
              <h3 key={key} className="m-0 mt-2 font-semibold text-ink text-lg">
                {renderInline(block.text)}
              </h3>
            )
          }
          case 'quote':
            return (
              <blockquote
                key={key}
                className="m-0 rounded-lg bg-surface-2 px-4 py-3 text-[15px] text-ink-muted leading-relaxed"
              >
                {renderInline(block.text)}
              </blockquote>
            )
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul'
            return (
              <List
                key={key}
                className={`m-0 flex flex-col gap-1.5 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {block.items.map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 列表项按位置渲染，不会重排
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </List>
            )
          }
          case 'rule':
            return <hr key={key} className="m-0 border-line" />
          default:
            return (
              <p key={key} className="m-0">
                {renderInline(block.text)}
              </p>
            )
        }
      })}
    </div>
  )
}
