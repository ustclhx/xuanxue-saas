// 主工具链接扫描（openspec separate-landing-homepage tasks 3.1，specs/seo「首页主词迁移」）：
// 工具迁到关键词 URL 后，预渲染 HTML 中不得再有「锚文本为工具关键词、目标为语言首页」的链接
// （语言首页是品牌落地页）。扫描 dist/client 下全部 HTML 的 <a>，列出违规项并以非零状态退出。
// 用法：先 `pnpm --filter @xuanxue/web build`，再 node scripts/check-tool-links.mjs [dist/client]
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 链接目标为某语言首页：`/`、`/zh-hant`、`/zh-hans`、`/ko`（可带结尾斜杠、查询或片段，也可为绝对地址） */
const HOME_TARGET = /^(?:https?:\/\/[^/]+)?\/(?:(?:zh-hant|zh-hans|ko)\/?)?(?:[?#].*)?$/i
/** 工具关键词锚文本（design.md D5a） */
const TOOL_ANCHOR = /八字排盤|八字排盘|만세력|life path (?:number )?calculator|life path number/i

/** 一段 HTML 中以语言首页为目标、锚文本为工具关键词的链接 */
export function homeToolAnchors(html) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].flatMap(([, attributes, inner]) => {
    const href = /\bhref="([^"]*)"/.exec(attributes)?.[1]
    const text = inner
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return href !== undefined && HOME_TARGET.test(href) && TOOL_ANCHOR.test(text)
      ? [{ href, text }]
      : []
  })
}

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return htmlFiles(path)
    return entry.name.endsWith('.html') ? [path] : []
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? 'dist/client')
  const files = htmlFiles(root)
  let anchors = 0
  const offending = files.flatMap((file) => {
    const html = readFileSync(file, 'utf8')
    anchors += html.match(/<a\b/g)?.length ?? 0
    return homeToolAnchors(html).map(
      ({ href, text }) => `${relative(root, file)}: <a href="${href}">${text}</a>`,
    )
  })
  if (files.length === 0) {
    console.error(`No prerendered HTML under ${root}; run the web build first.`)
    process.exitCode = 1
  } else if (offending.length > 0) {
    console.error(offending.join('\n'))
    console.error(
      `Tool link check failed: ${offending.length} link(s) use a language home page as the tool entry.`,
    )
    process.exitCode = 1
  } else {
    console.log(
      `Tool link check passed: ${files.length} prerendered pages, ${anchors} links; none uses a language home page with a tool keyword as anchor text.`,
    )
  }
}
