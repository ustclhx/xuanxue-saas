import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// openspec separate-landing-homepage tasks 3.1、design.md D5：语言首页是品牌落地页，
// 内容（概念页、数字页、指南、博客、牌义）不得再以首页作为排盘 / 计算器入口。
// 逐页的必备链接由 scripts/check-content-concepts.mjs 检查；这里随 `pnpm test` 扫描全部内容文件。
const contentRoot = new URL('../../../content/', import.meta.url).pathname
/** 链接目标为某语言首页：`/`、`/zh-hant`、`/zh-hans`、`/ko`（可带结尾斜杠、查询或片段） */
const HOME_TARGET = /^\/(?:(?:zh-hant|zh-hans|ko)\/?)?(?:[?#].*)?$/i
/** 工具关键词锚文本（design.md D5a） */
const TOOL_ANCHOR = /calculator|life path|排盤|排盘|八字|命盤|命盘|만세력|사주/i

function mdxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return mdxFiles(path)
    return /\.mdx?$/.test(entry.name) ? [path] : []
  })
}

/** 以语言首页为目标、锚文本为工具关键词的 Markdown 链接 */
function homeToolLinks(source: string): string[] {
  return [...source.matchAll(/\[([^\]]+)\]\(\s*([^)\s]+)[^)]*\)/g)]
    .filter(([, text = '', target = '']) => HOME_TARGET.test(target) && TOOL_ANCHOR.test(text))
    .map(([link]) => link)
}

describe('内容中的工具链接', () => {
  it('规则能识别以首页为计算器 / 排盘入口的链接', () => {
    expect(homeToolLinks('Use the [Life Path calculator](/), then')).toHaveLength(1)
    expect(homeToolLinks('回到[八字排盤](/zh-hant/)，或')).toHaveLength(1)
    expect(homeToolLinks('[만세력](/ko#top)에서')).toHaveLength(1)
    expect(homeToolLinks('[Life Path Number Calculator](/life-path-number)')).toEqual([])
    expect(homeToolLinks('[八字排盘](/zh-hans/八字排盘)')).toEqual([])
    expect(homeToolLinks('[Arcanumber](/)')).toEqual([])
  })

  it('西方站内容不以 `/`、东方站内容不以语言首页作为工具链接', () => {
    const files = mdxFiles(contentRoot)
    expect(files.length).toBeGreaterThan(300)
    const offending = files.flatMap((file) =>
      homeToolLinks(readFileSync(file, 'utf8')).map(
        (link) => `${relative(contentRoot, file)}: ${link}`,
      ),
    )
    expect(offending).toEqual([])
  })
})
