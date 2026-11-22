// 本地化质量测量的纯函数库（OpenSpec add-locales-eu-ja 任务 2.1，design 决策 10）。
// 由 SEO 修复第 5 步的 part-b 脚本（measure.mjs / measure-intra.mjs）移植：口径与公式保持一致，
// 以便新旧结果可以直接对比；HTML 解析改用仓库已有的 happy-dom，不引入 node-html-parser / opencc。
// CLI 见 measure-locale-similarity.mjs，回译见 measure-locale-backtranslation.mjs。
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { Window } from 'happy-dom'

/** 门槛（localized-content-quality spec 与 design 决策 10）；报告按此判定，只有 --enforce 的语言影响退出码 */
export const THRESHOLDS = Object.freeze({
  // 1. 结构直译分：正文为主的页面（落地页、工具页、数字页、FAQ 页）；牌义页因组件固定结构不用此项
  literalScore: 0.6,
  // 3. 数字序列重合度：含示例的页面
  digitOverlap: 0.5,
  // 4. 同语言程序化集合按位置段落的平均 Dice
  templateRepeat: 0.3,
  // 5. 同文字变体：整页 Dice / 整句复现 / FAQ 段
  variantDice: 0.6,
  variantReuse: 0.15,
  variantFaqDice: 0.4,
  // 6. FAQ：每页 origin=local 至少 2 问（不足 3 问时至少一半）
  faqLocalMin: 2,
  // 7. 长度下限：工具页正文 ≥600 词（ja 1,500 字）；数字页与牌义页不少于源语言对应页的 70%
  toolMinWords: 600,
  toolMinChars: { ja: 1500 },
  programmaticLengthRatio: 0.7,
  // 2. 回译（measure-locale-backtranslation.mjs）：默认阈值，校准后取 min(默认, 对照组中位数 − margin)
  backTranslation: 0.5,
  backTranslationFaq: 0.4,
  backTranslationMargin: 0.2,
})

/** 没有空格分词的书写系统用字二元组（与 part-b 一致，ko 也按字计）；其他语言用词二元组 */
const CHAR_UNIT_LOCALES = new Set(['zh-Hant', 'zh-Hans', 'ja', 'ko'])
export const unitOf = (locale) => (CHAR_UNIT_LOCALES.has(locale) ? 'char' : 'word')

/**
 * 同文字变体：对比前把 `locale` 的正文转换到 `of` 的写法再比较。
 * `convert: 't2s'` 需要 OpenCC（只在证据目录安装，见 CLI 的 --opencc）；其余变体直接比较。
 */
export const SCRIPT_VARIANTS = Object.freeze({
  'zh-Hant': { of: 'zh-Hans', convert: 't2s' },
  'pt-PT': { of: 'pt-BR' },
})

/** 程序化页面集合：同语言内按位置对比段落（模板重复）与按源语言对应页比较长度 */
export const PROGRAMMATIC_KINDS = Object.freeze(['tarot-card', 'numerology-number', 'concept'])
/** 结构直译分适用的页面类型（正文为主） */
export const LITERAL_KINDS = Object.freeze(['home', 'tool', 'numerology-number', 'faq'])
/**
 * 另外判结构直译分的东方站集合（content-growth-phase2 任务 5.3，协调者 2026-11-22）：ko 与 zh-hans 生肖页
 * 共用版式骨架，按路径分类为 other，须单独纳入，否则跨语言直译不进门槛。
 */
export const LITERAL_COLLECTIONS = Object.freeze(['zodiac'])
/** 数字序列重合度适用的页面类型（含计算示例） */
export const EXAMPLE_KINDS = Object.freeze(['tool', 'numerology-number', 'concept'])

// ---------------------------------------------------------------------------
// 页面与段落分类
// ---------------------------------------------------------------------------

const CARD_SEGMENTS = '牌义|牌義|카드|cards|カード|cartas|cartes|karten|carte'
const TOOL_SEGMENTS = [
  // 东方站（与 part-b 相同）
  '八字排盘|八字排盤|紫微斗数排盘|紫微斗數排盤|命盘查询|命盤查詢|만세력|사주궁합',
  // 东方站 ja（design 决策 2）
  '四柱推命|紫微斗数',
  // 西方站 en / es
  'life-path-number|numerology-calculator|life-path-compatibility|numerology-chart|name-numerology|destiny-number|soul-urge-number',
  'numero-de-vida|calculadora-numerologia|numerologia-del-nombre|compatibilidad-numerologica|carta-numerologica|numero-del-destino|numero-del-alma',
].join('|')
const HOME_LOCALES = 'zh-hans|zh-hant|ko|en|ja|es|pt-br|fr|de|it'

/** 按路径给页面分类（东方站分类与 part-b 的 kind() 一致，另补西方站与新语言的路径） */
export function pageKind(pathname) {
  const d = safeDecode(pathname)
  if (new RegExp(`/(${CARD_SEGMENTS})/.`).test(d)) return 'tarot-card'
  if (new RegExp(`/(${CARD_SEGMENTS})$`).test(d)) return 'tarot-card-index'
  if (/\/(塔罗|塔羅|타로|tarot|タロット)(\/|$)/.test(d)) return 'tarot-draw'
  if (/\/(八字|사주)\//.test(d)) return 'concept'
  if (/\/(life-path-number|numero-de-vida)\/\d+$/.test(d)) return 'numerology-number'
  if (/(每日运势|每日運勢|오늘의-운세|daily-numerology)$/.test(d)) return 'daily'
  if (new RegExp(`/(${TOOL_SEGMENTS})$`).test(d)) return 'tool'
  if (/\/(privacy|terms|refund|disclaimer|operator)$/.test(d)) return 'legal'
  if (new RegExp(`^/(${HOME_LOCALES})?/?$`).test(d)) return 'home'
  if (/\/faq$/.test(d)) return 'faq'
  return 'other'
}

// content-growth-phase2 决策 1、8：只纳入子页。后续批次按实际进入站点地图或预渲染的地址测量。
const EAST_COLLECTIONS = {
  'zh-Hans': [
    ['zodiac', /^\/zh-hans\/生肖\/属[鼠牛虎兔龙蛇马羊猴鸡狗猪]\/?$/],
    ['almanac-month', /^\/zh-hans\/黄历\/(?:[1-9]|1[0-2])月\/?$/],
    [
      'ziwei-star',
      /^\/zh-hans\/十四主星\/(?:紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军)星\/?$/,
    ],
    ['concepts', /^\/zh-hans\/八字\/(?:天干地支|藏干|十二长生|纳音|合冲刑害|太岁|格局|调候)\/?$/],
  ],
  'zh-Hant': [['zodiac', /^\/zh-hant\/生肖\/屬[鼠牛虎兔龍蛇馬羊猴雞狗豬]\/?$/]],
  ko: [['zodiac', /^\/ko\/띠\/(?:쥐|소|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)띠\/?$/]],
}

/**
 * 集合内按页面变化的小标题部分（content-growth-phase2 第 5 组，协调者 2026-11-22）：ko 生肖页的设计稿小标题带本页띠名与地支
 * （「쥐띠 성격과 일하는 방식」「자(子)의 육합·삼합·충·형·해」），不归一时这些段各只有一页、不进门槛。
 * 归一后同位置的段对齐计算；zh-Hant 生肖页（第 9 组）的「屬X」同理。
 */
const EAST_TITLE_TOKENS = {
  zodiac: [
    [/(?:쥐|소|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)띠/gu, '{띠}'],
    [/[자축인묘진사오미신유술해]\([子丑寅卯辰巳午未申酉戌亥]\)/gu, '{지지}'],
    [/[属屬][鼠牛虎兔龙龍蛇马馬羊猴鸡雞狗猪豬]/gu, '{生肖}'],
  ],
}

/** 东方站集合的段标题归一（没有规则的集合原样返回） */
export function eastSectionTitle(collection, title) {
  return (EAST_TITLE_TOKENS[collection] ?? []).reduce(
    (text, [pattern, token]) => text.replace(pattern, token),
    title,
  )
}

export function eastCollection(pathname, locale) {
  const path = safeDecode(pathname)
  return EAST_COLLECTIONS[locale]?.find(([, pattern]) => pattern.test(path))?.[0] ?? null
}

const FAQ_RE =
  /常见问题|常見問題|자주 묻는 질문|FAQ|よくある質問|frequently asked|preguntas frecuentes|perguntas frequentes|questions fréquentes|häufige fragen|domande frequenti/i
const HOWTO_RE = /怎么|怎麼|如何|步骤|步驟|看法|읽는|방법|보는 법|사용|使い方|読み方|how to|cómo/i
const EXAMPLE_RE = /示例|範例|范例|例子|举例|舉例|예시|예:|計算例|example|ejemplo/i

export function sectionKind(title, index) {
  if (index === 0) return 'intro'
  if (FAQ_RE.test(title)) return 'faq'
  if (EXAMPLE_RE.test(title)) return 'examples'
  if (HOWTO_RE.test(title)) return 'howto'
  return 'body'
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------
// 正文提取（happy-dom）：取 <main>，去掉 script/style/form/nav/svg/noscript/template，按 H2 切段
// ---------------------------------------------------------------------------

/** 与 part-b 所用 node-html-parser 的 structuredText 相同的块级元素 */
const BLOCK_TAGS = new Set(
  'h1 h2 h3 h4 h5 h6 header hgroup details dialog dd div dt fieldset figcaption figure footer form table td tr address article aside blockquote br hr li main nav ol p pre section ul'.split(
    ' ',
  ),
)
const REMOVED = 'script,style,form,nav,svg,noscript,template'
/**
 * 引擎输出与固定事实（计算器结果、计算步骤组件、数字网格与表格、相邻数字等）：两种语言共用同一组数字，
 * 数字序列重合度不计其中的数字（协调者 2026-11-21 决定；正文示例中的数字照常计入）。
 * 组件以 `data-locale-fixed` 标记；MDX 正文中的表格（.rich-table-scroll）是固定事实表。文字照常参与其他指标。
 */
export const FIXED_DIGITS_SELECTOR = '[data-locale-fixed], .rich-table-scroll'

/** 去掉元素内全部文本节点中的数字（保留其他文字与结构） */
export function stripFixedDigits(root) {
  for (const el of [...root.querySelectorAll(FIXED_DIGITS_SELECTOR)]) {
    const stack = [el]
    while (stack.length) {
      const node = stack.pop()
      if (node.nodeType === 3) node.textContent = node.textContent.replace(/\d/g, '')
      else stack.push(...node.childNodes)
    }
  }
}
const H2_MARK = '@@H2@@'

/** 去掉首尾空白，但保留一个首/尾的行内空格（node-html-parser trimText 的行为） */
function trimText(text) {
  const start = text.search(/\S/)
  if (start < 0) return ''
  let end = text.length - 1
  while (end > start && /\s/.test(text[end])) end -= 1
  const lead = start > 0 && /[^\S\r\n]/.test(text[start - 1])
  const trail = end < text.length - 1 && /[^\S\r\n]/.test(text[end + 1])
  return (lead ? ' ' : '') + text.slice(start, end + 1) + (trail ? ' ' : '')
}

/** 块级元素换行、行内元素拼接；每行内多个空白合并为一个 */
export function structuredText(root) {
  let current = []
  const blocks = [current]
  const next = () => {
    current = []
    blocks.push(current)
  }
  const walk = (node) => {
    if (node.nodeType === 1) {
      const block = BLOCK_TAGS.has(node.localName)
      if (block && current.length > 0) next()
      for (const child of node.childNodes) walk(child)
      if (block && current.length > 0) next()
    } else if (node.nodeType === 3) {
      const data = node.data
      if (/^\s*$/.test(data)) {
        if (current.length > 0) current.space = true
        return
      }
      let text = trimText(data)
      if (current.space) {
        text = ` ${text}`
        current.space = false
      }
      current.push(text)
    }
  }
  walk(root)
  return blocks
    .map((block) =>
      block
        .join('')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .join('\n')
    .replace(/\s+$/, '')
}

/**
 * 解析器：一个 happy-dom Window 复用于全部页面，不执行脚本、不加载外部资源。用完调用 close()。
 */
export function createExtractor() {
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
    extract(html, { eastProgrammatic = false } = {}) {
      const doc = parser.parseFromString(html, 'text/html')
      return extractDocument(doc, eastProgrammatic)
    },
    close() {
      return window.happyDOM.close()
    },
  }
}

function extractDocument(doc, eastProgrammatic) {
  const main = doc.querySelector('main') ?? doc.body ?? doc.documentElement
  for (const el of [...main.querySelectorAll(REMOVED)]) el.remove()
  const eastSections = eastProgrammatic
    ? extractSections(main.cloneNode(true), { tableSections: true }).sections
    : null
  stripFixedDigits(main)
  const page = extractSections(main)
  if (eastSections) page.eastSections = eastSections
  return page
}

function extractSections(main, { tableSections = false } = {}) {
  const faqCount = main.querySelectorAll('details summary').length
  const headings = [...main.querySelectorAll('h2')]
  for (const h of headings) {
    const title = h.textContent.trim()
    h.textContent = `\n${H2_MARK}${title}@@\n`
  }
  const page = sectionsFromText(structuredText(main), faqCount)
  if (tableSections)
    for (const [i, h] of headings.entries()) {
      // 标记 H2 或仅包裹该数据表段的容器。表格单元的数字仍参与东方站 Dice。
      page.sections[i + 1].tableSection = h.closest('[data-table-section]') !== null
    }
  return page
}

/** 把带 H2 标记的结构化文本切成段：H2 之前为 intro */
export function sectionsFromText(raw, faqCount = 0) {
  const parts = raw.split(H2_MARK)
  const sections = parts.map((part, i) => {
    let title = '(intro)'
    let body = part
    if (i > 0) {
      const end = part.indexOf('@@')
      title = part.slice(0, end)
      body = part.slice(end + 2)
    }
    const text = body.replace(/[ \t]+/g, ' ').trim()
    return {
      title,
      kind: sectionKind(title, i),
      text,
      paras: text.split(/\n+/).filter((s) => s.trim().length > 8).length,
    }
  })
  return {
    sections,
    faqCount,
    chars: norm(raw.replaceAll(H2_MARK, '').replaceAll('@@', '')).length,
  }
}

export const fullText = (page) => page.sections.map((s) => s.text).join('\n')

// ---------------------------------------------------------------------------
// 相似度与结构指标（公式与 part-b 相同）
// ---------------------------------------------------------------------------

export const norm = (s) => s.replace(/[\s\p{P}\p{S}]/gu, '')

/** 词：字母或数字连续串（含词内撇号），统一小写 */
export const words = (s) =>
  s.toLowerCase().match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? []

/** 二元组多重集：unit=char 为去掉空白与标点后的字二元组，unit=word 为相邻词二元组 */
export function bigrams(s, unit = 'char') {
  const tokens = unit === 'word' ? words(s) : [...norm(s)]
  const m = new Map()
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = unit === 'word' ? `${tokens[i]} ${tokens[i + 1]}` : tokens[i] + tokens[i + 1]
    m.set(key, (m.get(key) ?? 0) + 1)
  }
  return { m, n: Math.max(0, tokens.length - 1) }
}

export function diceOf(A, B) {
  if (A.n + B.n === 0) return 1
  let inter = 0
  for (const [k, v] of A.m) inter += Math.min(v, B.m.get(k) ?? 0)
  return (2 * inter) / (A.n + B.n)
}

export const dice = (a, b, unit = 'char') => diceOf(bigrams(a, unit), bigrams(b, unit))

/** 句子：中日韩按全角句读与换行切分（与 part-b 相同）；拼音文字另按句点切分 */
export function sentences(s, unit = 'char') {
  const splitter = unit === 'word' ? /[。！？!?\n；;]+|\.(?=\s|$)/ : /[。！？!?\n；;]+/
  return s
    .split(splitter)
    .map((x) => (unit === 'word' ? words(x).join(' ') : norm(x)))
    .filter((x) => (unit === 'word' ? x.split(' ').length >= 4 : x.length >= 6))
}

/** 整句复现率：基准页的句子中，有多少在对比页中逐字出现 */
export function sentenceReuse(base, other, unit = 'char') {
  const S = sentences(base, unit)
  if (!S.length) return 1
  const set = new Set(sentences(other, unit))
  return S.filter((x) => set.has(x)).length / S.length
}

export const digitSeq = (s) => (s.match(/\d+/g) ?? []).join(' ')

/** 数字序列重合度：两页出现的数字（多重集）的 Dice */
export function seqDice(a, b) {
  const A = a.split(' ').filter(Boolean)
  const B = b.split(' ').filter(Boolean)
  if (!A.length && !B.length) return 1
  const bag = new Map()
  for (const x of A) bag.set(x, (bag.get(x) ?? 0) + 1)
  let inter = 0
  for (const x of B)
    if (bag.get(x)) {
      inter += 1
      bag.set(x, bag.get(x) - 1)
    }
  return (2 * inter) / (A.length + B.length)
}

export const r3 = (x) => Math.round(x * 1000) / 1000

/**
 * 同文字变体（part-b 的 zh-hant ↔ zh-hans）：`variant` 经 convert 转成 `base` 的写法后比较。
 * 段落优先按转换后的同名标题配对，找不到时按位置。
 */
export function variantSimilarity(base, variant, { convert = (t) => t, unit = 'char' } = {}) {
  const sections = base.sections.map((s, i) => {
    const o = variant.sections.find((h) => convert(h.title) === s.title) ?? variant.sections[i]
    const other = o ? convert(o.text) : ''
    return {
      title: s.title,
      kind: s.kind,
      chars: norm(s.text).length,
      dice: r3(dice(s.text, other, unit)),
      reuse: r3(sentenceReuse(s.text, other, unit)),
    }
  })
  const faq = sections.filter((s) => s.kind === 'faq').map((s) => s.dice)
  return {
    dice: r3(dice(fullText(base), convert(fullText(variant)), unit)),
    reuse: r3(sentenceReuse(fullText(base), convert(fullText(variant)), unit)),
    faqMax: faq.length ? Math.max(...faq) : null,
    sameSectionCount: base.sections.length === variant.sections.length,
    sameFaqCount: base.faqCount === variant.faqCount,
    sections,
  }
}

/**
 * 跨语言结构直译分（part-b 的 ko ↔ zh-hans）：段数一致 0.25、FAQ 数一致 0.15、段落数对齐率 0.25、
 * 段长比稳定（1 − 2×变异系数）0.2、数字序列重合 0.15。越接近 1 越像逐段对译。
 */
export function literalScore(source, target) {
  const n = Math.min(source.sections.length, target.sections.length)
  const ratios = []
  for (let i = 0; i < n; i += 1) {
    const a = norm(source.sections[i].text).length
    const b = norm(target.sections[i].text).length
    if (a > 40) ratios.push(b / a)
  }
  const mean = ratios.reduce((x, y) => x + y, 0) / (ratios.length || 1)
  const cv = ratios.length
    ? Math.sqrt(ratios.reduce((x, y) => x + (y - mean) ** 2, 0) / ratios.length) / mean
    : 0
  const paraMatch =
    source.sections.slice(0, n).filter((s, i) => s.paras === target.sections[i].paras).length /
    (n || 1)
  const digitOverlap = seqDice(digitSeq(fullText(source)), digitSeq(fullText(target)))
  const score =
    (source.sections.length === target.sections.length ? 1 : 0) * 0.25 +
    (source.faqCount === target.faqCount ? 1 : 0) * 0.15 +
    paraMatch * 0.25 +
    Math.max(0, 1 - cv * 2) * 0.2 +
    digitOverlap * 0.15
  return {
    sections: [source.sections.length, target.sections.length],
    faq: [source.faqCount, target.faqCount],
    lenRatio: r3(target.chars / (source.chars || 1)),
    sectionRatioCv: r3(cv),
    paraMatch: r3(paraMatch),
    digitOverlap: r3(digitOverlap),
    literalScore: r3(score),
  }
}

/**
 * 同语言模板重复（part-b 的 measure-intra）：同一集合内按位置对应的段落两两求 Dice。
 * pages: [{ id, sections: [{ title, text }] }]。返回每个位置的全体两两平均（mean）与
 * 「单页对其余页的平均」的最大值（max，指出最模板化的那一页）。
 */
export function templateRepeat(pages, { unit = 'char', skipIntro = false } = {}) {
  const byIndex = []
  for (const page of pages)
    page.sections.forEach((section, i) => {
      if (skipIntro && i === 0) return
      byIndex[i] ??= { index: i, title: section.title, items: [] }
      byIndex[i].items.push({ id: page.id, bg: bigrams(section.text, unit) })
    })
  return byIndex
    .filter((slot) => slot && slot.items.length > 1)
    .map(({ index, title, items }) => {
      const { mean, max, maxPage } = pairwiseDice(items)
      return { index, title, pages: items.length, mean: r3(mean), max: r3(max), maxPage }
    })
}

function pairwiseDice(items) {
  if (items.length < 2) return { mean: null, max: null, maxPage: null }
  const perPage = items.map(() => 0)
  let sum = 0
  let pairs = 0
  for (let i = 0; i < items.length; i += 1)
    for (let j = i + 1; j < items.length; j += 1) {
      const d = diceOf(items[i].bg, items[j].bg)
      sum += d
      pairs += 1
      perPage[i] += d
      perPage[j] += d
    }
  const pageMeans = perPage.map((total) => total / (items.length - 1))
  const max = Math.max(...pageMeans)
  return {
    mean: sum / pairs,
    max,
    maxPage: items[pageMeans.indexOf(max)].id,
  }
}

/** 同站同语言内按 H2 可见文字对齐；只有正文段的未舍入均值用于门槛。 */
export function eastCollectionSections(pages, { unit = 'char', collection = null } = {}) {
  const byTitle = new Map()
  for (const { id, sections } of pages) {
    for (const { title, text, tableSection } of sections.slice(1)) {
      const key = eastSectionTitle(collection, title.replace(/\s+/g, ' ').trim())
      if (!byTitle.has(key)) byTitle.set(key, new Map())
      const byPage = byTitle.get(key)
      const previous = byPage.get(id)
      byPage.set(id, {
        id,
        text: previous ? `${previous.text}\n${text}` : text,
        tableSection: (previous?.tableSection ?? true) && tableSection,
      })
    }
  }

  const measure = (title, scope, items) => ({
    title,
    scope,
    pages: items.length,
    ...pairwiseDice(items.map(({ id, text }) => ({ id, bg: bigrams(text, unit) }))),
  })
  const sections = [...byTitle].map(([title, byPage]) => {
    const items = [...byPage.values()]
    return measure(title, items.every((item) => item.tableSection) ? 'table' : 'section', items)
  })
  const wholePages = pages.map(({ id, sections: [intro, ...headings] }) => ({
    id,
    text: [intro.text, ...headings.map(({ title, text }) => `${title}\n${text}`)].join('\n'),
  }))
  return [...sections, measure('整页', 'page', wholePages)]
}

export function exceedsEastSectionThreshold({ scope, mean }) {
  // 只消除浮点累加误差，例如数学上的 0.30 可能是 0.30000000000000004。
  return scope === 'section' && mean != null && mean - THRESHOLDS.templateRepeat > Number.EPSILON
}

/**
 * MDX 源文件按 `## ` 切段（与 measure-intra 相同：frontmatter 之后，H2 之前的内容不计）。
 * 去掉 Markdown 链接地址、只留锚文本（与 #238 验收的「源文件层面去掉链接地址」口径一致）：
 * 链接目标与锚文本由内链规范约束，不算模板化正文。
 */
export function mdxSections(source) {
  const body = (source.split(/^---$/m)[2] ?? '').replace(/\]\([^)]*\)/g, ']')
  return body
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const nl = chunk.indexOf('\n')
      return { title: chunk.slice(0, nl).trim(), text: chunk.slice(nl) }
    })
}

/** 读取一个内容目录（如 content/tarot/zh-Hans）全部 MDX，按位置测模板重复 */
export function templateRepeatFromDir(dir, { unit = 'char', filter = () => true } = {}) {
  const pages = readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') && filter(f))
    .sort()
    .map((f) => ({ id: f, sections: mdxSections(readFileSync(join(dir, f), 'utf8')) }))
  return { pages: pages.length, slots: templateRepeat(pages, { unit }) }
}

// ---------------------------------------------------------------------------
// 组件段（OpenSpec content-growth-phase1 决策 9）：西方站牌义页与数字页上由组件输出的段，
// 按段标题对齐（不按位置：es 数字页各页 H2 数量不同，按位置会错位），只计组件输出部分
// ---------------------------------------------------------------------------

/** 组件段门槛只适用于逐页撰写了组件文案的语言 */
export const COMPONENT_LOCALES = Object.freeze(['en', 'es'])

/**
 * 组件段对照表：`title` 为 en/es 段标题正则；`cutAfter: 'disclaimer'` 表示截到结果区合规声明为止
 * （es 数字页 MDX 在第一个 H2 前的导语渲染后落在首屏样例段内，不属于组件输出）。
 */
export const COMPONENT_SECTIONS = Object.freeze([
  { kind: 'tarot-card', id: 'tarot-intro', label: '牌义页导语', title: /^\(intro\)$/ },
  {
    kind: 'tarot-card',
    id: 'tarot-try',
    label: '抽一张',
    title: /^(Try a one-card draw|Saca una carta)$/,
  },
  {
    kind: 'tarot-card',
    id: 'tarot-related',
    label: '延伸牌义',
    title: /^(Related card meanings|Significados relacionados)$/,
  },
  {
    kind: 'numerology-number',
    id: 'number-sample',
    label: '首屏样例',
    title: /^(Life Path|Número de vida)$/,
    cutAfter: 'disclaimer',
  },
  {
    kind: 'numerology-number',
    id: 'number-neighbors',
    label: '其余数字',
    title: /^(Explore the other numbers|Explora los otros números)$/,
  },
])

/** 取一页中某个组件段的文字；没有该段时返回 null。`disclaimer` 为本语言结果区声明全文 */
export function componentText(page, rule, { disclaimer } = {}) {
  const text = page.sections.find((s) => rule.title.test(s.title))?.text
  if (text == null) return null
  if (rule.cutAfter !== 'disclaimer' || !disclaimer) return text
  const at = text.indexOf(disclaimer)
  return at === -1 ? text : text.slice(0, at + disclaimer.length)
}

/**
 * 组件段报告：pages 为 [{ id, kind, sections }]（同一语言）。返回每段的页数、两两平均 Dice 与最差页；
 * 某段不足 2 页时不出行。
 */
export function componentSections(pages, { unit = 'word', disclaimer } = {}) {
  const out = []
  for (const rule of COMPONENT_SECTIONS) {
    const group = pages
      .filter((p) => p.kind === rule.kind)
      .map((p) => ({ id: p.id, text: componentText(p, rule, { disclaimer }) }))
      .filter((p) => p.text != null)
      .map((p) => ({ id: p.id, sections: [{ title: rule.label, text: p.text }] }))
    const [slot] = templateRepeat(group, { unit })
    if (!slot) continue
    out.push({
      id: rule.id,
      kind: rule.kind,
      label: rule.label,
      pages: slot.pages,
      mean: slot.mean,
      max: slot.max,
      maxPage: slot.maxPage,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// 长度、FAQ 来源、站点地图
// ---------------------------------------------------------------------------

/** 页面长度：中日韩按去标点后的字数，其他语言按词数 */
export function pageLength(page, locale) {
  const text = fullText(page)
  return unitOf(locale) === 'word'
    ? { unit: 'words', value: words(text).length }
    : { unit: 'chars', value: norm(text).length }
}

/**
 * 长度下限（决策 10 第 7 条）：工具页按绝对下限；程序化页面与源语言对应页同单位时按比例。
 * 返回 null 表示该页不适用。
 */
export function lengthCheck({ kind, locale, length, sourceLength }) {
  if (kind === 'tool') {
    const minChars = THRESHOLDS.toolMinChars[locale]
    if (minChars !== undefined)
      return { rule: `≥${minChars} chars`, ok: length.unit === 'chars' && length.value >= minChars }
    if (length.unit === 'words')
      return {
        rule: `≥${THRESHOLDS.toolMinWords} words`,
        ok: length.value >= THRESHOLDS.toolMinWords,
      }
    return null
  }
  if (PROGRAMMATIC_KINDS.includes(kind) && sourceLength && sourceLength.unit === length.unit) {
    const ratio = length.value / (sourceLength.value || 1)
    return {
      rule: `≥${THRESHOLDS.programmaticLengthRatio} × source`,
      ratio: r3(ratio),
      ok: ratio >= THRESHOLDS.programmaticLengthRatio,
    }
  }
  return null
}

const webRequire = createRequire(new URL('../package.json', import.meta.url))
let yamlModule
/** 复用内容管线的 YAML 解析器（与 scripts/check-content-concepts.mjs 相同），不新增依赖 */
export function parseYaml(text) {
  if (!yamlModule) {
    const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
    yamlModule = coreRequire('yaml')
  }
  return yamlModule.parse(text)
}

export function frontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---/.exec(source)
  return match ? (parseYaml(match[1]) ?? {}) : {}
}

/**
 * FAQ 来源统计（决策 10 第 6 条）：内容 frontmatter 的 `faq[].origin` 为 local | adapted。
 * 文案 JSON 中的 FAQ 用 `i18n/faq-origin/<locale>.json`（{ "<文案键>": "local" }）登记。
 */
export function faqOriginStats({ contentDir, locale, messageOrigins = null }) {
  const pages = []
  for (const collection of safeReaddir(contentDir)) {
    const dir = join(contentDir, collection, locale)
    for (const file of safeReaddir(dir).filter((f) => f.endsWith('.mdx'))) {
      const data = frontmatter(readFileSync(join(dir, file), 'utf8'))
      if (!Array.isArray(data.faq) || data.faq.length === 0) continue
      const counts = { local: 0, adapted: 0, missing: 0 }
      for (const item of data.faq) {
        if (item?.origin === 'local') counts.local += 1
        else if (item?.origin === 'adapted') counts.adapted += 1
        else counts.missing += 1
      }
      pages.push({ page: `${collection}/${locale}/${file}`, total: data.faq.length, ...counts })
    }
  }
  if (messageOrigins) {
    // 文案 FAQ 以键名前缀成组：`bazi_home_faq_q1` → `bazi_home_faq`，`tarot_daily_faq_1_q` → `tarot_daily_faq`
    const groups = new Map()
    // 也可按页面分组登记：{ "<页面路径>": { "<文案键>": "local" } }（汇总页、定价页的问答键没有共同前缀）
    const entries = Object.entries(messageOrigins).flatMap(([key, origin]) =>
      origin && typeof origin === 'object'
        ? Object.values(origin).map((value) => [key, value])
        : [[key.replace(/_\d+_q$|_?q?\d+$/, ''), origin]],
    )
    for (const [group, origin] of entries) {
      const counts = groups.get(group) ?? { local: 0, adapted: 0, missing: 0 }
      if (origin === 'local') counts.local += 1
      else if (origin === 'adapted') counts.adapted += 1
      else counts.missing += 1
      groups.set(group, counts)
    }
    for (const [group, counts] of groups)
      pages.push({
        page: `messages:${group}`,
        total: counts.local + counts.adapted + counts.missing,
        ...counts,
      })
  }
  for (const page of pages) {
    const need = page.total >= 3 ? THRESHOLDS.faqLocalMin : Math.ceil(page.total / 2)
    page.ok = page.local >= need
  }
  return {
    pages: pages.length,
    questions: pages.reduce((n, p) => n + p.total, 0),
    local: pages.reduce((n, p) => n + p.local, 0),
    adapted: pages.reduce((n, p) => n + p.adapted, 0),
    missing: pages.reduce((n, p) => n + p.missing, 0),
    failing: pages.filter((p) => !p.ok).map((p) => p.page),
  }
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** 站点地图：`<url><loc>` 与 `xhtml:link hreflang` 备选（属性顺序不限）；索引返回子站点地图地址 */
export function parseSitemap(xml) {
  if (/<sitemapindex\b/.test(xml))
    return {
      index: [...xml.matchAll(/<sitemap>\s*<loc>(.*?)<\/loc>/g)].map((m) => decodeXml(m[1])),
      urls: [],
    }
  const urls = []
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>(.*?)<\/loc>/.exec(m[1])
    if (!loc) continue
    const alts = {}
    for (const link of m[1].matchAll(/<xhtml:link\b([^>]*)\/?>/g)) {
      const lang = /hreflang="([^"]+)"/.exec(link[1])
      const href = /href="([^"]+)"/.exec(link[1])
      if (lang && href) alts[lang[1]] = decodeXml(href[1])
    }
    urls.push({ loc: decodeXml(loc[1]), alts })
  }
  return { index: [], urls }
}

const decodeXml = (s) =>
  s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')

/** 条目的语言：hreflang 中 href 与 loc 相同的那一项（不含 x-default） */
export function entryLocale({ loc, alts }) {
  return Object.entries(alts).find(([lang, href]) => lang !== 'x-default' && href === loc)?.[0]
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

const mean = (xs) => (xs.length ? r3(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
const max = (xs) => (xs.length ? r3(Math.max(...xs)) : null)

/**
 * 由逐页结果判定门槛。`pages` 是 measure 的逐页记录（见 CLI）。只判定本文件 THRESHOLDS 中的规则；
 * 牌义页不判结构直译分；法律页不进相似度门槛（决策 8）。
 */
export function evaluatePage(page, locale) {
  const failures = []
  const pair = page.pairs?.[locale]
  if (page.kind === 'legal') return failures
  if (pair?.variant && !pair.variant.skipped) {
    const v = pair.variant
    if (v.dice > THRESHOLDS.variantDice) failures.push(`variant dice ${v.dice}`)
    if (v.reuse > THRESHOLDS.variantReuse) failures.push(`variant reuse ${v.reuse}`)
    if (v.faqMax !== null && v.faqMax > THRESHOLDS.variantFaqDice)
      failures.push(`variant FAQ ${v.faqMax}`)
  }
  if (pair?.literal) {
    const l = pair.literal
    const gated = LITERAL_KINDS.includes(page.kind) || LITERAL_COLLECTIONS.includes(page.collection)
    if (gated && l.literalScore > THRESHOLDS.literalScore)
      failures.push(`literal ${l.literalScore}`)
    if (EXAMPLE_KINDS.includes(page.kind) && l.digitOverlap > THRESHOLDS.digitOverlap)
      failures.push(`digits ${l.digitOverlap}`)
  }
  const len = page.length?.[locale]?.check
  if (len && !len.ok)
    failures.push(`length ${len.ratio ?? page.length[locale].value} (${len.rule})`)
  return failures
}

export function summarizeByKind(records, locale) {
  const kinds = {}
  for (const rec of records) {
    const pair = rec.pairs?.[locale]
    if (!pair) continue
    kinds[rec.kind] ??= {
      pages: 0,
      dice: [],
      reuse: [],
      faq: [],
      literal: [],
      digits: [],
      literal70: 0,
    }
    const k = kinds[rec.kind]
    k.pages += 1
    if (pair.variant && !pair.variant.skipped) {
      k.dice.push(pair.variant.dice)
      k.reuse.push(pair.variant.reuse)
      if (pair.variant.faqMax !== null) k.faq.push(pair.variant.faqMax)
    }
    if (pair.literal) {
      k.literal.push(pair.literal.literalScore)
      k.digits.push(pair.literal.digitOverlap)
      if (pair.literal.literalScore >= 0.7) k.literal70 += 1
    }
  }
  return Object.fromEntries(
    Object.entries(kinds).map(([kind, k]) => [
      kind,
      {
        pages: k.pages,
        diceMean: mean(k.dice),
        diceMax: max(k.dice),
        reuseMean: mean(k.reuse),
        reuseMax: max(k.reuse),
        faqMax: max(k.faq),
        literalMean: mean(k.literal),
        literalMax: max(k.literal),
        literal70: k.literal70,
        digitsMean: mean(k.digits),
        digitsMax: max(k.digits),
      },
    ]),
  )
}

/** Markdown 报告（中文，写入证据目录） */
export function renderMarkdown(report) {
  const out = []
  const fmt = (x) => (x === null || x === undefined ? '-' : x)
  out.push(`# 本地化相似度测量：${report.site}`, '')
  out.push(
    `- 生成时间：${report.generatedAt}`,
    `- 来源：${report.source}`,
    `- 基准语言：${report.pivot}；各语言页数：${Object.entries(report.pageCounts)
      .map(([l, n]) => `${l} ${n}`)
      .join('、')}`,
    `- 强制语言：${report.enforce.length ? report.enforce.join('、') : '无（只报告）'}`,
    '',
  )
  out.push(
    '口径：取 `<main>` 去掉 script/style/form/nav/svg/noscript/template 后按 H2 切段（H2 之前为 intro）；',
    '中日韩按字二元组、其他语言按词二元组计 Dice；同文字变体先转换写法再比较；跨语言用结构直译分',
    '（段数 0.25、FAQ 数 0.15、段落数对齐 0.25、段长比稳定 0.2、数字序列重合 0.15）。',
    '',
  )
  for (const [locale, pair] of Object.entries(report.pairs)) {
    out.push(
      `## ${locale} ↔ ${pair.base}（${pair.type === 'variant' ? '同文字变体' : '跨语言'}）`,
      '',
    )
    if (pair.skipped) {
      out.push(`跳过：${pair.skipped}`, '')
      continue
    }
    out.push(
      '| 类型 | 页数 | Dice 均值 | Dice 最大 | 整句复现 均值 | 复现 最大 | FAQ 段最大 | 直译分 均值 | 直译分 最大 | 直译分 ≥0.7 | 数字重合 均值 | 数字重合 最大 |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
    )
    for (const [kind, s] of Object.entries(pair.byKind))
      out.push(
        `| ${kind} | ${s.pages} | ${fmt(s.diceMean)} | ${fmt(s.diceMax)} | ${fmt(s.reuseMean)} | ${fmt(s.reuseMax)} | ${fmt(s.faqMax)} | ${fmt(s.literalMean)} | ${fmt(s.literalMax)} | ${s.literal70} | ${fmt(s.digitsMean)} | ${fmt(s.digitsMax)} |`,
      )
    out.push('')
    if (pair.failing.length) {
      out.push(`未达门槛 ${pair.failing.length} 页：`, '')
      for (const f of pair.failing.slice(0, 60))
        out.push(`- ${f.path}（${f.kind}）：${f.failures.join('，')}`)
      if (pair.failing.length > 60) out.push(`- ……另 ${pair.failing.length - 60} 页见 JSON`)
      out.push('')
    } else out.push('全部达标。', '')
  }
  const components = Object.entries(report.componentSections ?? {}).filter(([, s]) => s.length)
  if (components.length) {
    out.push(
      '## 组件段（渲染页，按段标题对齐；门槛）',
      '',
      `牌义页导语、抽一张、延伸牌义与数字页首屏样例（截到结果区声明为止）、其余数字；同语言两两平均 Dice，门槛 ≤${THRESHOLDS.templateRepeat}（--enforce 生效）。`,
      '',
      '| 语言 | 集合 | 段 | 页数 | 平均 Dice | 最差页均值 | 最差页 |',
      '|---|---|---|---|---|---|---|',
    )
    for (const [locale, slots] of components)
      for (const s of slots)
        out.push(
          `| ${locale} | ${s.kind} | ${s.label} | ${s.pages} | ${s.mean}${s.mean > THRESHOLDS.templateRepeat ? ' ⚠' : ''} | ${s.max} | ${s.maxPage} |`,
        )
    out.push('')
  }
  if (report.eastCollections) {
    out.push(
      '## 东方站集合',
      '',
      `各集合按同语言 H2 标题对齐，同标题正文两两平均 Dice，门槛 ≤${THRESHOLDS.templateRepeat}（--enforce 生效）。最差页取与同段其余页的最高平均值。`,
      '共用段使用一致的 H2 可见文字。不足两页的同名段以「-」显示。同名段只在各页都用 `data-table-section` 标记 H2 或其专用容器时归入数据表段。数据表段与整页只报告。',
      '',
      '| 语言 | 集合 | 段 | 口径 | 页数 | 平均 Dice | 最差页均值 | 最差页 |',
      '|---|---|---|---|---|---|---|---|',
    )
    const scopeLabels = { section: '门槛', table: '数据表（参考）', page: '整页（参考）' }
    for (const [locale, collections] of Object.entries(report.eastCollections))
      for (const [collection, sections] of Object.entries(collections))
        for (const s of sections) {
          const over = exceedsEastSectionThreshold(s)
          const mean =
            s.mean == null
              ? '-'
              : over && r3(s.mean) === THRESHOLDS.templateRepeat
                ? s.mean
                : r3(s.mean)
          out.push(
            `| ${locale} | ${collection} | ${s.title.replaceAll('|', '\\|')} | ${scopeLabels[s.scope]} | ${s.pages} | ${mean}${over ? ' ⚠' : ''} | ${s.max == null ? '-' : r3(s.max)} | ${fmt(s.maxPage)} |`,
          )
        }
    if (!Object.keys(report.eastCollections).length) out.push('', '尚未发现集合页面。')
    out.push('')
  }
  out.push(
    '## 同语言模板重复（渲染页，按位置；参考）',
    '',
    '渲染页含组件固定输出的段（关键词、抽牌入口、延伸牌义列表等），只作参考；门槛按下一节 MDX 源判定。',
    '',
  )
  out.push(
    '| 语言 | 集合 | 位置 | 段标题（首页） | 页数 | 平均 Dice | 单页最大 | 最大页 |',
    '|---|---|---|---|---|---|---|---|',
  )
  for (const [locale, kinds] of Object.entries(report.templateRepeat.rendered))
    for (const [kind, slots] of Object.entries(kinds))
      for (const s of slots)
        out.push(
          `| ${locale} | ${kind} | ${s.index} | ${s.title} | ${s.pages} | ${s.mean}${s.mean > THRESHOLDS.templateRepeat ? ' ⚠' : ''} | ${s.max} | ${s.maxPage} |`,
        )
  out.push('')
  if (Object.keys(report.templateRepeat.source).length) {
    out.push(
      '## 同语言模板重复（MDX 源文件；门槛）',
      '',
      '与 part-b measure-intra 同口径，去掉链接地址只留锚文本（#238 验收口径）。',
      '',
    )
    out.push(
      '| 语言 | 集合 | 位置 | 段标题 | 文件数 | 平均 Dice | 单页最大 |',
      '|---|---|---|---|---|---|---|',
    )
    for (const [key, res] of Object.entries(report.templateRepeat.source))
      for (const s of res.slots)
        out.push(
          `| ${key.split(':')[1]} | ${key.split(':')[0]} | ${s.index} | ${s.title} | ${res.pages} | ${s.mean}${s.mean > THRESHOLDS.templateRepeat ? ' ⚠' : ''} | ${s.max} |`,
        )
    out.push('')
  }
  out.push('## FAQ 来源（origin）', '')
  out.push(
    '| 语言 | 带 FAQ 页 | 问题数 | local | adapted | 未标注 | 未达 local 下限 |',
    '|---|---|---|---|---|---|---|',
  )
  for (const [locale, s] of Object.entries(report.faqOrigin))
    out.push(
      `| ${locale} | ${s.pages} | ${s.questions} | ${s.local} | ${s.adapted} | ${s.missing} | ${s.failing.length} |`,
    )
  out.push('')
  out.push('## 长度下限', '')
  out.push('| 语言 | 适用页 | 未达 | 未达页（前 20） |', '|---|---|---|---|')
  for (const [locale, s] of Object.entries(report.lengths))
    out.push(
      `| ${locale} | ${s.checked} | ${s.failing.length} | ${s.failing.slice(0, 20).join('、') || '-'} |`,
    )
  out.push('')
  return `${out.join('\n')}\n`
}
