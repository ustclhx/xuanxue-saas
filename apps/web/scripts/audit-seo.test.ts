import { describe, expect, it } from 'vitest'
import { type AuditPage, auditLinks, auditTdk, cjkWidth, tdkLength } from './audit-seo.mjs'
import { parsePage } from './check-links-graph.mjs'

const ORIGIN = 'http://west.localhost:4000'
const hosts = new Set([new URL(ORIGIN).host])

/** 一页夹具：页头一条导航链接 + 正文若干链接（锚文本、目标） */
function page(path: string, body: [string, string][], extra = ''): AuditPage {
  const links = body.map(([href, text]) => `<a href="${href}">${text}</a>`).join(' ')
  const html = `<html lang="en"><head><title>T ${path}</title><meta name="description" content="D"></head><body>
    <header data-link-zone="nav"><nav><a href="/">Home</a></nav></header>
    <main><h1>H ${path}</h1><p>${links}</p>${extra}</main></body></html>`
  return { path, url: `${ORIGIN}${path}`, status: 200, html, parsed: parsePage(html) }
}

function audit(pages: AuditPage[], moneyPages: string[] = []) {
  const paths = pages.map((entry) => entry.path)
  return auditLinks({
    pages,
    targets: new Map(paths.map((path) => [path, 200])),
    indexable: new Set(paths),
    homes: ['/'],
    internalHosts: hosts,
    moneyPages,
  })
}

describe('audit-seo 链接审计', () => {
  it('孤岛、正文内链下限、钱页入链与锚文本规则', () => {
    const result = audit(
      [
        page('/', [
          ['/a', 'Alpha'],
          ['/b', 'Beta'],
        ]),
        page('/a', [
          ['/b', 'Beta'],
          ['/c', 'Gamma one'],
        ]),
        page('/b', [
          ['/a', 'alpha'],
          ['/c', 'Gamma two'],
        ]),
        page('/c', [['/a', 'Alpha guide']]),
        page('/orphan', [
          ['/a', 'Alpha'],
          ['/b', 'Beta'],
        ]),
      ],
      ['/c'],
    )
    const rules = (rule: string) =>
      result.violations.filter((item) => item.rule === rule).map((item) => item.page)
    expect(rules('orphan')).toEqual(['/orphan'])
    // /c 只有 1 条正文内链
    expect(rules('body-links')).toEqual(['/c'])
    // 钱页 /c 只有 2 个正文来源
    expect(rules('money-inlinks')).toEqual(['/c'])
    // /a 有 Alpha（大小写合并）、Alpha guide 两种；/c 有三种表述之外的两种：Gamma one、Gamma two
    expect(rules('anchor-variants')).toEqual([])
    const anchorA = result.anchors.find((item) => item.path === '/a')
    expect(anchorA?.wordings.map((item) => [item.wording, item.count])).toEqual([
      ['alpha', 3],
      ['alpha guide', 1],
    ])
    // 入链不足 5 条时 top1 占比只作提示
    expect(rules('anchor-top-share')).toEqual([])
    expect(result.notes.some((item) => item.rule === 'anchor-top-share-small')).toBe(true)
  })

  it('导航层与转化入口不计入正文内链和锚文本', () => {
    const cta = '<a href="/a" data-link-zone="action">Start Alpha</a>'
    const result = audit([
      page('/', [
        ['/a', 'Alpha'],
        ['/b', 'Beta'],
      ]),
      page(
        '/a',
        [
          ['/b', 'Beta'],
          ['/', 'Home page'],
        ],
        cta,
      ),
      page('/b', [
        ['/a', 'Alpha'],
        ['/', 'Home page'],
      ]),
    ])
    expect(result.bodyLinks['/a']).toBe(2)
    const wordings = result.anchors.find((item) => item.path === '/a')?.wordings ?? []
    expect(wordings.map((item) => item.wording)).toEqual(['alpha'])
  })
})

describe('audit-seo TDK 长度', () => {
  it('中文按全角宽度，韩文同口径（半角计 0.5），英文按字符', () => {
    expect(cjkWidth('干支日｜免費八字排盤')).toBe(10)
    expect(cjkWidth('간지데이 | 무료')).toBe(7.5)
    expect(tdkLength('Arcanumber', 'en')).toBe(10)
    expect(tdkLength('塔罗牌义：78 张', 'zh-Hans')).toBe(7.5)
    const [row] = auditTdk([page('/x', [])])
    expect(row).toMatchObject({ title: 'T /x', description: 'D', h1: ['H /x'], titleOver: false })
  })
})
