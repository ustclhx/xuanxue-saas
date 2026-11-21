// node --test apps/web/scripts/measure-locale-similarity.test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, test } from 'node:test'
import {
  createExtractor,
  dice,
  digitSeq,
  entryLocale,
  faqOriginStats,
  lengthCheck,
  literalScore,
  mdxSections,
  pageKind,
  parseSitemap,
  renderMarkdown,
  sectionsFromText,
  sentenceReuse,
  seqDice,
  templateRepeat,
  unitOf,
  variantSimilarity,
} from './locale-similarity.mjs'
import { measureSite } from './measure-locale-similarity.mjs'

const extractor = createExtractor()
after(() => extractor.close())

const page = (main) =>
  `<!doctype html><html><head><title>t</title><script>var x=1</script></head><body><nav>菜单</nav><main>${main}</main><footer>页脚</footer></body></html>`

describe('正文提取', () => {
  test('取 main、去掉表单与导航、按 H2 切段并统计 FAQ', () => {
    const html = page(
      `<h1>标题</h1><p>导语第一段，介绍这个页面。</p><nav>站内导航</nav><form><label>出生日期</label></form>
       <h2>怎么看命盘</h2><p>第一段说明文字<strong>加粗</strong>继续。</p><p>第二段说明文字。</p>
       <h2>常见问题</h2><details><summary>问一？</summary><p>答一。</p></details><details><summary>问二？</summary><p>答二。</p></details>
       <svg><text>svg 字</text></svg>`,
    )
    const out = extractor.extract(html)
    assert.deepEqual(
      out.sections.map((s) => [s.title, s.kind]),
      [
        ['(intro)', 'intro'],
        ['怎么看命盘', 'howto'],
        ['常见问题', 'faq'],
      ],
    )
    assert.equal(out.faqCount, 2)
    assert.match(out.sections[1].text, /第一段说明文字加粗继续。\n第二段说明文字。/)
    assert.equal(out.sections[1].paras, 1, '长度 >8 的行才算段落')
    const all = out.sections.map((s) => s.text).join('')
    for (const removed of ['菜单', '站内导航', '出生日期', 'svg 字', '页脚', 'var x'])
      assert.ok(!all.includes(removed), removed)
  })

  test('行内空白保留为一个空格，实体解码', () => {
    const out = extractor.extract(page('<p>Life  <em>Path</em>\n  number &amp; you</p>'))
    assert.equal(out.sections[0].text, 'Life Path number & you')
  })

  test('引擎输出与固定事实表中的数字不计入数字序列，正文示例中的数字照常计入', () => {
    const html = page(
      `<p>Ejemplo: Lucía nació el 26 de septiembre de 1983.</p>
       <section data-locale-fixed><p>Número de vida 2</p><div><span>9 → 9</span><span>1983 → 21 → 3</span></div></section>
       <div class="rich-table-scroll"><table><tr><td>Afinidad alta</td><td>1, 5, 7</td></tr></table></div>`,
    )
    const out = extractor.extract(html)
    const digits = digitSeq(out.sections.map((s) => s.text).join('\n'))
    assert.equal(digits, '26 1983')
    // 文字保留，参与其他指标
    assert.match(out.sections[0].text, /Número de vida/)
    assert.match(out.sections[0].text, /Afinidad alta/)
  })

  test('sectionsFromText 处理没有 H2 的页面', () => {
    const out = sectionsFromText('只有导语')
    assert.equal(out.sections.length, 1)
    assert.equal(out.chars, 4)
  })
})

describe('相似度指标', () => {
  test('字二元组 Dice：相同为 1、无共同二元组为 0，忽略标点与空白', () => {
    assert.equal(dice('太阳正位，喜悦', '太阳正位喜悦！'), 1)
    assert.equal(dice('甲乙丙丁', '戊己庚辛'), 0)
  })

  test('词二元组 Dice：拼音文字按相邻词对计', () => {
    assert.equal(dice('The Sun is bright', 'the sun IS bright', 'word'), 1)
    assert.equal(dice('the sun is bright', 'bright is sun the', 'word'), 0)
    assert.equal(unitOf('es'), 'word')
    assert.equal(unitOf('ja'), 'char')
  })

  test('整句复现率按基准页句子计', () => {
    assert.equal(
      sentenceReuse('第一句话很长很长。第二句话也很长。', '第一句话很长很长。别的句子写法。'),
      0.5,
    )
    assert.equal(
      sentenceReuse(
        'One two three four. Five six seven eight.',
        'One two three four. Nine.',
        'word',
      ),
      0.5,
    )
  })

  test('数字序列重合度是多重集 Dice', () => {
    assert.equal(seqDice('1990 5 15', '1990 5 15'), 1)
    assert.equal(seqDice('1990 5', '1988 7'), 0)
    assert.equal(seqDice('7 7 1', '7 1 2'), (2 * 2) / 6)
  })

  const mk = (sections, faqCount = 0) => {
    const parsed = sectionsFromText(
      sections.map(([t, b], i) => (i ? `@@H2@@${t}@@\n${b}` : b)).join('\n'),
      faqCount,
    )
    return parsed
  }

  test('结构直译分：逐段对译接近 1，重写结构明显更低', () => {
    const body = '这一段的内容足够长，用来让长度比进入计算，并且包含数字 1990 与 15。'.repeat(2)
    const zh = mk(
      [
        ['', '导语'],
        ['一', body],
        ['二', body],
        ['常见问题', body],
      ],
      3,
    )
    const literal = mk(
      [
        ['', '도입'],
        ['하나', `${body}더`],
        ['둘', `${body}더`],
        ['FAQ', `${body}더`],
      ],
      3,
    )
    const rewritten = mk(
      [
        ['', '도입'],
        ['다른', `${'완전히 다른 구성 '.repeat(20)}2001`],
        ['FAQ', '짧음'],
      ],
      5,
    )
    assert.ok(literalScore(zh, literal).literalScore >= 0.9)
    assert.ok(literalScore(zh, rewritten).literalScore <= 0.4)
    assert.equal(literalScore(zh, literal).digitOverlap, 1)
  })

  test('同文字变体按转换后的同名标题配对段落', () => {
    const base = mk([
      ['', '导语'],
      ['常见问题', '问答内容完全一样'],
      ['正文', '正文内容'],
    ])
    const variant = mk([
      ['', '導語'],
      ['正文', '完全不同的寫法'],
      ['常見問題', '问答内容完全一样'],
    ])
    const convert = (t) => t.replace('常見問題', '常见问题').replace('導語', '导语')
    const v = variantSimilarity(base, variant, { convert })
    assert.equal(v.sections.find((s) => s.title === '常见问题').dice, 1)
    assert.equal(v.faqMax, 1)
    assert.equal(v.sameSectionCount, true)
  })
})

describe('模板重复', () => {
  test('按位置两两求 Dice，max 指出最模板化的一页', () => {
    const pages = [
      {
        id: 'a',
        sections: [
          { title: '是或否', text: '这张牌偏向是，固定模板句子' },
          { title: 'x', text: '甲乙丙丁戊' },
        ],
      },
      {
        id: 'b',
        sections: [
          { title: '是或否', text: '这张牌偏向是，固定模板句子' },
          { title: 'x', text: '己庚辛壬癸' },
        ],
      },
      {
        id: 'c',
        sections: [
          { title: '是或否', text: '完全另写的判断说明' },
          { title: 'x', text: '子丑寅卯辰' },
        ],
      },
    ]
    const [yesNo, other] = templateRepeat(pages)
    assert.equal(yesNo.pages, 3)
    assert.ok(yesNo.mean > 0.3)
    assert.ok(['a', 'b'].includes(yesNo.maxPage))
    assert.equal(other.mean, 0)
  })

  test('MDX 源按 ## 切段并去掉链接地址', () => {
    const src =
      '---\ntitle: x\n---\n\n导语不计\n\n## 相关牌阵\n\n试试[凯尔特十字](/zh-hans/塔罗/凯尔特十字)。\n\n## 常见问题\n\n问答'
    const secs = mdxSections(src)
    assert.deepEqual(
      secs.map((s) => s.title),
      ['相关牌阵', '常见问题'],
    )
    assert.ok(!secs[0].text.includes('/zh-hans'))
    assert.ok(secs[0].text.includes('[凯尔特十字]'))
  })
})

describe('分类、站点地图、长度与 FAQ 来源', () => {
  test('页面分类覆盖两站与新语言路径', () => {
    const cases = {
      '/zh-hans/%E5%A1%94%E7%BD%97/%E7%89%8C%E4%B9%89/the-sun': 'tarot-card',
      '/zh-hans/塔罗/牌义': 'tarot-card-index',
      '/ko/타로': 'tarot-draw',
      '/zh-hant/八字/大運': 'concept',
      '/ko/만세력': 'tool',
      '/ja/四柱推命': 'tool',
      '/ja/タロット/カード/the-sun': 'tarot-card',
      '/es/tarot/cartas/the-sun': 'tarot-card',
      '/life-path-number/7': 'numerology-number',
      '/es/numero-de-vida/11': 'numerology-number',
      '/numerology-calculator': 'tool',
      '/': 'home',
      '/es': 'home',
      '/faq': 'faq',
      '/zh-hans/terms': 'legal',
      '/pricing': 'other',
    }
    for (const [path, kind] of Object.entries(cases)) assert.equal(pageKind(path), kind, path)
  })

  test('站点地图解析 loc 与 hreflang，条目语言取 href 等于 loc 的一项', () => {
    const index = parseSitemap(
      '<sitemapindex><sitemap><loc>https://a.com/sitemap/en.xml</loc></sitemap></sitemapindex>',
    )
    assert.deepEqual(index.index, ['https://a.com/sitemap/en.xml'])
    const { urls } = parseSitemap(
      '<urlset><url><loc>https://a.com/es?a=1&amp;b=2</loc><xhtml:link rel="alternate" href="https://a.com/?a=1&amp;b=2" hreflang="en"/><xhtml:link rel="alternate" hreflang="es" href="https://a.com/es?a=1&amp;b=2"/><xhtml:link rel="alternate" hreflang="x-default" href="https://a.com/es?a=1&amp;b=2"/></url></urlset>',
    )
    assert.equal(urls[0].loc, 'https://a.com/es?a=1&b=2')
    assert.equal(entryLocale(urls[0]), 'es')
  })

  test('长度下限：工具页按绝对值，程序化页面按源页比例（同单位才比）', () => {
    assert.equal(
      lengthCheck({ kind: 'tool', locale: 'es', length: { unit: 'words', value: 599 } }).ok,
      false,
    )
    assert.equal(
      lengthCheck({ kind: 'tool', locale: 'ja', length: { unit: 'chars', value: 1500 } }).ok,
      true,
    )
    assert.equal(
      lengthCheck({ kind: 'tool', locale: 'ko', length: { unit: 'chars', value: 10 } }),
      null,
    )
    const card = lengthCheck({
      kind: 'tarot-card',
      locale: 'es',
      length: { unit: 'words', value: 69 },
      sourceLength: { unit: 'words', value: 100 },
    })
    assert.deepEqual([card.ok, card.ratio], [false, 0.69])
    assert.equal(
      lengthCheck({
        kind: 'tarot-card',
        locale: 'ja',
        length: { unit: 'chars', value: 10 },
        sourceLength: { unit: 'words', value: 100 },
      }),
      null,
    )
  })

  test('FAQ origin：每页 local ≥2（不足 3 问时至少一半），文案键按前缀成组', () => {
    const dir = mkdtempSync(join(tmpdir(), 'faq-origin-'))
    try {
      mkdirSync(join(dir, 'tarot', 'es'), { recursive: true })
      writeFileSync(
        join(dir, 'tarot', 'es', 'ok.mdx'),
        '---\ntitle: x\nfaq:\n  - q: a\n    a: b\n    origin: local\n  - q: c\n    a: d\n    origin: local\n  - q: e\n    a: f\n    origin: adapted\n---\n',
      )
      writeFileSync(
        join(dir, 'tarot', 'es', 'bad.mdx'),
        '---\ntitle: x\nfaq: [{"q": "a", "a": "b", "origin": "adapted"}, {"q": "c", "a": "d"}]\n---\n',
      )
      const stats = faqOriginStats({
        contentDir: dir,
        locale: 'es',
        messageOrigins: { numerology_faq_q1: 'local', numerology_faq_q2: 'adapted' },
      })
      assert.deepEqual(
        [stats.pages, stats.questions, stats.local, stats.adapted, stats.missing],
        [3, 7, 3, 3, 1],
      )
      assert.deepEqual(stats.failing, ['tarot/es/bad.mdx'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('measureSite', () => {
  const html = {
    '/': page(
      '<p>Intro sentence for the English home page.</p><h2>Tools</h2><p>Life path 7 and 1990.</p>',
    ),
    '/es': page(
      '<p>Intro sentence for the English home page.</p><h2>Tools</h2><p>Life path 7 and 1990.</p>',
    ),
    '/pt-br': page(
      '<p>Uma introdução escrita do zero para o Brasil.</p><h2>Ferramentas</h2><p>Número 3.</p>',
    ),
    '/pt-pt': page(
      '<p>Uma introdução escrita do zero para o Brasil.</p><h2>Ferramentas</h2><p>Número 3.</p>',
    ),
  }
  const alts = {
    en: 'https://w.com/',
    es: 'https://w.com/es',
    'pt-BR': 'https://w.com/pt-br',
    'pt-PT': 'https://w.com/pt-pt',
  }
  const entries = Object.values(alts).map((loc) => ({ loc, alts }))

  test('按 hreflang 配对：跨语言算直译分，同文字变体算 Dice，并按 --enforce 汇总失败', async () => {
    const report = await measureSite({
      siteId: 'west',
      siteLocales: ['en', 'es', 'pt-BR', 'pt-PT'],
      entries,
      fetchHtml: async (path) => html[path],
      pivot: 'en',
      extraPairs: [['pt-PT', 'pt-BR']],
      contentDir: join(tmpdir(), 'no-such-content-dir'),
      enforce: ['es', 'pt-PT'],
    })
    assert.deepEqual(report.pageCounts, { en: 1, es: 1, 'pt-BR': 1, 'pt-PT': 1 })
    const home = report.pages.find((p) => p.path === '/' && p.base === 'en')
    assert.equal(home.pairs.es.literal.literalScore, 1)
    const variant = report.pages.find((p) => p.base === 'pt-BR')
    assert.equal(variant.pairs['pt-PT~pt-BR'].variant.dice, 1)
    assert.equal(report.pairs['pt-PT~pt-BR'].type, 'variant')
    assert.ok(report.enforcedFailures.some((f) => f.startsWith('es /: literal 1')))
    assert.ok(report.enforcedFailures.some((f) => f.includes('variant dice 1')))
    assert.match(renderMarkdown(report), /## es ↔ en（跨语言）/)
  })

  test('需要转换器的变体在缺少转换器时跳过并说明', async () => {
    const report = await measureSite({
      siteId: 'east',
      siteLocales: ['zh-Hans', 'zh-Hant'],
      entries: [
        {
          loc: 'https://e.com/zh-hans',
          alts: { 'zh-Hans': 'https://e.com/zh-hans', 'zh-Hant': 'https://e.com/zh-hant' },
        },
        {
          loc: 'https://e.com/zh-hant',
          alts: { 'zh-Hans': 'https://e.com/zh-hans', 'zh-Hant': 'https://e.com/zh-hant' },
        },
      ],
      fetchHtml: async () => page('<p>内容</p>'),
      pivot: 'zh-Hans',
      contentDir: join(tmpdir(), 'no-such-content-dir'),
    })
    assert.match(report.pairs['zh-Hant'].skipped, /--opencc/)
  })
})
