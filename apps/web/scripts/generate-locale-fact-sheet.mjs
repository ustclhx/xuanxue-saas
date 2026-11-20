// 写作事实单生成（OpenSpec add-locales-eu-ja 任务 2.5，design 决策 10）。
// 新语言的每个页面由写作代理拿「事实单」写作：事实单包含引擎计算事实、固定关键词与正逆位倾向、
// 该语言主词与次级词、本地问题来源、术语表、合规表述与内链锚文本，**不提供源语言正文**。
// 生成后会核对：事实单中不得出现对应源语言页面正文的任何整句（防止以后有人把正文塞进来）。
//
// 用法：
//   node apps/web/scripts/generate-locale-fact-sheet.mjs --locale es --page card:the-sun [--page number:7]
//   node apps/web/scripts/generate-locale-fact-sheet.mjs --locale ja --all [--keywords <json>] [--out <目录>]
//   node apps/web/scripts/generate-locale-fact-sheet.mjs --list --locale es
//   复算示例：--compute life-path 1987-03-21 | --compute name "María José Pérez"
//            | --compute bazi 1988-07-20T14:40 tokyo female
// --keywords：{ "<页面 id>": { "primary": "...", "secondary": ["..."] } }（按 research.md / Keyword Planner 定稿）；
// 缺省时主词取术语表锚文本的第一种写法并标注「待定稿」。
// 输出缺省为 $EVIDENCE_DIR/locale-fact-sheets/<语言>/（未设置时 test-results/evidence/），不进仓库。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { computeChart, ENGINE_VERSION } from '@xuanxue/bazi'
import {
  COMPATIBILITY_MATRIX,
  LIFE_PATH_VALUES,
  lifePath,
  nameNumbers,
  normalizeName,
} from '@xuanxue/numerology'
import { CARD_MEANINGS, CARDS, SPREADS } from '@xuanxue/tarot'
import { globToRegExp } from './check-locale-glossary.mjs'
import { mdxSections, norm, words } from './locale-similarity.mjs'

const WEB_ROOT = new URL('..', import.meta.url).pathname
const REPO_ROOT = resolve(WEB_ROOT, '../..')
const TEMPLATE = join(WEB_ROOT, 'i18n/fact-sheet.template.md')

const SPREAD_SEGMENTS = {
  ja: {
    'three-card': '',
    daily: '/今日の一枚',
    'yes-or-no': '/イエスノー',
    'celtic-cross': '/ケルト十字',
  },
  es: {
    'three-card': '',
    daily: '/carta-del-dia',
    'yes-or-no': '/si-o-no',
    'celtic-cross': '/cruz-celta',
  },
}

/** 各语言第一期页面（design 决策 2、9）；sources 为 hreflang 对应语言（只列路径，不读正文） */
export const LOCALES = Object.freeze({
  ja: {
    site: 'east',
    sources: ['zh-Hans', 'zh-Hant', 'ko'],
    home: '/ja',
    tarotBase: '/ja/タロット',
    cardBase: '/ja/タロット/カード',
    tools: { shichu: '/ja/四柱推命', ziwei: '/ja/紫微斗数' },
    numbers: null,
    exampleCity: 'tokyo',
    lengthRule: '工具页正文 ≥1,500 字；牌义页不少于对应页的 70%',
    questionSources: [
      'Yahoo!知恵袋（chiebukuro.yahoo.co.jp）：「四柱推命」「タロット ○○ 逆位置」等的提问',
      'Google 日本（google.co.jp）「他の人はこちらも質問」',
      '教えて!goo、note.com 的占い関連記事コメント',
      'X（旧 Twitter）上的实际说法（只取问法，不引用个人信息）',
    ],
  },
  es: {
    site: 'west',
    sources: ['en'],
    home: '/es',
    tarotBase: '/es/tarot',
    cardBase: '/es/tarot/cartas',
    tools: {
      'life-path-number': '/es/numero-de-vida',
      'numerology-calculator': '/es/calculadora-numerologia',
      'name-numerology': '/es/numerologia-del-nombre',
      'life-path-compatibility': '/es/compatibilidad-numerologica',
      'numerology-chart': '/es/carta-numerologica',
      'destiny-number': '/es/numero-del-destino',
      'soul-urge-number': '/es/numero-del-alma',
    },
    numbers: '/es/numero-de-vida',
    exampleCity: null,
    lengthRule: '工具页正文 ≥600 词；数字页与牌义页不少于英文对应页的 70%',
    questionSources: [
      'Google «Más preguntas» en google.com.mx / google.com.ar / google.com.co / google.es',
      'Reddit en español（r/tarot, r/Numerology 的西语帖、各国 subreddit）',
      'Foros de tarot y numerología, Quora en español',
      'Comentarios de YouTube en videos de «número de vida» / «tarot sí o no»',
    ],
  },
})

/** 页面清单：id → { kind, path, ... } */
export function pagesFor(locale) {
  const cfg = LOCALES[locale]
  if (!cfg) throw new Error(`没有 ${locale} 的页面配置`)
  const pages = [{ id: 'home', kind: 'home', path: cfg.home }]
  for (const [tool, path] of Object.entries(cfg.tools))
    pages.push({ id: `tool:${tool}`, kind: 'tool', tool, path })
  if (cfg.numbers)
    for (const n of LIFE_PATH_VALUES)
      pages.push({
        id: `number:${n}`,
        kind: 'numerology-number',
        number: n,
        path: `${cfg.numbers}/${n}`,
      })
  for (const spread of ['three-card', 'daily', 'yes-or-no', 'celtic-cross'])
    pages.push({
      id: `tarot:${spread}`,
      kind: 'tarot-draw',
      spread,
      path: `${cfg.tarotBase}${SPREAD_SEGMENTS[locale][spread]}`,
    })
  pages.push({ id: 'card-index', kind: 'tarot-card-index', path: cfg.cardBase })
  for (const card of CARDS)
    pages.push({
      id: `card:${card.slug}`,
      kind: 'tarot-card',
      card,
      path: `${cfg.cardBase}/${card.slug}`,
    })
  return pages
}

// ---------------------------------------------------------------------------
// 术语表查询
// ---------------------------------------------------------------------------

export function loadGlossary(locale) {
  return JSON.parse(readFileSync(join(WEB_ROOT, 'i18n/glossary', `${locale}.json`), 'utf8'))
}

const termOf = (glossary, id) => glossary.terms.find((t) => t.id === id)
const pref = (glossary, id, fallback = id) => termOf(glossary, id)?.preferred ?? fallback

/** 本语言牌名：大阿尔卡那取术语，小阿尔卡那按 cardName 组合 */
export function cardName(glossary, card) {
  if (card.suit === 'major') return pref(glossary, `tarot.major.${card.id}`)
  return glossary.cardName
    .replace('{suit}', pref(glossary, `tarot.suit.${card.suit}`))
    .replace('{rank}', pref(glossary, `tarot.rank.${String(card.number).padStart(2, '0')}`))
}

function termsTable(glossary, prefixes) {
  const rows = glossary.terms.filter((t) => prefixes.some((p) => t.id.startsWith(p)))
  const lines = ['| 概念 | 首选 | 可接受 | 禁用 | 说明 |', '|---|---|---|---|---|']
  for (const t of rows)
    lines.push(
      `| ${t.en ?? t.id} | ${t.preferred} | ${(t.variants ?? []).join('、') || '-'} | ${
        (t.banned ?? [])
          .map((b) => (typeof b === 'string' ? b : (b.text ?? `/${b.regex}/`)))
          .join('、') || '-'
      } | ${t.note ?? ''} |`,
    )
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 引擎事实
// ---------------------------------------------------------------------------

const STEMS_JA = {
  jia: '甲',
  yi: '乙',
  bing: '丙',
  ding: '丁',
  wu: '戊',
  ji: '己',
  geng: '庚',
  xin: '辛',
  ren: '壬',
  gui: '癸',
}
const BRANCHES_JA = {
  zi: '子',
  chou: '丑',
  yin: '寅',
  mao: '卯',
  chen: '辰',
  si: '巳',
  wu: '午',
  wei: '未',
  shen: '申',
  you: '酉',
  xu: '戌',
  hai: '亥',
}
const TEN_GOD_TERMS = {
  biJian: 'bijian',
  jieCai: 'jiecai',
  shiShen: 'shishen',
  shangGuan: 'shangguan',
  pianCai: 'piancai',
  zhengCai: 'zhengcai',
  qiSha: 'pianguan',
  zhengGuan: 'zhengguan',
  pianYin: 'pianyin',
  zhengYin: 'yinshou',
}

/** 复算四柱推命示例：返回只含事实的摘要（干支以汉字、通变星以术语表首选写法） */
export function baziFacts({ date, time, city, gender }, glossary) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time ? time.split(':').map(Number) : [null, null]
  const chart = computeChart(
    {
      calendar: 'solar',
      year,
      month,
      day,
      time: time ? { hour, minute } : null,
      gender,
      location: { city },
    },
    { referenceYear: new Date().getUTCFullYear() },
  )
  const gz = (p) => (p ? `${STEMS_JA[p.stem]}${BRANCHES_JA[p.branch]}` : '—')
  const god = (id) => (id ? pref(glossary, `shichu.ten-gods.${TEN_GOD_TERMS[id]}`, id) : '—')
  const t = chart.time
  const pad = (n) => String(n).padStart(2, '0')
  const first = chart.fortune.decades[0]
  return {
    engineVersion: chart.engineVersion,
    input: `${date}${time ? ` ${time}` : '（時刻不明）'} ${city} ${gender}`,
    clock: `${t.clock.year}-${pad(t.clock.month)}-${pad(t.clock.day)} ${pad(t.clock.hour)}:${pad(t.clock.minute)}`,
    used: `${t.used.year}-${pad(t.used.month)}-${pad(t.used.day)} ${pad(t.used.hour)}:${pad(t.used.minute)}`,
    dst: t.dst,
    pillars: ['year', 'month', 'day', 'hour'].map((k) => `${k}=${gz(chart.pillars[k])}`).join(' '),
    tenGods: ['year', 'month', 'hour']
      .map((k) => `${k}=${god(chart.pillars[k]?.tenGod)}`)
      .join(' '),
    dayMaster: STEMS_JA[chart.dayMaster],
    luck: `${chart.fortune.forward ? '順行' : '逆行'}，第 1 步 ${gz(first)} ${first.startYear}–${first.endYear}（${first.startAge}–${first.endAge} 歳）`,
  }
}

function lifePathFacts(dateText) {
  const [year, month, day] = dateText.split('-').map(Number)
  const r = lifePath({ year, month, day })
  return {
    value: r.value,
    master: r.master,
    steps: r.steps.map((s) => `${s.phase}: ${s.operands.join('+')}=${s.result}`).join('；'),
  }
}

/** 为数字 n 找几组候选出生日期（1975–2005），供写作者挑选本地化示例后复算 */
export function sampleDatesFor(n, count = 3) {
  // 每年最多取一个日期，让候选分散在不同年份；大师数 33 较少见，需要逐日搜索
  const out = []
  for (let year = 1975; year <= 2005 && out.length < count; year += 1) {
    let found = false
    for (let month = 1; month <= 12 && !found; month += 1)
      for (let day = 1; day <= 28 && !found; day += 1)
        if (lifePath({ year, month, day }).value === n) {
          out.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
          found = true
        }
    if (found) year += 4
  }
  return out
}

function compatibilityFacts(n) {
  const i = LIFE_PATH_VALUES.indexOf(n)
  const groups = { high: [], medium: [], challenging: [] }
  LIFE_PATH_VALUES.forEach((m, j) => {
    groups[COMPATIBILITY_MATRIX[i][j]].push(m)
  })
  return groups
}

/** en 牌义数据中的关键词（正位为 keywords，逆位取「Consider how … may shape」中的词组） */
function cardKeywords(card) {
  const meaning = CARD_MEANINGS.en[card.id]
  const reversed = /Consider how (.+) may shape/.exec(meaning.reversed)?.[1] ?? ''
  return { upright: meaning.keywords, reversed: reversed.split(/,\s*/).filter(Boolean) }
}

function engineFacts(page, locale, glossary) {
  const cfg = LOCALES[locale]
  const lines = []
  const push = (k, v) => lines.push(`- **${k}**：${v}`)
  if (page.kind === 'tarot-card') {
    const { card } = page
    const kw = cardKeywords(card)
    push(
      '牌',
      `${cardName(glossary, card)}（id \`${card.id}\`，slug \`${card.slug}\`，英文名 ${CARD_MEANINGS.en[card.id].name}）`,
    )
    push(
      '组别',
      card.suit === 'major'
        ? `${pref(glossary, 'tarot.major-arcana')} ${card.number}`
        : `${pref(glossary, `tarot.suit.${card.suit}`)} · ${card.number}`,
    )
    push('固定关键词（正位）', kw.upright.join(', '))
    push('固定关键词（逆位）', kw.reversed.join(', '))
    push(
      '是或否倾向（固定，不可改）',
      `${pref(glossary, 'tarot.upright')} ${card.yesNo.upright} / ${pref(glossary, 'tarot.reversed')} ${card.yesNo.reversed}`,
    )
    const same = CARDS.filter((c) => c.suit === card.suit)
    const i = same.indexOf(card)
    push(
      '同组相邻牌（内链用本语言牌名）',
      [same[i - 1], same[i + 1]]
        .filter(Boolean)
        .map((c) => `${cardName(glossary, c)}（\`${cfg.cardBase}/${c.slug}\`）`)
        .join('、'),
    )
    push('牌图', `\`${card.image.large}\`（全语言共用）`)
  } else if (page.kind === 'tarot-card-index') {
    push(
      '牌数',
      `78（${pref(glossary, 'tarot.major-arcana')} 22 + ${pref(glossary, 'tarot.minor-arcana')} 56）`,
    )
    push(
      '花色',
      ['wands', 'cups', 'swords', 'pentacles']
        .map((s) => pref(glossary, `tarot.suit.${s}`))
        .join('・'),
    )
    push(
      '牌名组合',
      `\`${glossary.cardName}\`（例：${cardName(
        glossary,
        CARDS.find((c) => c.id === 'cups-01'),
      )}）`,
    )
  } else if (page.kind === 'tarot-draw') {
    const spread = SPREADS[page.spread]
    push('牌阵', `${page.spread}（${spread.positions.en.length} 个牌位）`)
    push(
      '牌位数据',
      '`packages/tarot` 的 `spreadPositions` 需新增本语言牌位名与说明（与详批提示词共用），本页正文不重复罗列',
    )
    push('抽牌', '每张牌独立决定正逆位；结果只作反思提示，不是预测')
  } else if (page.kind === 'numerology-number') {
    const g = compatibilityFacts(page.number)
    push(
      '数字',
      `${page.number}${[11, 22, 33].includes(page.number) ? `（${pref(glossary, 'numerology.master')}，不再约化）` : ''}`,
    )
    push(
      '相性（固定表 COMPATIBILITY_MATRIX）',
      `high ${g.high.join('、')}；medium ${g.medium.join('、')}；challenging ${g.challenging.join('、')}`,
    )
    push(
      '候选示例日期（引擎复算为该数）',
      sampleDatesFor(page.number).join('、') || '（自行选择后用 --compute life-path 复算）',
    )
  } else if (page.kind === 'tool' && page.tool === 'shichu') {
    push('引擎', `@xuanxue/bazi ${ENGINE_VERSION}；可排 1900–2100 年`)
    push(
      '日本时间',
      '内置城市 tokyo（IANA Asia/Tokyo）：1948–1951 年サマータイム期间按钟表时间输入，引擎自动减 1 小时',
    )
    push('真太阳时', '默认关闭；开启时按经度与均时差修正')
    push('时刻不明', '可不填时辰，按当地 12:00 估算，大运起始日可能相差数天')
    const ex = baziFacts(
      { date: '1950-06-15', time: '10:30', city: 'tokyo', gender: 'female' },
      glossary,
    )
    push(
      'サマータイム示例（复算）',
      `钟表 ${ex.clock} → 排盘 ${ex.used}；四柱 ${ex.pillars}；日干 ${ex.dayMaster}；通変星 ${ex.tenGods}；${ex.luck}`,
    )
  } else if (page.kind === 'tool' && page.tool === 'ziwei') {
    push('引擎', `@xuanxue/bazi ${ENGINE_VERSION}（紫微斗数排盘）`)
    push(
      '命盘',
      `${pref(glossary, 'ziwei.twelve-palaces')}、${pref(glossary, 'ziwei.life-palace')}・${pref(glossary, 'ziwei.body-palace')}、${pref(glossary, 'ziwei.four-transformations')}`,
    )
  } else if (page.kind === 'tool') {
    const nameTool = [
      'name-numerology',
      'destiny-number',
      'soul-urge-number',
      'numerology-chart',
    ].includes(page.tool)
    push(
      '数值范围',
      `${LIFE_PATH_VALUES.join('、')}（${pref(glossary, 'numerology.master')} 11、22、33 不再约化）`,
    )
    push('生命灵数算法', '月、日、年分别约化后相加，再约化到一位数或大师数')
    if (nameTool) {
      push('字母表', `${pref(glossary, 'numerology.pythagorean')}：A–I = 1–9，J–R = 1–9，S–Z = 1–8`)
      push('元音', 'A E I O U；Y 两侧都不是元音时算元音')
      push(
        '重音与特殊字母',
        `先做 NFD 分解再去掉附加符号（á→A、ñ→N、ü→U，示例：${normalizeName('Muñoz Peña')}）；无法分解的字母（ß、ł、æ、ø、œ）按任务 1.9 的映射`,
      )
    }
    if (page.tool === 'life-path-compatibility')
      push(
        '相性',
        '固定对称表 COMPATIBILITY_MATRIX（high / medium / challenging），是参考约定，不是关系预测',
      )
  } else if (page.kind === 'home') {
    push(
      '本语言页面',
      pagesFor(locale)
        .filter((p) => p.kind === 'tool' || p.kind === 'tarot-draw')
        .map((p) => `\`${p.path}\``)
        .join('、'),
    )
    push('品牌', cfg.site === 'east' ? '干支日（东方站）' : 'Arcanumber（西方站）；两站互不链接')
  }
  return lines.join('\n')
}

function examplesFor(page, locale) {
  const cfg = LOCALES[locale]
  if (page.kind === 'numerology-number' || (page.kind === 'tool' && cfg.numbers))
    return [
      '- 使用本地区人名、城市与日期（es：墨西哥、哥伦比亚、阿根廷、西班牙等；不用英语页的示例人物）。',
      '- 每个数值用引擎复算：`node apps/web/scripts/generate-locale-fact-sheet.mjs --compute life-path YYYY-MM-DD`，',
      '  姓名用 `--compute name "<姓名>"`；页面中的数字序列与英文页重合度须 ≤0.50。',
    ].join('\n')
  if (page.kind === 'tool' && page.tool === 'shichu')
    return [
      '- 示例出生地用日本城市（东京等）与日本标准时间；至少一个示例覆盖 1948–1951 年サマータイム或节入り前后。',
      '- 复算：`node apps/web/scripts/generate-locale-fact-sheet.mjs --compute bazi 1988-07-20T14:40 tokyo female`；',
      '  数字序列与繁中页示例重合度须 ≤0.50。',
    ].join('\n')
  if (page.kind === 'tarot-card' || page.kind === 'tarot-draw')
    return '- 示例问题用本地常见情境（ja：就活・受験・婚活など；es：trabajo, pareja a distancia, estudios），不要沿用其他语言页的问题。'
  return '- 本页不需要计算示例。'
}

function anchorsFor(page, glossary) {
  const own = Object.entries(glossary.anchors ?? {}).find(([target]) =>
    globToRegExp(target).test(page.path),
  )
  const lines = []
  if (own) lines.push(`- 指向本页时的锚文本：${own[1].map((a) => `「${a}」`).join(' / ')}`)
  lines.push('- 可链接的目标与锚文本：')
  for (const [target, anchors] of Object.entries(glossary.anchors ?? {})) {
    if (own && target === own[0]) continue
    lines.push(`  - \`${target}\`：${anchors.map((a) => `「${a}」`).join(' / ')}`)
  }
  return lines.join('\n')
}

function keywordsFor(page, glossary, keywords) {
  const k = keywords?.[page.id]
  if (k) return `- 主词：**${k.primary}**\n- 次级词：${(k.secondary ?? []).join('、') || '-'}`
  const own = Object.entries(glossary.anchors ?? {}).find(([target]) =>
    globToRegExp(target).test(page.path),
  )
  const guess = own?.[1]?.[0]
    ?.replace('{card}', page.card ? cardName(glossary, page.card) : '')
    .replace('{n}', String(page.number ?? ''))
  return `- 主词：${guess ? `**${guess}**（取自锚文本，待按 research.md / Keyword Planner 定稿）` : '待定稿'}\n- 次级词：待定稿`
}

function complianceFor(glossary) {
  const req = glossary.compliance.required.map(
    (r) => `- ${r.id}：${r.phrases.map((p) => `「${p}」`).join(' / ')}`,
  )
  const banned = glossary.compliance.banned.map((b) =>
    typeof b === 'string' ? b : (b.text ?? `/${b.regex}/`),
  )
  return [
    ...req,
    `- 禁用（「娱乐」定位与保证性说法）：${banned.map((b) => `「${b}」`).join('、')}`,
  ].join('\n')
}

function termPrefixes(page) {
  if (page.kind === 'tarot-card' || page.kind === 'tarot-card-index' || page.kind === 'tarot-draw')
    return ['tarot.']
  if (page.tool === 'shichu') return ['shichu.']
  if (page.tool === 'ziwei') return ['ziwei.']
  if (page.kind === 'numerology-number' || page.kind === 'tool') return ['numerology.']
  return [
    'tarot.tarot',
    'tarot.three-card',
    'shichu.name',
    'ziwei.name',
    'numerology.name',
    'numerology.life-path',
  ]
}

function titleOf(page, glossary) {
  if (page.card) return cardName(glossary, page.card)
  if (page.number) return `${pref(glossary, 'numerology.life-path')} ${page.number}`
  return page.id
}

export function renderFactSheet({
  locale,
  page,
  glossary,
  keywords = null,
  template = readFileSync(TEMPLATE, 'utf8'),
  now = new Date(),
}) {
  const cfg = LOCALES[locale]
  const values = {
    title: titleOf(page, glossary),
    locale,
    site: cfg.site,
    path: page.path,
    kind: page.kind,
    counterparts: cfg.sources.join('、'),
    glossaryStatus: glossary.status,
    generatedAt: now.toISOString().slice(0, 10),
    engineFacts: engineFacts(page, locale, glossary),
    keywords: keywordsFor(page, glossary, keywords),
    questionSources: cfg.questionSources.map((s) => `- ${s}`).join('\n'),
    terms: termsTable(glossary, termPrefixes(page)),
    compliance: complianceFor(glossary),
    anchors: anchorsFor(page, glossary),
    examples: examplesFor(page, locale),
    constraints: [
      `- 长度：${cfg.lengthRule}。`,
      '- 结构自定：不要求与其他语言相同的段数、段序与 FAQ 数（结构直译分须 ≤0.60）。',
      '- 牌义页的「是或否」「相关牌阵」「常见问题」每张牌单独写，避免跨牌模板（同语言按位置段落 Dice ≤0.30）。',
      '- 完成后运行：`pnpm check`（术语表）、`measure-locale-similarity.mjs --enforce ' +
        locale +
        '`、回译检查（批准预算后）。',
    ].join('\n'),
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`模板占位符没有值：${key}`)
    return values[key]
  })
}

// ---------------------------------------------------------------------------
// 不含源语言正文的核对
// ---------------------------------------------------------------------------

/** 源语言对应内容的正文句子（MDX 正文与 frontmatter 的 FAQ 答案），用于核对事实单没有混入 */
export function sourceSentences(page, locale) {
  const files = []
  const cfg = LOCALES[locale]
  for (const source of cfg.sources) {
    if (page.card) files.push(join(WEB_ROOT, 'content/tarot', source, `${page.card.id}.mdx`))
    if (page.number)
      files.push(join(WEB_ROOT, 'content/numerology', source, `life-path-${page.number}.mdx`))
    if (page.kind === 'tool' && page.tool)
      files.push(join(WEB_ROOT, 'content/numerology', source, `${page.tool}.mdx`))
  }
  const out = []
  for (const file of files.filter(existsSync)) {
    const raw = readFileSync(file, 'utf8')
    const text = [
      ...mdxSections(raw).map((s) => s.text),
      ...[...raw.matchAll(/^\s+a: "(.*)"$/gm)].map((m) => m[1]),
    ].join('\n')
    for (const s of text.split(/[。！？!?\n]+|\.(?=\s|$)/)) {
      const cjk = !/[a-z]/i.test(s)
      if (cjk ? norm(s).length >= 12 : words(s).length >= 6) out.push(s.trim())
    }
  }
  return out
}

export function assertNoSourceText(sheet, sentences) {
  const hay = norm(sheet.toLowerCase())
  const leaked = sentences.filter((s) => hay.includes(norm(s.toLowerCase())))
  if (leaked.length)
    throw new Error(`事实单包含源语言正文 ${leaked.length} 句，例如：${leaked[0].slice(0, 80)}`)
}

// ---------------------------------------------------------------------------
// 命令行
// ---------------------------------------------------------------------------

function compute(kind, args) {
  if (kind === 'life-path') return lifePathFacts(args[0])
  if (kind === 'name') {
    const r = nameNumbers(args[0])
    return {
      normalized: normalizeName(args[0]),
      ...JSON.parse(JSON.stringify(r, (k, v) => (k === 'steps' ? undefined : v))),
    }
  }
  if (kind === 'bazi') {
    const [date, time] = args[0].split('T')
    return baziFacts(
      { date, time, city: args[1] ?? 'tokyo', gender: args[2] ?? 'female' },
      loadGlossary('ja'),
    )
  }
  throw new Error(`未知的 --compute：${kind}（life-path | name | bazi）`)
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      locale: { type: 'string' },
      page: { type: 'string', multiple: true },
      all: { type: 'boolean' },
      list: { type: 'boolean' },
      keywords: { type: 'string' },
      out: { type: 'string' },
      compute: { type: 'string' },
    },
  })
  if (values.compute) {
    console.log(JSON.stringify(compute(values.compute, positionals), null, 2))
    return
  }
  const locale = values.locale
  if (!LOCALES[locale]) throw new Error(`--locale 须为 ${Object.keys(LOCALES).join(' | ')}`)
  const pages = pagesFor(locale)
  if (values.list) {
    for (const p of pages) console.log(`${p.id}\t${p.path}`)
    return
  }
  const selected = values.all ? pages : pages.filter((p) => values.page?.includes(p.id))
  if (!selected.length) throw new Error('用 --page <id>（见 --list）或 --all 选择页面')
  const glossary = loadGlossary(locale)
  const keywords = values.keywords ? JSON.parse(readFileSync(values.keywords, 'utf8')) : null
  const outDir = resolve(
    values.out ??
      join(
        process.env.EVIDENCE_DIR ?? join(REPO_ROOT, 'test-results/evidence'),
        'locale-fact-sheets',
        locale,
      ),
  )
  mkdirSync(outDir, { recursive: true })
  for (const page of selected) {
    const sheet = renderFactSheet({ locale, page, glossary, keywords })
    assertNoSourceText(sheet, sourceSentences(page, locale))
    writeFileSync(join(outDir, `${page.id.replace(/[:/]/g, '-')}.md`), sheet)
  }
  console.log(`${locale}：生成 ${selected.length} 份事实单 → ${outDir}`)
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
