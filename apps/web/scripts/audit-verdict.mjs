// content-growth-v2-tools 决策 14：从构建后的站点地图取页，覆盖预渲染和 SSR。
// 用法：node apps/web/scripts/audit-verdict.mjs --rule verdict|marriage-topic [--base-url <preview>]
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { Window } from 'happy-dom'
import { startPreview } from './check-links.mjs'
import { sectionKind, structuredText } from './locale-similarity.mjs'
import { loadTemplateConfig, pool, siteClient } from './measure-locale-similarity.mjs'

const VERDICT_TERMS = {
  zh: [
    '宜结婚',
    '宜結婚',
    '不宜结婚',
    '不宜結婚',
    '不能结婚',
    '不能結婚',
    '能不能结婚',
    '能不能結婚',
    '会离婚',
    '會離婚',
    '必离',
    '必離',
    '克夫',
    '剋夫',
    '克妻',
    '剋妻',
    '注定分手',
    '註定分手',
    '必然分手',
    '最佳婚配',
    '不能在一起',
    '不能嫁',
  ],
  ko: [
    '결혼하면 안',
    '결혼해야',
    '이혼수',
    '이혼하게 됩',
    '상극이라 헤어',
    '헤어질 운명',
    '최고의 혼인 상대',
    '남편을 해치는',
    '아내를 해치는',
  ],
  ja: [
    '結婚してはいけない',
    '結婚すべき',
    '離婚する',
    '離婚します',
    '必ず別れる',
    '別れる運命',
    '最良の結婚相手',
    '夫を不幸にする',
    '妻を不幸にする',
  ],
  en: [
    'should marry',
    'should not marry',
    'must not marry',
    'cannot marry',
    'will divorce',
    'will get divorced',
    'doomed',
    'destined to break up',
    'best marriage match',
    'brings misfortune to her husband',
    'brings misfortune to his wife',
  ],
  es: [
    'deberían casarse',
    'no deberían casarse',
    'no deben casarse',
    'no pueden casarse',
    'se divorciarán',
    'se van a divorciar',
    'destinados a separarse',
    'destinadas a separarse',
    'condenados a separarse',
    'condenadas a separarse',
    'mejor pareja para casarse',
    'trae desgracia a su esposo',
    'trae desgracia a su esposa',
  ],
}

// content-growth-phase2「约束」的词表，补齐 zh-Hant 生肖页的对应字形。
const MARRIAGE_TOPIC_TERMS = [
  '婚配',
  '配对',
  '配對',
  '合婚',
  '结婚',
  '結婚',
  '婚嫁',
  '嫁娶吉日',
  '궁합',
]
const PHASE2_ZODIAC = /^\/(?:(?:zh-hans|zh-hant)\/生肖|ko\/띠)(?:\/[^/]+)?$/u
const PHASE2_OTHER = /^\/zh-hans\/(?:黄历|十四主星)(?:\/[^/]+)?$/u
const EAST_COMPAT =
  /^\/(?:zh-hans\/八字合盘|zh-hant\/八字合盤|ko\/사주궁합|ja\/四柱推命相性|bazi-compatibility)(?:\/[^/]+)?$/u
const EAST_ZODIAC_PAIR =
  /^\/(?:zh-hans\/生肖配对|ko\/띠궁합|chinese-zodiac-compatibility)(\/[^/]+)?$/u
const WEST_ZODIAC = /^\/(?:es\/)?(?:zodiac-signs|zodiac-compatibility)(?:\/[^/]+)?$/
const WEST_SPREAD = /^\/(?:es\/)?tarot\/(?:love|career|full-moon)$/
const NON_TEXT = 'script,style,template,noscript,svg'
const GLOBAL_NAV = '[data-link-zone="nav"]'
const FAQ_REGION = '[data-faq], [data-landing-block="faq"], #faq, [itemtype$="/FAQPage"]'

function normalizePath(pathname) {
  try {
    return decodeURI(pathname).replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function isAuditPage(site, path, rule) {
  const pathname = normalizePath(path)
  if (site === 'east') {
    if (PHASE2_ZODIAC.test(pathname)) return true
    if (rule === 'marriage-topic') return PHASE2_OTHER.test(pathname)
    return (
      EAST_COMPAT.test(pathname) ||
      EAST_ZODIAC_PAIR.test(pathname) ||
      pathname === '/chinese-zodiac'
    )
  }
  return (
    site === 'west' &&
    rule === 'verdict' &&
    (WEST_ZODIAC.test(pathname) || WEST_SPREAD.test(pathname) || pathname === '/synastry')
  )
}

const normalized = (text) => text.normalize('NFKC').replace(/\s+/gu, ' ').trim()

function compileTerms(terms, wordBoundaries = false) {
  // 优先报告完整词组，例如「不宜结婚」。
  const alternatives = [...terms]
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = alternatives.join('|')
  return new RegExp(
    wordBoundaries ? `(?<![\\p{L}\\p{M}\\p{N}])(?:${pattern})(?![\\p{L}\\p{M}\\p{N}])` : pattern,
    'giu',
  )
}

const TOPIC_PATTERN = compileTerms(MARRIAGE_TOPIC_TERMS)
const VERDICT_PATTERNS = Object.fromEntries(
  Object.entries(VERDICT_TERMS).map(([lang, terms]) => [
    lang,
    compileTerms(terms, lang === 'en' || lang === 'es'),
  ]),
)

function faqRegions(root) {
  const regions = new Set(root.querySelectorAll(FAQ_REGION))
  for (const heading of root.querySelectorAll('h2')) {
    if (sectionKind(heading.textContent, 1) !== 'faq') continue
    const section = heading.closest('section')
    if (section?.querySelector('h2') === heading) {
      regions.add(section)
      continue
    }
    // MDX 的 FAQ 可以是同一容器内的连续段落。
    for (
      let next = heading.nextElementSibling;
      next && !next.matches('h1,h2');
      next = next.nextElementSibling
    )
      regions.add(next)
  }
  return [...regions].filter(
    (region) => ![...regions].some((other) => other !== region && other.contains(region)),
  )
}

function faqSchemaText(document) {
  const text = []
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const json = JSON.parse(script.textContent)
    for (const entry of [json].flat().flatMap((item) => item?.['@graph'] ?? item)) {
      if (![entry?.['@type']].flat().includes('FAQPage')) continue
      for (const question of [entry.mainEntity].flat()) {
        text.push(question?.name)
        for (const answer of [question?.acceptedAnswer].flat()) text.push(answer?.text)
      }
    }
  }
  return text.filter((item) => typeof item === 'string')
}

function exemptPairAnchor(anchor, pageUrl, faq) {
  // 只豁免生肖页正文里指向本站生肖配对子页的锚文本；标题、FAQ、全站导航不在此例外中。
  if (!PHASE2_ZODIAC.test(normalizePath(pageUrl.pathname))) return false
  if (anchor.closest('h1,h2') || faq.some((region) => region.contains(anchor))) return false
  const destination = URL.parse(anchor.getAttribute('href'), pageUrl)
  return (
    destination?.origin === pageUrl.origin &&
    Boolean(EAST_ZODIAC_PAIR.exec(normalizePath(destination.pathname))?.[1])
  )
}

export function createVerdictAuditor() {
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
      disableComputedStyleRendering: true,
    },
  })
  const parser = new window.DOMParser()
  return {
    audit(html, { url, rule }) {
      const document = parser.parseFromString(html, 'text/html')
      const pageUrl = new URL(url)
      const lang = document.documentElement.lang.toLowerCase().split('-')[0]
      const pattern = rule === 'verdict' ? VERDICT_PATTERNS[lang] : TOPIC_PATTERN
      if (!pattern) throw new Error(`缺少页面语言或词表：${url}（${lang}）`)
      const root = document.querySelector('main') ?? document.body
      const hits = []
      const seen = new Set()
      const check = (position, raw) => {
        const text = normalized(raw)
        for (const [term] of text.matchAll(pattern)) {
          const key = JSON.stringify([position, term.toLowerCase(), text])
          if (seen.has(key)) continue
          seen.add(key)
          hits.push({ position, term, text })
        }
      }

      check('Title', document.title)
      for (const text of faqSchemaText(document))
        check('FAQ', structuredText(parser.parseFromString(text, 'text/html').body))
      // 页头页脚是共享导航，旧规则审计的是本页锚文本。
      const anchorsRoot = rule === 'marriage-topic' ? root : document.body
      for (const element of document.querySelectorAll(NON_TEXT)) element.remove()
      const faq = faqRegions(root)
      for (const anchor of anchorsRoot.querySelectorAll('a[href]')) {
        if (
          rule === 'marriage-topic' &&
          (anchor.closest(GLOBAL_NAV) || exemptPairAnchor(anchor, pageUrl, faq))
        )
          continue
        const href = anchor.getAttribute('href')
        check(
          `锚文本 (${href})`,
          structuredText(anchor) || anchor.querySelector('img[alt]')?.alt || '',
        )
      }
      for (const heading of root.querySelectorAll('h1,h2'))
        check(heading.tagName, structuredText(heading))
      for (const region of faq)
        for (const line of structuredText(region).split('\n')) check('FAQ', line)

      if (rule === 'verdict') {
        for (const element of [...root.querySelectorAll('h1,h2'), ...faq]) element.remove()
        for (const line of structuredText(root).split('\n')) check('正文', line)
      }
      return hits
    },
    close: () => window.happyDOM.close(),
  }
}

async function main() {
  const { values } = parseArgs({
    options: { rule: { type: 'string' }, 'base-url': { type: 'string' } },
  })
  const rule = values.rule
  if (rule !== 'verdict' && rule !== 'marriage-topic')
    throw new Error('请指定 --rule verdict 或 --rule marriage-topic')

  const config = await loadTemplateConfig()
  const preview = values['base-url'] ? null : await startPreview()
  const auditor = createVerdictAuditor()
  const baseUrl = values['base-url'] ?? preview.baseUrl
  let pages = 0
  let violations = 0
  try {
    for (const site of rule === 'verdict' ? ['east', 'west'] : ['east']) {
      const { entries, fetchHtml } = await siteClient(config, site, baseUrl)
      const scoped = [...new Set(entries.map(({ loc }) => loc))].filter((url) =>
        isAuditPage(site, new URL(url).pathname, rule),
      )
      const reports = await pool(scoped, async (url) => {
        const html = await fetchHtml(new URL(url).pathname)
        return { url, hits: auditor.audit(html, { url, rule }) }
      })
      pages += reports.length
      console.log(`${site}：检查 ${reports.length} 页`)
      for (const { url, hits } of reports) {
        violations += hits.length
        for (const { position, term, text } of hits)
          console.error(`  ${decodeURI(url)} [${position}] 「${term}」：${text}`)
      }
    }
  } finally {
    preview?.stop()
    await auditor.close()
  }
  if (pages === 0) throw new Error(`没有可审计页面（${rule}）`)
  console.log(`${rule}：共检查 ${pages} 页，命中 ${violations} 处`)
  if (violations > 0) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
