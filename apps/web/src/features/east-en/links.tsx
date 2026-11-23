import { Fragment, type ReactNode } from 'react'
import { useTool } from '../tools/context.tsx'
import { inlineLinkClass } from '../tools/inline-links.tsx'
import { toolHref } from '../tools/tool-href.ts'
import type { LinkKey } from './copy/types.ts'

/**
 * 东方站根路径英文正文里 `[锚文本](目标键)` 的目标地址（不含语言前缀；东方站英文无前缀）。
 * 只指向东方站的英文页面：两站互不链接。
 */
export const EAST_EN_LINKS: Readonly<Record<LinkKey, string>> = {
  home: '/',
  bazi: '/bazi-calculator',
  'bazi-2027': '/bazi-2027',
  ziwei: '/zi-wei-dou-shu',
  spreads: '/tarot-spreads',
  'one-card': '/tarot-spreads/one-card',
  'pick-a-card': '/tarot-spreads/pick-a-card',
  'celtic-cross': '/tarot-spreads/celtic-cross',
  feelings: '/tarot-feelings',
  faq: '/faq',
  pricing: '/pricing',
  privacy: '/privacy',
  refund: '/refund',
}

const LINK = /\[([^\]]+)\]\(([a-z0-9-]+)\)/g

/** 去掉链接标记、保留锚文本（结构化数据与 meta 用纯文本） */
export function plainText(text: string): string {
  return text.replace(LINK, '$1')
}

/** 正文中的链接数（构建期检查每页 2–5 条） */
export function linkKeys(text: string): LinkKey[] {
  return [...text.matchAll(LINK)].map((match) => match[2] as LinkKey)
}

/** 带 `[锚文本](目标键)` 的一段正文：输出服务端渲染的真实 <a href>，样式与站内正文链接相同 */
export function EastEnText({
  text,
  plain = [],
}: {
  text: string
  /** 这些目标在本页已有链接（如落地页的工具卡片）：只输出锚文本，控制每页正文链接数 */
  plain?: readonly LinkKey[]
}): ReactNode {
  const { track } = useTool()
  const parts = text.split(LINK)
  const out: ReactNode[] = []
  for (let index = 0; index < parts.length; index += 3) {
    const before = parts[index]
    if (before) out.push(<Fragment key={`t${index}`}>{before}</Fragment>)
    const anchor = parts[index + 1]
    const key = parts[index + 2] as LinkKey | undefined
    if (anchor === undefined || key === undefined) continue
    const path = plain.includes(key) ? undefined : EAST_EN_LINKS[key]
    out.push(
      path ? (
        <a
          key={`a${index}`}
          href={toolHref(path, 'en')}
          onClick={() => track('tool_link_click', { target: key })}
          className={inlineLinkClass}
        >
          {anchor}
        </a>
      ) : (
        <Fragment key={`a${index}`}>{anchor}</Fragment>
      ),
    )
  }
  return out
}
