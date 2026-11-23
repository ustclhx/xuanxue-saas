// node --test apps/web/scripts/audit-verdict.test.mjs
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createVerdictAuditor, isAuditPage } from './audit-verdict.mjs'

const zodiac = 'https://ganjiday.com/zh-hans/生肖/属鼠'
const westernPair = 'https://arcanumber.com/zodiac-compatibility/aries-and-leo'

const html = (lang, body, { title = '', head = '', beforeMain = '' } = {}) =>
  `<!doctype html><html lang="${lang}"><head><title>${title}</title>${head}</head><body>
  ${beforeMain}<main>${body}</main></body></html>`

function auditor(t) {
  const instance = createVerdictAuditor()
  t.after(instance.close)
  return instance.audit
}

test('两个规则分别选择第 2 阶段集合与东西站的关系类页面', () => {
  const cases = [
    ['east', '/zh-hans/生肖/', true, true],
    ['east', '/zh-hant/生肖/屬鼠', true, true],
    ['east', '/ko/띠/쥐띠', true, true],
    ['east', '/zh-hans/黄历/1月', false, true],
    ['east', '/zh-hans/十四主星/紫微星', false, true],
    ['east', '/zh-hans/八字/太岁', false, false],
    ['east', '/zh-hant/農民曆', false, false],
    ['east', '/chinese-zodiac', true, false],
    ['east', '/ko/사주궁합', true, false],
    ['east', '/zh-hans/八字合盘/合婚', true, false],
    ['east', '/zh-hant/八字合盤/親子', true, false],
    ['east', '/ja/四柱推命相性/友人', true, false],
    ['east', '/bazi-compatibility/business-partners', true, false],
    ['east', '/zh-hans/生肖配对/属鼠和属牛', true, false],
    ['east', '/ko/띠궁합', true, false],
    ['east', '/chinese-zodiac-compatibility/rat-and-ox', true, false],
    ['east', '/zodiac-compatibility/aries-and-leo', false, false],
    ['west', '/zodiac-signs/aries', true, false],
    ['west', '/zodiac-compatibility', true, false],
    ['west', '/es/zodiac-compatibility/aries-and-leo', true, false],
    ['west', '/tarot/career', true, false],
    ['west', '/tarot/full-moon', true, false],
    ['west', '/tarot/love', true, false],
    ['west', '/tarot/yes-or-no', false, false],
    ['west', '/synastry', true, false],
    ['west', '/chinese-zodiac', false, false],
  ]
  for (const [site, path, verdict, marriageTopic] of cases) {
    assert.equal(isAuditPage(site, encodeURI(path), 'verdict'), verdict, `${site} ${path}`)
    assert.equal(isAuditPage(site, path, 'marriage-topic'), marriageTopic, `${site} ${path}`)
  }
})

test('判定词报告 Title、H1、H2、FAQ、正文与锚文本的位置', (t) => {
  const audit = auditor(t)
  const body = `
    <h1>不能结婚</h1><h2>会离婚</h2>
    <p>两人注定<span>分手</span>。</p>
    <a href="/reference">最佳婚配</a>
    <section><h2>常见问题</h2><details><summary>这是什么意思？</summary><p>克夫。</p></details></section>`
  const hits = audit(html('zh-Hans', body, { title: '不宜结婚' }), { url: zodiac, rule: 'verdict' })
  for (const [position, term] of [
    ['Title', '不宜结婚'],
    ['H1', '不能结婚'],
    ['H2', '会离婚'],
    ['FAQ', '克夫'],
    ['正文', '注定分手'],
    ['锚文本 (/reference)', '最佳婚配'],
  ])
    assert.ok(
      hits.some((hit) => hit.position === position && hit.term === term),
      position,
    )
  assert.ok(!hits.some((hit) => hit.term === '宜结婚'))
})

test('判定词表识别繁中、韩语、日语、英语与西语措辞，允许描述婚姻主题', (t) => {
  const audit = auditor(t)
  for (const [lang, neutral, term] of [
    ['zh-Hant', '八字合盤中的婚姻主題', '會離婚'],
    ['ko', '결혼과 관계 주제', '결혼하면 안'],
    ['ja', '結婚生活を考える', '結婚してはいけない'],
    ['en', 'Marriage compatibility', 'SHOULD NOT MARRY'],
    ['es', 'Compatibilidad matrimonial', 'se divorciarán'],
  ]) {
    const options = { url: westernPair, rule: 'verdict' }
    assert.deepEqual(audit(html(lang, `<h1>${neutral}</h1>`), options), [])
    assert.ok(audit(html(lang, `<h1>${term}</h1>`), options).some((hit) => hit.term === term))
  }
})

test('正文保留行内词组和字符实体，忽略脚本、属性和不同段落拼出的词组', (t) => {
  const audit = auditor(t)
  const body = `
    <h1>Compatibility</h1>
    <p>They should</p><p>not marry the term to a verdict.</p>
    <p title="will divorce">Undoomed</p>
    <script>const copy = 'will divorce'</script>
    <p>They will&nbsp;<strong>divorce</strong>.</p>`
  const hits = audit(html('en', body), { url: westernPair, rule: 'verdict' })
  assert.deepEqual(hits, [{ position: '正文', term: 'will divorce', text: 'They will divorce.' }])
})

test('婚配主题规则只豁免旧生肖页正文中指向本站配对子页的锚文本', (t) => {
  const audit = auditor(t)
  const target = '/zh-hans/生肖配对/属鼠和属牛'
  const body = `
    <p><a href="../生肖配对/属鼠和属牛#facts">生肖配对</a></p>
    <p><a href="https://example.com${target}">站外配对</a></p>
    <p><a href="/zh-hans/生肖配对">配对总表</a></p>
    <h2><a href="${target}">配对标题</a></h2>
    <section id="faq"><h2>FAQ</h2><p><a href="${target}">FAQ 里的配对</a></p></section>
    <p>这是普通正文里的婚配话题。</p>`
  const hits = audit(html('zh-Hans', body), { url: zodiac, rule: 'marriage-topic' })
  assert.deepEqual(
    [...new Set(hits.map((hit) => hit.text))].sort(),
    ['FAQ 里的配对', '站外配对', '配对总表', '配对标题'].sort(),
  )

  const link = `<p><a href="${target}">不宜结婚</a></p>`
  const almanac = 'https://ganjiday.com/zh-hans/黄历'
  assert.ok(audit(html('zh-Hans', link), { url: almanac, rule: 'marriage-topic' }).length > 0)
  assert.ok(audit(html('zh-Hans', link), { url: zodiac, rule: 'verdict' }).length > 0)
})

test('旧黄历规则检查 FAQ 结构化数据，保留普通宜忌表和共享导航', (t) => {
  const audit = auditor(t)
  const head = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'FAQPage',
    mainEntity: [{ name: '婚嫁吉日', acceptedAnswer: { text: '时日比较' } }],
  })}</script>`
  const beforeMain = '<header><a href="/zh-hans/八字合盘/合婚">合婚</a></header>'
  const body = '<h1>黄历</h1><table><tr><td>嫁娶</td><td>纳采</td></tr></table>'
  const hits = audit(html('zh-Hans', body, { head, beforeMain }), {
    url: 'https://ganjiday.com/zh-hans/黄历/1月',
    rule: 'marriage-topic',
  })
  assert.deepEqual(hits, [{ position: 'FAQ', term: '婚嫁', text: '婚嫁吉日' }])
})

test('CLI 遇到构建页 FAQ 判定词时以 1 退出，并输出地址与位置', async (t) => {
  const pageUrl = new URL(westernPair)
  const server = createServer((req, res) => {
    if (req.url === '/sitemap.xml') {
      const entries = req.headers.host.startsWith('west.')
        ? `<url><loc>${westernPair}</loc></url>`
        : ''
      res.end(`<urlset>${entries}</urlset>`)
    } else if (req.url === pageUrl.pathname) {
      res.end(html('en', '<section><h2>FAQ</h2><p>You will divorce.</p></section>'))
    } else {
      res.writeHead(404).end()
    }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  t.after(() => new Promise((done) => server.close(done)))
  const cli = fileURLToPath(new URL('./audit-verdict.mjs', import.meta.url))
  await assert.rejects(
    promisify(execFile)(process.execPath, [
      cli,
      '--rule',
      'verdict',
      '--base-url',
      `http://127.0.0.1:${server.address().port}`,
    ]),
    (error) => error.code === 1 && error.stderr.includes(`${westernPair} [FAQ] 「will divorce」`),
  )
})
