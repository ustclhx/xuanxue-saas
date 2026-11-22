// node --test apps/web/scripts/measure-locale-similarity.test.mjs
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, test } from 'node:test'
import {
  COMPONENT_SECTIONS,
  componentSections,
  componentText,
  createExtractor,
  dice,
  digitSeq,
  eastCollection,
  eastCollectionSections,
  eastSectionTitle,
  entryLocale,
  evaluatePage,
  exceedsEastSectionThreshold,
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
import { enforcedFailures, measureSite, siteClient } from './measure-locale-similarity.mjs'

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

describe('东方站集合', () => {
  test('只纳入规划中的各语言子页，概念页限第二批地址', () => {
    const selected = [
      ['/zh-hans/生肖/属鼠', 'zh-Hans', 'zodiac'],
      ['/zh-hant/生肖/屬雞', 'zh-Hant', 'zodiac'],
      ['/ko/띠/원숭이띠', 'ko', 'zodiac'],
      ['/zh-hans/黄历/12月', 'zh-Hans', 'almanac-month'],
      ['/zh-hans/十四主星/紫微星', 'zh-Hans', 'ziwei-star'],
      ['/zh-hans/八字/太岁', 'zh-Hans', 'concepts'],
      ['/zh-hans/八字/调候', 'zh-Hans', 'concepts'],
    ]
    const ignored = [
      ['/zh-hans/生肖', 'zh-Hans'],
      ['/zh-hans/黄历', 'zh-Hans'],
      ['/zh-hans/黄历/12月1日', 'zh-Hans'],
      ['/zh-hans/黄历/13月', 'zh-Hans'],
      ['/zh-hans/十四主星', 'zh-Hans'],
      ['/zh-hans/八字/大运', 'zh-Hans'],
      ['/zh-hant/八字/太歲', 'zh-Hant'],
      ['/ko/띠/쥐띠', 'zh-Hans'],
    ]
    for (const [path, locale, collection] of selected)
      assert.equal(eastCollection(encodeURI(path), locale), collection, path)
    for (const [path, locale] of ignored) assert.equal(eastCollection(path, locale), null, path)
  })

  test('显式标记 H2 或其容器，保留表格中的数字供 Dice 使用', () => {
    const out = extractor.extract(
      page(`
        <h2 data-table-section>年份</h2><div data-locale-fixed>甲子 2026</div>
        <section data-table-section><h2>逐日表</h2><p>乙丑</p></section>
        <h2>解释</h2><p>丙寅</p>`),
      { eastProgrammatic: true },
    )
    assert.deepEqual(
      out.eastSections.slice(1).map(({ title, tableSection }) => [title, tableSection]),
      [
        ['年份', true],
        ['逐日表', true],
        ['解释', false],
      ],
    )
    assert.equal(out.eastSections[1].text, '甲子 2026')
    assert.equal(out.sections[1].text, '甲子')
  })

  test('按 H2 对齐并计算字二元组两两均值与最差页，列出单页段的覆盖范围', () => {
    const pages = [
      ['a', '<h2>연도 설명</h2><p>갑을병정</p><h2>다른 제목</h2><p>갑을병정</p>'],
      [
        'b',
        '<h2>별도 제목</h2><p>갑을병정</p><h2 data-table-section>연도  설명</h2><p>갑을병무</p>',
      ],
      ['c', '<h2>연도 설명</h2><p>갑을병정</p>'],
    ].map(([id, body]) => ({
      id,
      sections: extractor.extract(page(body), { eastProgrammatic: true }).eastSections,
    }))
    const rows = eastCollectionSections(pages, { unit: unitOf('ko') })
    const section = rows.find((row) => row.title === '연도 설명')
    assert.equal(section.pages, 3)
    assert.equal(section.scope, 'section', '同名段只有全部页面标记后才能豁免')
    assert.ok(Math.abs(section.mean - 7 / 9) < Number.EPSILON)
    assert.ok(Math.abs(section.max - 5 / 6) < Number.EPSILON)
    assert.equal(section.maxPage, 'a')
    const unmatched = rows.find((row) => row.title === '별도 제목')
    assert.deepEqual([unmatched.pages, unmatched.mean, unmatched.maxPage], [1, null, null])
  })

  test('生肖集合的小标题去掉띠名与地支后对齐，其他集合不变', () => {
    assert.equal(
      eastSectionTitle('zodiac', '원숭이띠 성격과 일하는 방식'),
      '{띠} 성격과 일하는 방식',
    )
    assert.equal(eastSectionTitle('zodiac', '소띠의 일과 배움'), '{띠}의 일과 배움')
    assert.equal(
      eastSectionTitle('zodiac', '해(亥)의 육합·삼합·충·형·해'),
      '{지지}의 육합·삼합·충·형·해',
    )
    assert.equal(eastSectionTitle('zodiac', '屬雞的流年'), '{生肖}的流年')
    assert.equal(eastSectionTitle('zodiac', '올해 흐름'), '올해 흐름')
    assert.equal(eastSectionTitle('almanac-month', '쥐띠 성격'), '쥐띠 성격')
    const pages = [
      ['/ko/띠/쥐띠', '쥐띠 성격과 일하는 방식', '자(子)의 육합·삼합·충·형·해'],
      ['/ko/띠/소띠', '소띠 성격과 일하는 방식', '축(丑)의 육합·삼합·충·형·해'],
      ['/ko/띠/원숭이띠', '원숭이띠 성격과 일하는 방식', '신(申)의 육합·삼합·충·형·해'],
    ].map(([id, a, b]) => ({
      id,
      sections: sectionsFromText(`도입\n@@H2@@${a}@@\n갑을병정무\n@@H2@@${b}@@\n기경신임계`)
        .sections,
    }))
    const rows = eastCollectionSections(pages, { unit: unitOf('ko'), collection: 'zodiac' })
    const titles = rows
      .filter((row) => row.scope === 'section')
      .map((row) => [row.title, row.pages])
    assert.deepEqual(titles, [
      ['{띠} 성격과 일하는 방식', 3],
      ['{지지}의 육합·삼합·충·형·해', 3],
    ])
    // 不传集合时按可见标题对齐，各段只有一页
    assert.ok(
      eastCollectionSections(pages, { unit: unitOf('ko') })
        .filter((row) => row.scope === 'section')
        .every((row) => row.pages === 1),
    )
  })

  test('生肖集合的页面（路径分类为 other）也判结构直译分', () => {
    const literal = { literalScore: 0.65, digitOverlap: 0 }
    const zodiac = { kind: 'other', collection: 'zodiac', pairs: { ko: { literal } } }
    assert.deepEqual(evaluatePage(zodiac, 'ko'), ['literal 0.65'])
    const other = { kind: 'other', collection: null, pairs: { ko: { literal } } }
    assert.deepEqual(evaluatePage(other, 'ko'), [])
    const ok = { ...zodiac, pairs: { ko: { literal: { literalScore: 0.6, digitOverlap: 0 } } } }
    assert.deepEqual(evaluatePage(ok, 'ko'), [])
  })

  test('两两均值恰为 0.30 时忽略浮点累加误差', () => {
    const text = [
      `甲甲${'乙'.repeat(34)}${'丁'.repeat(65)}`,
      `甲甲${'丙'.repeat(57)}${'戊'.repeat(42)}`,
      `${'乙'.repeat(34)}${'丙'.repeat(57)}${'己'.repeat(10)}`,
    ]
    const pages = text.map((body, id) => ({
      id,
      sections: sectionsFromText(`@@H2@@段落@@\n${body}`).sections,
    }))
    const [section] = eastCollectionSections(pages)
    assert.ok(Math.abs(section.mean - 0.3) < Number.EPSILON)
    assert.equal(exceedsEastSectionThreshold(section), false)
  })

  test('从站点地图访问 SSR 黄历月页，门槛比较未舍入平均值且只约束正文段', async (t) => {
    const months = ['/zh-hans/黄历/1月', '/zh-hans/黄历/2月']
    const root = 'https://ganjiday.com'
    const sitemap = `<urlset>${months
      .map(
        (path) =>
          `<url><loc>${root}${path}</loc><xhtml:link rel="alternate" hreflang="zh-Hans" href="${root}${path}"/></url>`,
      )
      .join('')}</urlset>`
    const section = (matching, suffix) =>
      `${'甲'.repeat(matching)}${suffix.repeat(5001 - matching)}`
    const server = createServer((request, response) => {
      const path = decodeURIComponent(new URL(request.url, root).pathname)
      if (path === '/sitemap.xml') {
        response.end(
          `<sitemapindex><sitemap><loc>${root}/sitemap/zh-hans.xml</loc></sitemap></sitemapindex>`,
        )
      } else if (path === '/sitemap/zh-hans.xml') {
        response.end(sitemap)
      } else if (months.includes(path)) {
        const suffix = path === months[0] ? '乙' : '丙'
        response.end(
          page(`
            <h2>本月节气</h2><p>${section(1501, suffix)}</p>
            <h2>常见问题</h2><p>${section(1502, suffix)}</p>
            <section data-table-section><h2>逐日表</h2><p>${'丁'.repeat(10000)}</p></section>`),
        )
      } else {
        response.writeHead(404).end()
      }
    })
    await once(server.listen(0, '127.0.0.1'), 'listening')
    t.after(() => new Promise((resolve) => server.close(resolve)))
    const config = { sites: { east: { locales: ['zh-Hans'] } } }
    const client = await siteClient(config, 'east', `http://127.0.0.1:${server.address().port}`)
    const report = await measureSite({
      siteId: 'east',
      siteLocales: client.site.locales,
      entries: client.entries,
      fetchHtml: client.fetchHtml,
      pivot: 'zh-Hans',
      contentDir: join(tmpdir(), 'no-such-content-dir'),
      enforce: ['zh-Hans', 'ko'],
    })
    const rows = report.eastCollections['zh-Hans']['almanac-month']
    assert.equal(rows.find((row) => row.title === '本月节气').mean, 0.3)
    assert.equal(rows.find((row) => row.title === '常见问题').mean, 0.3002)
    assert.equal(rows.find((row) => row.scope === 'table').mean, 1)
    assert.ok(rows.find((row) => row.scope === 'page').mean > 0.3)
    assert.deepEqual(report.enforcedFailures, [
      'zh-Hans almanac-month 常见问题: 0.3002（最差 /zh-hans/黄历/1月 0.3002）',
    ])
    assert.deepEqual(enforcedFailures(report, ['ko']), [])
    const markdown = renderMarkdown(report)
    assert.match(markdown, /## 东方站集合/)
    assert.match(markdown, /常见问题 \| 门槛 \| 2 \| 0\.3002 ⚠/)
    assert.match(markdown, /逐日表 \| 数据表（参考） \| 2 \| 1/)
    assert.match(markdown, /整页 \| 整页（参考） \| 2/)
  })
})

describe('组件段（content-growth-phase1 1.1）', () => {
  const rule = (id) => COMPONENT_SECTIONS.find((r) => r.id === id)
  const disclaimer = 'Consulta a un profesional médico.'

  test('按 en / es 段标题对齐，与段的位置无关', () => {
    const page = {
      sections: [
        { title: '(intro)', text: 'H1' },
        { title: 'Extra', text: 'x' },
        { title: 'Saca una carta', text: 'Piensa en una pregunta.' },
      ],
    }
    assert.equal(componentText(page, rule('tarot-try')), 'Piensa en una pregunta.')
    assert.equal(componentText(page, rule('tarot-related')), null)
    assert.equal(
      componentText(
        { sections: [{ title: 'Try a one-card draw', text: 'en' }] },
        rule('tarot-try'),
      ),
      'en',
    )
  })

  test('首屏样例截到结果区声明为止；没有声明时取整段', () => {
    const page = {
      sections: [
        {
          title: 'Número de vida',
          text: `Número de vida 7\nEjemplo.\n${disclaimer}\nTexto introductorio del MDX que no es del componente.`,
        },
      ],
    }
    assert.equal(
      componentText(page, rule('number-sample'), { disclaimer }),
      `Número de vida 7\nEjemplo.\n${disclaimer}`,
    )
    assert.match(componentText(page, rule('number-sample')), /introductorio/)
    // 其余数字段不截断
    const other = { sections: [{ title: 'Explora los otros números', text: `${disclaimer} más` }] }
    assert.equal(
      componentText(other, rule('number-neighbors'), { disclaimer }),
      `${disclaimer} más`,
    )
  })

  test('每段输出平均 Dice 与最差页；只统计对应集合', () => {
    const fixed = 'Think of one question and draw a single card from the shuffled deck.'
    const tarot = (id, related) => ({
      id,
      kind: 'tarot-card',
      sections: [
        { title: '(intro)', text: `${id} intro words unique to ${id} page alone` },
        { title: 'Try a one-card draw', text: fixed },
        { title: 'Related card meanings', text: related },
      ],
    })
    const pages = [
      tarot('/a', 'alpha beta gamma delta'),
      tarot('/b', 'epsilon zeta eta theta'),
      tarot('/c', 'alpha beta gamma delta'),
      { id: '/life-path-number/1', kind: 'numerology-number', sections: [] },
    ]
    const out = componentSections(pages, { unit: 'word' })
    assert.deepEqual(
      out.map((s) => s.id),
      ['tarot-intro', 'tarot-try', 'tarot-related'],
    )
    const byId = Object.fromEntries(out.map((s) => [s.id, s]))
    assert.equal(byId['tarot-try'].mean, 1)
    assert.equal(byId['tarot-try'].pages, 3)
    assert.ok(byId['tarot-related'].mean < 0.5)
    assert.ok(['/a', '/c'].includes(byId['tarot-related'].maxPage))
  })

  test('--enforce：组件段 >0.30 计入失败；基准语言不判 FAQ 来源与 MDX 源模板重复', () => {
    const report = {
      pivot: 'en',
      pairs: {},
      templateRepeat: {
        rendered: {},
        source: {
          'numerology:en': { slots: [{ index: 8, title: 'Explore', mean: 0.5 }] },
          'numerology:es': { slots: [{ index: 3, title: 'Explora', mean: 0.4 }] },
        },
      },
      componentSections: {
        en: [{ kind: 'tarot-card', label: '抽一张', mean: 1, max: 1, maxPage: '/x' }],
        es: [{ kind: 'tarot-card', label: '抽一张', mean: 0.3, max: 0.31, maxPage: '/y' }],
      },
      faqOrigin: { en: { failing: ['tarot/en/a.mdx'] }, es: { failing: ['tarot/es/a.mdx'] } },
      lengths: { en: { failing: [] }, es: { failing: [] } },
    }
    const failures = enforcedFailures(report, ['en', 'es'])
    assert.ok(failures.some((f) => f.startsWith('en component tarot-card 抽一张: 1')))
    assert.ok(!failures.some((f) => f.startsWith('es component')), '0.30 不超门槛')
    assert.ok(!failures.some((f) => f.includes('en FAQ origin')))
    assert.ok(!failures.some((f) => f.startsWith('numerology:en')))
    assert.ok(failures.includes('es FAQ origin: tarot/es/a.mdx'))
    assert.ok(failures.some((f) => f.startsWith('numerology:es')))
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

  test('en / es 牌义页输出组件段报告，按 --enforce 判定', async () => {
    const card = (h1, extra) =>
      page(
        `<h1>${h1}</h1><p>Lede.</p>${extra}<h2>Try a one-card draw</h2><p>Think of one question and draw a single card now.</p>`,
      )
    const cards = {
      '/tarot/cards/a': card('The Fool', ''),
      '/tarot/cards/b': card('The Magician', '<h2>Extra</h2><p>Only here.</p>'),
    }
    const report = await measureSite({
      siteId: 'west',
      siteLocales: ['en', 'es'],
      entries: Object.keys(cards).map((path) => ({
        loc: `https://w.com${path}`,
        alts: { en: `https://w.com${path}` },
      })),
      fetchHtml: async (path) => cards[path],
      pivot: 'en',
      contentDir: join(tmpdir(), 'no-such-content-dir'),
      enforce: ['en'],
    })
    const tryCard = report.componentSections.en.find((s) => s.id === 'tarot-try')
    assert.equal(tryCard.pages, 2)
    assert.equal(tryCard.mean, 1)
    assert.ok(report.enforcedFailures.some((f) => f.startsWith('en component tarot-card 抽一张')))
    assert.match(renderMarkdown(report), /## 组件段（渲染页，按段标题对齐；门槛）/)
    assert.doesNotMatch(renderMarkdown(report), /## 东方站集合/)
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
    assert.deepEqual(report.eastCollections, {})
  })
})
