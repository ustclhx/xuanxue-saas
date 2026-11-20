// 回译相似度（OpenSpec add-locales-eu-ja 任务 2.2；localized-content-quality「跨语言直译检测」）。
// 新语言页面经固定模型、温度 0 回译成对照语言后，与对照页比较二元组 Dice（中日韩按字、其他语言按词，
// 与 measure-locale-similarity 相同）；整页 ≤ 校准阈值（默认 0.50），FAQ 段 ≤ 0.40。
// 校准：每种语言取 3 页「机器直译」对照组（对照页 → 直译成新语言 → 回译），阈值取
// min(0.50, 对照组中位数 − 0.20)，写入报告。
//
// 真实调用会产生费用：默认 --dry-run 只估算 token 与美元，不访问模型；
// --live 必须带 --budget-usd，CI 中拒绝（与 packages/evals 的规则相同）。
// 模型出口与密钥读取方式与 packages/evals 相同：根目录 .env.local → TEXT_ENV_KEYS → @xuanxue/ai 的
// defaultLanguageModelFactory（direct / gateway 同一套出口）；密钥只交给模型工厂，不写入报告与缓存。
//
// 外部回译（使用者 2026-11-20：回译由与写作者不同家族的 agent 完成，不调用 API、不产生费用）：
//   --export-input <目录>  导出待回译的页面正文、对照组原文与 manifest.json（含给回译 agent 的说明）；
//   --from-file <目录>     读取外部回译结果（manifest 中的 output 文件）计算相似度与校准阈值，不访问模型。
//
// 用法（先 `pnpm --filter @xuanxue/web build`）：
//   node apps/web/scripts/measure-locale-backtranslation.mjs --locale ja --export-input <目录>
//   node apps/web/scripts/measure-locale-backtranslation.mjs --locale ja --from-file <目录>
//   node apps/web/scripts/measure-locale-backtranslation.mjs --locale ja [--dry-run]
//   node apps/web/scripts/measure-locale-backtranslation.mjs --locale es --calibrate --live --budget-usd 2
//   node apps/web/scripts/measure-locale-backtranslation.mjs --locale es --live --budget-usd 5 \
//     [--calibration <calibration.json>] [--base-url <地址>] [--out <目录>]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { startPreview } from './check-links.mjs'
import {
  createExtractor,
  dice,
  entryLocale,
  fullText,
  pageKind,
  r3,
  THRESHOLDS,
  unitOf,
} from './locale-similarity.mjs'
import { loadTemplateConfig, pool, siteClient } from './measure-locale-similarity.mjs'

const WEB_ROOT = new URL('..', import.meta.url).pathname
const REPO_ROOT = resolve(WEB_ROOT, '../..')

/**
 * 固定回译模型：与 evals/readings 的生成模型同一行（deepseek-flash，思考关闭），与写作模型（Claude）不同源。
 * 单价（美元 / 百万 token）取 evals/readings/suite.ts 2026-11-14 记录的 DeepSeek 高峰价、缓存未命中；
 * 真实运行前按当前价目核对。改模型或温度会改变回译风格，须重新校准。
 */
export const BACKTRANSLATION_MODEL = Object.freeze({
  key: 'deepseek-flash',
  provider: 'deepseek',
  providerModelId: 'deepseek-flash',
  priceUsd: { inputPerMTok: 0.3, outputPerMTok: 1.2 },
  thinking: false,
  temperature: 0,
})

/** 与 packages/evals/src/errors.ts 的 TEXT_ENV_KEYS 相同：只把这些变量交给模型工厂 */
export const TEXT_ENV_KEYS = Object.freeze([
  'AI_TEXT_EGRESS',
  'OPENAI_BASE_URL',
  'AI_GATEWAY_ACCOUNT_ID',
  'AI_GATEWAY_ID',
  'AI_GATEWAY_TOKEN',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'DEEPSEEK_API_KEY',
])

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish (neutral Latin American)',
  'pt-BR': 'Brazilian Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  'zh-Hans': 'Simplified Chinese (Mainland China usage)',
  'zh-Hant': 'Traditional Chinese (Taiwan usage)',
}

/**
 * 各新语言的第一期页面集合（design 决策 9，不含法律页：译文本应一致，不进相似度门槛）与对照语言。
 * expansion：新语言正文长度 / 对照页长度（按字符，估算用）；minChars：工具页的长度下限折算成字符。
 */
export const LOCALE_PLANS = Object.freeze({
  ja: {
    site: 'east',
    // 「回译对照以 zh-Hans 与 ko 双源测量」（design Risks）
    sources: ['zh-Hans', 'ko'],
    kinds: ['home', 'faq', 'other', 'tool', 'tarot-draw', 'tarot-card-index', 'tarot-card'],
    exclude: /命盘查询|命盤查詢|사주궁합|newsletter/,
    expansion: { 'zh-Hans': 1.4, ko: 1.0 },
    minChars: { tool: 1500 },
  },
  es: {
    site: 'west',
    sources: ['en'],
    kinds: [
      'home',
      'faq',
      'other',
      'tool',
      'numerology-number',
      'tarot-draw',
      'tarot-card-index',
      'tarot-card',
    ],
    exclude: /daily-numerology|newsletter/,
    expansion: { en: 1.2 },
    // 600 词 × 约 6 字符 / 词
    minChars: { tool: 3600 },
  },
})

/**
 * 每字符 token 数：conservative 与 @xuanxue/ai DEFAULT_TOKENS_PER_CHAR（预算预留口径）一致；
 * typical 是常见分词器的经验值（拉丁字母约 3.7 字符 / token，中文约 0.75、日韩约 0.9 token / 字），只作参考。
 */
export const TOKENS_PER_CHAR = Object.freeze({
  conservative: () => 1,
  typical: (locale) => ({ 'zh-Hans': 0.75, 'zh-Hant': 0.75, ja: 0.9, ko: 0.9 })[locale] ?? 0.27,
})
/** 每条消息的格式开销，与 @xuanxue/ai MESSAGE_OVERHEAD_TOKENS 相同 */
const MESSAGE_OVERHEAD_TOKENS = 8
export const CONTROL_PAGES = 3

// ---------------------------------------------------------------------------
// 提示词与分段
// ---------------------------------------------------------------------------

/** 把页面各段序列化为带「## 标题」行的纯文本；intro 不加标题 */
export function serializeSections(page) {
  return page.sections
    .map((s, i) => (i === 0 ? s.text : `## ${s.title}\n${s.text}`))
    .filter((s) => s.trim())
    .join('\n\n')
}

/** 按「## 」行切回段落；返回与 serializeSections 相同顺序的正文数组（标题不计入正文） */
export function splitSections(text) {
  const parts = text.split(/^## .*$/m)
  return parts.map((p) => p.trim())
}

export function backTranslationPrompt(from, to) {
  return {
    system: [
      `You are a professional translator. Translate the user's ${LANGUAGE_NAMES[from] ?? from} text into ${LANGUAGE_NAMES[to] ?? to}.`,
      'Translate faithfully and naturally, sentence by sentence. Do not add, omit, summarize, or explain anything.',
      'Lines starting with "## " are section headings: keep each one as a single line starting with "## " in the same position and translate its text.',
      'Output only the translation.',
    ].join('\n'),
  }
}

/** 对照组：刻意逐句直译（模拟「把源语言正文交给机器翻译」的最坏情况） */
export function literalTranslationPrompt(from, to) {
  return {
    system: [
      `Translate the user's ${LANGUAGE_NAMES[from] ?? from} text into ${LANGUAGE_NAMES[to] ?? to} literally, sentence by sentence, keeping the same sentence order, paragraph breaks and examples.`,
      'Lines starting with "## " are section headings: keep each one as a single line starting with "## " in the same position and translate its text.',
      'Output only the translation.',
    ].join('\n'),
  }
}

// ---------------------------------------------------------------------------
// 估算与预算
// ---------------------------------------------------------------------------

const charCount = (text) => [...text].length

export function estimateTokens(text, locale, mode = 'conservative') {
  return MESSAGE_OVERHEAD_TOKENS + Math.ceil(charCount(text) * TOKENS_PER_CHAR[mode](locale))
}

export const usdFor = (price, inputTokens, outputTokens) =>
  (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1e6

/** 输出上限：预计输出的 1.5 倍 + 256，最多 8192（预算按此预留） */
export const maxOutputFor = (expected) => Math.min(8192, Math.ceil(expected * 1.5) + 256)

/**
 * 估算一种语言的回译费用（新语言页面尚不存在时以对照页长度 × expansion 代替）。
 * sources: { [对照语言]: [{ path, kind, text }] }
 */
export function estimateLocaleCost({ locale, plan, sources, model = BACKTRANSLATION_MODEL }) {
  const system = backTranslationPrompt(locale, 'en').system
  const out = { locale, model: model.key, priceUsd: model.priceUsd, sources: {}, totals: {} }
  for (const mode of ['conservative', 'typical'])
    out.totals[mode] = { calls: 0, input: 0, output: 0, usd: 0 }
  for (const [source, pages] of Object.entries(sources)) {
    const row = { pages: pages.length, sourceChars: 0, targetChars: 0, run: {}, calibration: {} }
    for (const mode of ['conservative', 'typical']) {
      let input = 0
      let output = 0
      let reserve = 0
      for (const page of pages) {
        const sourceChars = charCount(page.text)
        const targetChars = Math.max(
          Math.ceil(sourceChars * (plan.expansion[source] ?? 1)),
          plan.minChars?.[page.kind] ?? 0,
        )
        if (mode === 'conservative') {
          row.sourceChars += sourceChars
          row.targetChars += targetChars
        }
        const tpc = TOKENS_PER_CHAR[mode]
        const sys = estimateTokens(system, 'en', mode)
        const inTok = sys + MESSAGE_OVERHEAD_TOKENS + Math.ceil(targetChars * tpc(locale))
        const outTok = Math.ceil(sourceChars * tpc(source))
        input += inTok
        output += outTok
        reserve += usdFor(model.priceUsd, inTok, maxOutputFor(outTok))
      }
      const usd = usdFor(model.priceUsd, input, output)
      row.run[mode] = { calls: pages.length, input, output, usd: r4(usd), reserveUsd: r4(reserve) }
      // 校准：3 页 × 2 次调用（直译 + 回译）；取最长的 3 页，宁高勿低
      const control = [...pages]
        .sort((a, b) => charCount(b.text) - charCount(a.text))
        .slice(0, CONTROL_PAGES)
      let cIn = 0
      let cOut = 0
      for (const page of control) {
        const s = charCount(page.text)
        const t = Math.ceil(s * (plan.expansion[source] ?? 1))
        const tpc = TOKENS_PER_CHAR[mode]
        const sys = estimateTokens(system, 'en', mode)
        cIn += sys + MESSAGE_OVERHEAD_TOKENS + Math.ceil(s * tpc(source))
        cOut += Math.ceil(t * tpc(locale))
        cIn += sys + MESSAGE_OVERHEAD_TOKENS + Math.ceil(t * tpc(locale))
        cOut += Math.ceil(s * tpc(source))
      }
      row.calibration[mode] = {
        calls: control.length * 2,
        input: cIn,
        output: cOut,
        usd: r4(usdFor(model.priceUsd, cIn, cOut)),
      }
      const t = out.totals[mode]
      t.calls += pages.length + control.length * 2
      t.input += input + cIn
      t.output += output + cOut
      t.usd = r4(t.usd + usd + usdFor(model.priceUsd, cIn, cOut))
    }
    out.sources[source] = row
  }
  return out
}

const r4 = (x) => Math.round(x * 10000) / 10000

/** 预算台账：调用前按「输入估算 + 输出上限」预留，超出上限即不发出（packages/evals BudgetLedger 的同一规则） */
export class BudgetLedger {
  spent = 0
  reserved = 0
  exhausted = false
  limitUsd

  constructor(limitUsd) {
    if (!(Number.isFinite(limitUsd) && limitUsd > 0)) throw new Error('--budget-usd 必须是正数')
    this.limitUsd = limitUsd
  }

  reserve(usd) {
    if (this.spent + this.reserved + usd > this.limitUsd) {
      this.exhausted = true
      return null
    }
    this.reserved += usd
    return { usd }
  }

  settle(reservation, usd) {
    this.reserved -= reservation.usd
    this.spent += usd
  }
}

// ---------------------------------------------------------------------------
// 回译与校准（generate 由调用方注入：真实模式为模型调用，测试为假模型）
// ---------------------------------------------------------------------------

/**
 * 带缓存的单次调用：同一模型、提示词与输入只付费一次（缓存放证据目录，不进仓库）。
 * generate({ system, prompt, maxOutputTokens }) → { text, usage: { inputTokens, outputTokens } }
 */
export function cachedCaller({ generate, ledger, cacheDir, model = BACKTRANSLATION_MODEL }) {
  return async ({ system, prompt, fromLocale, toLocale }) => {
    const key = createHash('sha256')
      .update(JSON.stringify([model.key, model.providerModelId, model.temperature, system, prompt]))
      .digest('hex')
    const file = cacheDir ? join(cacheDir, `${key}.json`) : null
    if (file && existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }
    const inTok = estimateTokens(system, 'en') + estimateTokens(prompt, fromLocale)
    const expected = Math.ceil(charCount(prompt) * TOKENS_PER_CHAR.conservative(toLocale))
    const maxOutputTokens = maxOutputFor(expected)
    const reservation = ledger.reserve(usdFor(model.priceUsd, inTok, maxOutputTokens))
    if (!reservation) return { text: null, budgetExhausted: true }
    try {
      const result = await generate({ system, prompt, maxOutputTokens })
      const usd = usdFor(
        model.priceUsd,
        result.usage?.inputTokens ?? inTok,
        result.usage?.outputTokens ?? maxOutputTokens,
      )
      ledger.settle(reservation, usd)
      const record = { text: result.text, usage: result.usage ?? null, usd: r4(usd) }
      if (file) {
        mkdirSync(cacheDir, { recursive: true })
        writeFileSync(file, `${JSON.stringify(record)}\n`)
      }
      return record
    } catch (error) {
      ledger.settle(reservation, usdFor(model.priceUsd, inTok, maxOutputTokens))
      throw error
    }
  }
}

/** 一页的回译相似度：整页与逐段（FAQ 段单独给出最大值） */
export function backTranslationScore({ sourcePage, backText, sourceLocale }) {
  const unit = unitOf(sourceLocale)
  const back = splitSections(backText)
  const sourceSections = sourcePage.sections.filter((s, i) => i > 0 || s.text.trim())
  const sections = sourceSections.map((s, i) => ({
    title: s.title,
    kind: s.kind,
    dice: r3(dice(s.text, back[i] ?? '', unit)),
  }))
  const faq = sections.filter((s) => s.kind === 'faq').map((s) => s.dice)
  return {
    dice: r3(dice(fullText(sourcePage), back.join('\n'), unit)),
    faqMax: faq.length ? Math.max(...faq) : null,
    sections,
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 阈值：min(默认 0.50, 对照组中位数 − 0.20) */
export function calibratedThreshold(controlScores) {
  if (!controlScores.length) return THRESHOLDS.backTranslation
  return r3(
    Math.min(THRESHOLDS.backTranslation, median(controlScores) - THRESHOLDS.backTranslationMargin),
  )
}

/** 选对照组：优先不同类型（正文页、牌义页、数字/概念页），同类型取最长页；确定性，不随机 */
export function pickControlPages(pages, n = CONTROL_PAGES) {
  const preferred = ['tool', 'tarot-card', 'numerology-number', 'home', 'tarot-draw', 'faq']
  const byLength = [...pages].sort(
    (a, b) => charCount(fullText(b.page)) - charCount(fullText(a.page)),
  )
  const picked = []
  for (const kind of preferred) {
    const page = byLength.find((p) => p.kind === kind && !picked.includes(p))
    if (page) picked.push(page)
    if (picked.length === n) return picked
  }
  for (const page of byLength) {
    if (picked.length === n) break
    if (!picked.includes(page)) picked.push(page)
  }
  return picked
}

/** 校准：对照页 → 直译成新语言 → 回译 → 与对照页比较 */
export async function calibrate({ locale, source, pages, call }) {
  const control = pickControlPages(pages)
  const rows = []
  for (const { path, page } of control) {
    const literal = await call({
      ...literalTranslationPrompt(source, locale),
      prompt: serializeSections(page),
      fromLocale: source,
      toLocale: locale,
    })
    if (literal.text === null) return { budgetExhausted: true, rows }
    const back = await call({
      ...backTranslationPrompt(locale, source),
      prompt: literal.text,
      fromLocale: locale,
      toLocale: source,
    })
    if (back.text === null) return { budgetExhausted: true, rows }
    rows.push({
      path,
      ...backTranslationScore({ sourcePage: page, backText: back.text, sourceLocale: source }),
    })
  }
  const scores = rows.map((r) => r.dice)
  return {
    locale,
    source,
    model: BACKTRANSLATION_MODEL.key,
    temperature: BACKTRANSLATION_MODEL.temperature,
    control: rows.map(({ path, dice: d, faqMax }) => ({ path, dice: d, faqMax })),
    median: scores.length ? r3(median(scores)) : null,
    threshold: calibratedThreshold(scores),
  }
}

/** 正式测量：每个新语言页面回译成对照语言 */
export async function measureBackTranslation({ locale, source, pairs, call, threshold }) {
  const rows = []
  for (const { path, kind, sourcePage, targetPage } of pairs) {
    const back = await call({
      ...backTranslationPrompt(locale, source),
      prompt: serializeSections(targetPage),
      fromLocale: locale,
      toLocale: source,
    })
    if (back.text === null) return { budgetExhausted: true, rows }
    const score = backTranslationScore({ sourcePage, backText: back.text, sourceLocale: source })
    const failures = []
    if (score.dice > threshold) failures.push(`page ${score.dice} > ${threshold}`)
    if (score.faqMax !== null && score.faqMax > THRESHOLDS.backTranslationFaq)
      failures.push(`FAQ ${score.faqMax} > ${THRESHOLDS.backTranslationFaq}`)
    rows.push({ path, kind, ...score, failures })
  }
  return { rows, failing: rows.filter((r) => r.failures.length) }
}

// ---------------------------------------------------------------------------
// 外部回译文件（--export-input / --from-file）
// ---------------------------------------------------------------------------

const textHash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)
const fileId = (path) =>
  decodeURIComponent(path)
    .replace(/^\/+|\/+$/g, '')
    .replace(/[/\s]+/g, '__') || 'home'

/**
 * 外部回译的清单：每个新语言页面一项（回译成各对照语言），每种对照语言另有 CONTROL_PAGES 页对照组
 * （对照页原文 → 逐句直译成新语言 → 再回译）。路径相对导出目录；`inputHash` 用于核对回译的是同一份正文。
 */
export function buildManifest({ locale, plan, pages }) {
  const items = []
  const calibration = []
  for (const source of plan.sources) {
    const byPath = new Map(pages.filter((p) => p.locale === source).map((p) => [p.path, p]))
    for (const p of pages.filter((p) => p.locale === locale && p.alts[source])) {
      const sourcePage = byPath.get(new URL(p.alts[source]).pathname)
      if (!sourcePage) continue
      const id = fileId(p.path)
      const text = serializeSections(p.page)
      items.push({
        id,
        path: decodeURIComponent(p.path),
        kind: p.kind,
        source,
        sourcePath: decodeURIComponent(sourcePage.path),
        input: `pages/${id}.txt`,
        output: `back/${source}/${id}.txt`,
        inputHash: textHash(text),
        text,
      })
    }
    const control = pickControlPages(pages.filter((p) => p.locale === source))
    control.forEach(({ path, page }, n) => {
      const text = serializeSections(page)
      const base = `calibration/${source}/${n + 1}`
      calibration.push({
        source,
        path: decodeURIComponent(path),
        input: `${base}.source.txt`,
        literal: `${base}.literal.txt`,
        output: `${base}.back.txt`,
        inputHash: textHash(text),
        text,
      })
    })
  }
  return { locale, site: plan.site, sources: plan.sources, items, calibration }
}

/** 写出导出目录：正文文件、manifest.json（不含正文）与给回译 agent 的说明 */
export function writeExport(dir, manifest) {
  const strip = ({ text, ...rest }) => rest
  for (const entry of [...manifest.items, ...manifest.calibration]) {
    const file = join(dir, entry.input)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, `${entry.text}\n`)
  }
  const out = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    items: manifest.items.map(strip),
    calibration: manifest.calibration.map(strip),
  }
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(out, null, 2)}\n`)
  const names = (l) => LANGUAGE_NAMES[l] ?? l
  writeFileSync(
    join(dir, 'README.md'),
    [
      `# 回译输入：${manifest.locale}（${manifest.site} 站）`,
      '',
      '由与写作者不同家族的模型完成（写作者为 Claude，回译交给 Codex）。只翻译，不润色、不总结、不补充。',
      '以「## 」开头的行是段落标题：保持为单独一行、位置不变，只翻译其文字。',
      '',
      `1. 正式回译：把 manifest.json 中每个 items[].input（${names(manifest.locale)}）译成 items[].source 指定的语言，写到 items[].output。`,
      `   ${manifest.items.length} 页 × 对照语言（${manifest.sources.join('、')}）。`,
      `2. 校准对照组（每种对照语言 ${CONTROL_PAGES} 页）：先把 calibration[].input（对照语言原文）**逐句直译**成${names(manifest.locale)}，`,
      '   保持句序、段落与示例，写到 calibration[].literal；再把 literal 回译成原对照语言，写到 calibration[].output。',
      '3. 完成后运行 `node apps/web/scripts/measure-locale-backtranslation.mjs --locale ' +
        `${manifest.locale} --from-file <本目录>\`。`,
      '',
    ].join('\n'),
  )
}

/** 读取外部回译结果；缺失的文件返回 null */
export function readExternal(dir, entry, key = 'output') {
  const file = join(dir, entry[key])
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

/**
 * 外部回译的评分：与在线模式同一套公式（backTranslationScore、calibratedThreshold、FAQ 0.40）。
 * pages 为当前构建的页面（用于取对照页与核对正文是否与导出时一致）。
 */
export function scoreExternal({ dir, manifest, pages }) {
  const byPath = new Map(pages.map((p) => [`${p.locale} ${decodeURIComponent(p.path)}`, p]))
  const results = {}
  for (const source of manifest.sources) {
    const controlScores = []
    const missing = []
    for (const entry of manifest.calibration.filter((c) => c.source === source)) {
      const back = readExternal(dir, entry)
      const sourcePage = byPath.get(`${source} ${entry.path}`)?.page
      if (!back || !sourcePage) {
        missing.push(entry.output)
        continue
      }
      controlScores.push(
        backTranslationScore({ sourcePage, backText: back, sourceLocale: source }).dice,
      )
    }
    const threshold = calibratedThreshold(controlScores)
    const rows = []
    for (const entry of manifest.items.filter((i) => i.source === source)) {
      const back = readExternal(dir, entry)
      const target = byPath.get(`${manifest.locale} ${entry.path}`)?.page
      const sourcePage = byPath.get(`${source} ${entry.sourcePath}`)?.page
      if (!back || !target || !sourcePage) {
        missing.push(entry.output)
        continue
      }
      const stale = textHash(serializeSections(target)) !== entry.inputHash
      const score = backTranslationScore({ sourcePage, backText: back, sourceLocale: source })
      const failures = []
      if (score.dice > threshold) failures.push(`page ${score.dice} > ${threshold}`)
      if (score.faqMax !== null && score.faqMax > THRESHOLDS.backTranslationFaq)
        failures.push(`FAQ ${score.faqMax} > ${THRESHOLDS.backTranslationFaq}`)
      rows.push({ path: entry.path, kind: entry.kind, stale, ...score, failures })
    }
    results[source] = {
      calibration: {
        control: controlScores.length,
        median: controlScores.length ? r3(median(controlScores)) : null,
        threshold,
      },
      rows,
      failing: rows.filter((r) => r.failures.length),
      stale: rows.filter((r) => r.stale).map((r) => r.path),
      missing,
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// 命令行
// ---------------------------------------------------------------------------

function isCi(env) {
  const value = env.CI?.trim().toLowerCase()
  return Boolean(value) && value !== 'false' && value !== '0'
}

/** 真实模型调用：与 packages/evals 的 liveModelFactory + generate 相同的出口与参数 */
async function liveGenerate(env) {
  const ai = await import('@xuanxue/ai')
  const { generateText } = await import('ai')
  const modelEnv = {}
  for (const key of TEXT_ENV_KEYS) if (env[key] !== undefined) modelEnv[key] = env[key]
  const m = BACKTRANSLATION_MODEL
  const model = ai.defaultLanguageModelFactory(
    {
      id: m.key,
      key: m.key,
      kind: 'text',
      provider: m.provider,
      providerModelId: m.providerModelId,
      pricing: { mode: 'token', inputPer1k: 0, outputPer1k: 0 },
      tags: [],
      paramsSchema: null,
      sort: 0,
    },
    modelEnv,
  )
  const thinking = ai.resolveTextThinking(m.provider, m.thinking, m.thinking)
  const thinkingOptions =
    thinking === undefined
      ? {}
      : ai.getTextProviderCapabilities(m.provider).applyThinking({}, thinking)
  return async ({ system, prompt, maxOutputTokens }) => {
    const result = await generateText({
      ...thinkingOptions,
      model,
      instructions: system,
      prompt,
      maxOutputTokens,
      temperature: m.temperature,
      // 重试会产生预算外的费用
      maxRetries: 0,
    })
    return {
      text: result.text,
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
    }
  }
}

/** 取对照语言（及新语言）的页面：按计划的页面类型筛选 */
async function loadPages({ baseUrl, config, plan, locales }) {
  const { entries, fetchHtml } = await siteClient(config, plan.site, baseUrl)
  const wanted = entries.filter((e) => {
    const locale = entryLocale(e)
    const path = new URL(e.loc).pathname
    return (
      locales.includes(locale) &&
      plan.kinds.includes(pageKind(path)) &&
      !plan.exclude.test(decodeURIComponent(path))
    )
  })
  const extractor = createExtractor()
  try {
    const pages = await pool(wanted, async (e) => {
      const path = new URL(e.loc).pathname
      return {
        locale: entryLocale(e),
        path,
        alts: e.alts,
        kind: pageKind(path),
        page: extractor.extract(await fetchHtml(path)),
      }
    })
    return pages
  } finally {
    await extractor.close()
  }
}

export function renderEstimate(estimate, plan) {
  const lines = [
    `## ${estimate.locale}（${plan.site} 站；对照 ${Object.keys(estimate.sources).join('、')}；模型 ${estimate.model}，温度 0；$${estimate.priceUsd.inputPerMTok}/$${estimate.priceUsd.outputPerMTok} 每百万 token 输入/输出）`,
    '',
    '| 对照语言 | 页数 | 对照页字符 | 新语言估算字符 | 全量回译（保守） | 全量回译（典型） | 预算预留（保守） | 校准 3 页（保守） | 校准（典型） |',
    '|---|---|---|---|---|---|---|---|---|',
  ]
  for (const [source, row] of Object.entries(estimate.sources))
    lines.push(
      `| ${source} | ${row.pages} | ${row.sourceChars} | ${row.targetChars} | ${row.run.conservative.input} in / ${row.run.conservative.output} out ≈ $${row.run.conservative.usd} | ${row.run.typical.input} / ${row.run.typical.output} ≈ $${row.run.typical.usd} | $${row.run.conservative.reserveUsd} | $${row.calibration.conservative.usd} | $${row.calibration.typical.usd} |`,
    )
  const t = estimate.totals
  lines.push(
    '',
    `合计（全量一遍 + 校准）：保守 ${t.conservative.calls} 次调用、${t.conservative.input} 输入 / ${t.conservative.output} 输出 token ≈ **$${t.conservative.usd}**；典型 ≈ $${t.typical.usd}。`,
    '',
  )
  return lines.join('\n')
}

async function main() {
  const { values } = parseArgs({
    options: {
      locale: { type: 'string', multiple: true },
      'dry-run': { type: 'boolean' },
      live: { type: 'boolean' },
      calibrate: { type: 'boolean' },
      'budget-usd': { type: 'string' },
      calibration: { type: 'string' },
      'base-url': { type: 'string' },
      out: { type: 'string' },
      'export-input': { type: 'string' },
      'from-file': { type: 'string' },
    },
  })
  const locales = values.locale?.length ? values.locale : Object.keys(LOCALE_PLANS)
  for (const locale of locales)
    if (!LOCALE_PLANS[locale]) throw new Error(`没有 ${locale} 的页面计划（LOCALE_PLANS）`)
  const live = Boolean(values.live)
  if (live && values['dry-run']) throw new Error('--live 与 --dry-run 不能同时使用')
  if (live) {
    if (isCi(process.env)) throw new Error('CI 中拒绝真实模型调用')
    if (values['budget-usd'] === undefined)
      throw new Error('--live 需要 --budget-usd <美元>（使用者批准的预算）')
  }
  const outDir = resolve(
    values.out ??
      join(
        process.env.EVIDENCE_DIR ?? join(REPO_ROOT, 'test-results/evidence'),
        'locale-backtranslation',
      ),
  )
  const config = await loadTemplateConfig()
  const preview = values['base-url'] ? null : await startPreview()
  const baseUrl = values['base-url'] ?? preview.baseUrl
  try {
    const external = values['export-input'] ?? values['from-file']
    if (external) {
      if (live) throw new Error('--export-input / --from-file 不调用模型，不能与 --live 同用')
      for (const locale of locales) {
        const plan = LOCALE_PLANS[locale]
        const pages = await loadPages({ baseUrl, config, plan, locales: [locale, ...plan.sources] })
        const dir = resolve(external)
        if (values['export-input']) {
          const manifest = buildManifest({ locale, plan, pages })
          mkdirSync(dir, { recursive: true })
          writeExport(dir, manifest)
          console.log(
            `${locale}：导出 ${manifest.items.length} 项回译输入、${manifest.calibration.length} 页对照组 → ${dir}`,
          )
          continue
        }
        const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
        const results = scoreExternal({ dir, manifest, pages })
        const report = { locale, generatedAt: new Date().toISOString(), mode: 'from-file', results }
        writeFileSync(
          join(mkdirOut(outDir), `backtranslation-${locale}-external.json`),
          `${JSON.stringify(report, null, 2)}\n`,
        )
        for (const [source, r] of Object.entries(results)) {
          console.log(
            `${locale} → ${source}：${r.rows.length} 页，未达门槛 ${r.failing.length}，阈值 ${r.calibration.threshold}（对照组 ${r.calibration.control} 页，中位数 ${r.calibration.median}），缺回译 ${r.missing.length}，正文已变 ${r.stale.length}`,
          )
          if (r.failing.length || r.missing.length) process.exitCode = 1
        }
      }
      return
    }
    if (!live) {
      const report = { generatedAt: new Date().toISOString(), mode: 'dry-run', estimates: [] }
      const md = [
        '# 回译相似度费用估算（dry-run，未调用模型）',
        '',
        '新语言页面尚未写成，按对照语言的第一期页面长度 × 长度系数估算（工具页取长度下限）；',
        '保守口径与 @xuanxue/ai 预算预留一致（1 token / 字符），典型口径为常见分词器经验值。',
        '「全量回译」为每页回译一次；内容改写后只需重跑改动页（结果按输入哈希缓存）。',
        '',
      ]
      for (const locale of locales) {
        const plan = LOCALE_PLANS[locale]
        const pages = await loadPages({ baseUrl, config, plan, locales: plan.sources })
        const sources = Object.fromEntries(
          plan.sources.map((s) => [
            s,
            pages
              .filter((p) => p.locale === s)
              .map((p) => ({ path: p.path, kind: p.kind, text: serializeSections(p.page) })),
          ]),
        )
        const estimate = estimateLocaleCost({ locale, plan, sources })
        report.estimates.push(estimate)
        md.push(renderEstimate(estimate, plan))
        console.log(
          `${locale}：保守 ≈ $${estimate.totals.conservative.usd}（${estimate.totals.conservative.calls} 次调用），典型 ≈ $${estimate.totals.typical.usd}`,
        )
      }
      mkdirSync(outDir, { recursive: true })
      writeFileSync(join(outDir, 'estimate.json'), `${JSON.stringify(report, null, 2)}\n`)
      writeFileSync(join(outDir, 'estimate.md'), `${md.join('\n')}\n`)
      console.log(`→ ${join(outDir, 'estimate.md')}`)
      return
    }

    // 真实模式：与 packages/evals 相同，从根目录 .env.local 读取模型出口变量（不输出任何值）
    const envFile = join(REPO_ROOT, '.env.local')
    if (existsSync(envFile)) process.loadEnvFile(envFile)
    const ledger = new BudgetLedger(Number(values['budget-usd']))
    const call = cachedCaller({
      generate: await liveGenerate(process.env),
      ledger,
      cacheDir: join(outDir, 'cache'),
    })
    for (const locale of locales) {
      const plan = LOCALE_PLANS[locale]
      const pages = await loadPages({ baseUrl, config, plan, locales: [locale, ...plan.sources] })
      for (const source of plan.sources) {
        const sourcePages = pages.filter((p) => p.locale === source)
        const result = { locale, source, generatedAt: new Date().toISOString() }
        if (values.calibrate) {
          result.calibration = await calibrate({ locale, source, pages: sourcePages, call })
          writeFileSync(
            join(mkdirOut(outDir), `calibration-${locale}-${source}.json`),
            `${JSON.stringify(result.calibration, null, 2)}\n`,
          )
        } else {
          const calibrationFile =
            values.calibration ?? join(outDir, `calibration-${locale}-${source}.json`)
          const threshold = existsSync(calibrationFile)
            ? JSON.parse(readFileSync(calibrationFile, 'utf8')).threshold
            : THRESHOLDS.backTranslation
          const byPath = new Map(sourcePages.map((p) => [p.path, p]))
          const pairs = pages
            .filter((p) => p.locale === locale && p.alts[source])
            .map((p) => ({
              path: decodeURIComponent(p.path),
              kind: p.kind,
              targetPage: p.page,
              sourcePage: byPath.get(new URL(p.alts[source]).pathname)?.page,
            }))
            .filter((p) => p.sourcePage)
          result.threshold = threshold
          result.measure = await measureBackTranslation({ locale, source, pairs, call, threshold })
          writeFileSync(
            join(mkdirOut(outDir), `backtranslation-${locale}-${source}.json`),
            `${JSON.stringify(result, null, 2)}\n`,
          )
          console.log(
            `${locale} → ${source}：${result.measure.rows.length} 页，未达门槛 ${result.measure.failing?.length ?? '?'}（阈值 ${threshold}）`,
          )
        }
      }
    }
    console.log(
      `费用 $${ledger.spent.toFixed(4)} / 预算 $${ledger.limitUsd}${ledger.exhausted ? '（已触顶，部分页面未测）' : ''}`,
    )
    if (ledger.exhausted) process.exitCode = 3
  } finally {
    preview?.stop()
  }
}

function mkdirOut(dir) {
  mkdirSync(dir, { recursive: true })
  return dir
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
