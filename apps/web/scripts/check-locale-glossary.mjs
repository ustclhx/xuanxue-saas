// 术语表检查（OpenSpec add-locales-eu-ja 任务 2.3；localized-content-quality「术语表强制」）。
// 术语表：apps/web/i18n/glossary/<locale>.json，每种新语言一份。检查两件事：
//   1. 术语表自身：结构、合规表述三项齐全、「娱乐」定位禁用词存在、每个目标页锚文本 ≤2 种、
//      首选写法不与任何禁用写法冲突；
//   2. 该语言的文案与内容：禁用写法（术语、合规、文风）出现即失败并列出位置；内容已存在时
//      合规表述三项至少各出现一次，`requiredIn` 指定的文件必须包含；MDX 链接锚文本须在白名单内。
// 由 `pnpm check` 运行；没有术语表的语言不检查。
//
// 术语表格式：
// {
//   "locale": "ja", "site": "east", "status": "draft" | "reviewed",
//   "review": "审阅记录在证据目录中的位置",
//   "cardName": "{suit}の{rank}",             // 小阿尔卡那牌名的组合方式（事实单生成用）
//   "terms": [{ "id": "tarot.suit.cups", "en": "Cups", "preferred": "カップ",
//               "variants": ["..."],          // 可接受的写法（正文可用，标题与牌名用 preferred）
//               "banned": [Banned], "note": "..." }],
//   "banned": [Banned],                       // 文风与其他禁用写法
//   "compliance": {
//     "required": [{ "id": "traditional-method" | "reference-only" | "no-prediction",
//                    "phrases": ["..."], "requiredIn": ["glob"] }],
//     "banned": [Banned]                      // 「娱乐」定位与保证性说法
//   },
//   "anchors": { "/ja/四柱推命": ["四柱推命", "..."], "/ja/タロット/カード/*": ["{card}", "{card}の意味"] },
//   "scan": ["额外检查的文件 glob（相对仓库根）"]
// }
// Banned：字符串，或 { "text" | "regex", "flags"?, "use"?, "reason"?, "allowIn"?: ["glob"] }。
// 拼音文字的 text 按词边界匹配（区分大小写）；中日韩直接按子串匹配，首选写法与 variants 中包含禁用串的
// 部分（如「正位置」中的「正位」）先遮蔽再匹配。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const REPO_ROOT = resolve(new URL('../../..', import.meta.url).pathname)
const GLOSSARY_DIR = join(REPO_ROOT, 'apps/web/i18n/glossary')
export const REQUIRED_COMPLIANCE = Object.freeze([
  'traditional-method',
  'reference-only',
  'no-prediction',
])
export const MAX_ANCHORS = 2
const CJK_LOCALES = new Set(['ja', 'ko', 'zh-Hans', 'zh-Hant'])

/** 该语言默认检查的文件（相对仓库根的 glob） */
export function defaultScan(locale) {
  return [
    `apps/web/messages/${locale}/**/*.json`,
    `apps/web/content/*/${locale}/**/*.mdx`,
    `apps/web/content/legal/*/${locale}/**/*.mdx`,
    `packages/tarot/src/data/${locale}.ts`,
    `apps/web/src/features/daily/rules/${locale}.ts`,
  ]
}

// ---------------------------------------------------------------------------
// glob
// ---------------------------------------------------------------------------

export function globToRegExp(glob) {
  let out = ''
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      // `**/` 匹配零或多级目录
      if (glob[i + 2] === '/') {
        out += '(?:.*/)?'
        i += 2
      } else {
        out += '.*'
        i += 1
      }
    } else if (c === '*') out += '[^/]*'
    else if (c === '?') out += '[^/]'
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`)
}

/** 列出仓库中匹配 glob 的文件（从 glob 的固定前缀目录开始遍历） */
export function expandGlobs(globs, root = REPO_ROOT) {
  const files = new Set()
  for (const glob of globs) {
    const re = globToRegExp(glob)
    const fixed = glob
      .split('/')
      .filter((_part, i, all) => !/[*?]/.test(all.slice(0, i + 1).join('/')))
    const start = join(root, ...fixed)
    if (!existsSync(start)) continue
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else {
          const rel = relative(root, full).split(sep).join('/')
          if (re.test(rel)) files.add(rel)
        }
      }
    }
    if (statSync(start).isDirectory()) walk(start)
    else {
      const rel = relative(root, start).split(sep).join('/')
      if (re.test(rel)) files.add(rel)
    }
  }
  return [...files].sort()
}

// ---------------------------------------------------------------------------
// 术语表结构
// ---------------------------------------------------------------------------

const bannedLabel = (b) => (typeof b === 'string' ? b : (b.text ?? `/${b.regex}/`))

/** 返回结构错误列表（空数组表示通过） */
export function validateGlossary(glossary, locale) {
  const errors = []
  if (glossary.locale !== locale) errors.push(`locale 字段为 ${glossary.locale}，应为 ${locale}`)
  if (!['draft', 'reviewed'].includes(glossary.status)) errors.push('status 须为 draft 或 reviewed')
  if (!Array.isArray(glossary.terms) || glossary.terms.length === 0) errors.push('terms 不能为空')
  const ids = new Set()
  const allowed = []
  for (const term of glossary.terms ?? []) {
    if (!term.id || !term.preferred)
      errors.push(`术语缺少 id 或 preferred：${JSON.stringify(term)}`)
    if (ids.has(term.id)) errors.push(`术语 id 重复：${term.id}`)
    ids.add(term.id)
    allowed.push({ id: term.id, text: term.preferred })
    for (const v of term.variants ?? []) allowed.push({ id: term.id, text: v })
  }
  const compliance = glossary.compliance ?? {}
  for (const id of REQUIRED_COMPLIANCE) {
    const item = (compliance.required ?? []).find((r) => r.id === id)
    if (!item?.phrases?.length) errors.push(`缺少合规表述 ${id}`)
  }
  if (!compliance.banned?.length) errors.push('compliance.banned 须列出「娱乐」定位等禁用说法')
  for (const [target, anchors] of Object.entries(glossary.anchors ?? {})) {
    if (!Array.isArray(anchors) || anchors.length === 0 || anchors.length > MAX_ANCHORS)
      errors.push(`锚文本 ${target}：须为 1–${MAX_ANCHORS} 种，现为 ${anchors?.length ?? 0}`)
    if (!target.startsWith('/')) errors.push(`锚文本目标须为站内路径：${target}`)
  }
  // 首选写法与可接受写法不能命中任何禁用写法（遮蔽后仍命中才算冲突）
  const compiled = compileGlossary(glossary)
  for (const { id, text } of allowed)
    for (const hit of scanText(text, compiled, { file: '(glossary)', term: id }))
      errors.push(`术语 ${id} 的写法「${text}」命中禁用写法「${hit.banned}」`)
  for (const item of compliance.required ?? [])
    for (const phrase of item.phrases ?? [])
      for (const hit of scanText(phrase, compiled, { file: '(glossary)' }))
        errors.push(`合规表述「${phrase}」命中禁用写法「${hit.banned}」`)
  for (const b of compiled.banned) if (b.error) errors.push(b.error)
  return errors
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 把术语表编译成匹配器：每条禁用写法一个正则，并收集需要遮蔽的允许写法 */
export function compileGlossary(glossary) {
  const cjk = CJK_LOCALES.has(glossary.locale)
  const banned = []
  const add = (entry, source, use) => {
    const b = typeof entry === 'string' ? { text: entry } : entry
    let re
    try {
      if (b.regex) re = new RegExp(b.regex, `${b.flags ?? ''}gu`.replace(/(.)(?=.*\1)/g, ''))
      else if (cjk) re = new RegExp(escapeRe(b.text), 'gu')
      else
        re = new RegExp(
          `(?<![\\p{L}\\p{M}\\p{N}])${escapeRe(b.text)}(?![\\p{L}\\p{M}\\p{N}])`,
          'gu',
        )
    } catch (error) {
      banned.push({ error: `禁用写法正则无效（${source}）：${bannedLabel(b)}：${error.message}` })
      return
    }
    banned.push({
      label: bannedLabel(b),
      re,
      source,
      use: b.use ?? use ?? null,
      reason: b.reason ?? null,
      allowIn: (b.allowIn ?? []).map(globToRegExp),
      // 术语表内部的例外：这些术语的写法可以与此禁用写法相同（如紫微斗数的「命盤」）
      allowFor: b.allowFor ?? [],
    })
  }
  for (const term of glossary.terms ?? [])
    for (const b of term.banned ?? []) add(b, `terms:${term.id}`, term.preferred)
  for (const b of glossary.banned ?? []) add(b, 'banned')
  for (const b of glossary.compliance?.banned ?? []) add(b, 'compliance')
  // 遮蔽：允许写法中包含禁用串时（「正位置」⊃「正位」），先把允许写法替换成等长占位
  const allowedTexts = [
    ...(glossary.terms ?? []).flatMap((t) => [t.preferred, ...(t.variants ?? [])]),
    ...(glossary.compliance?.required ?? []).flatMap((r) => r.phrases ?? []),
    ...(glossary.allowed ?? []),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  // 只遮蔽「禁用串是其真子串」的允许写法；与禁用写法完全相同的允许写法不遮蔽（否则禁用失效）
  const masks = allowedTexts
    .filter((text) =>
      banned.some(
        (b) =>
          b.re &&
          [...text.matchAll(new RegExp(b.re.source, b.re.flags))].some(
            (m) => m[0].length < text.length,
          ),
      ),
    )
    .map((text) => new RegExp(escapeRe(text), 'gu'))
  return { banned: banned.filter((b) => b.re), masks, glossary }
}

function maskText(text, masks) {
  let out = text
  for (const re of masks) out = out.replace(re, (m) => '\u0000'.repeat(m.length))
  return out
}

/** 在一段文字中找禁用写法；返回 { banned, use, line, column, excerpt } */
export function scanText(text, compiled, { file, term = null }) {
  const masked = maskText(text, compiled.masks)
  const hits = []
  for (const b of compiled.banned) {
    if (b.allowIn.some((re) => re.test(file))) continue
    if (term && b.allowFor.includes(term)) continue
    b.re.lastIndex = 0
    for (const m of masked.matchAll(b.re)) {
      const before = text.slice(0, m.index)
      const line = before.split('\n').length
      const column = m.index - before.lastIndexOf('\n')
      hits.push({
        file,
        line,
        column,
        banned: b.label,
        source: b.source,
        use: b.use,
        reason: b.reason,
        excerpt: text
          .slice(Math.max(0, m.index - 12), m.index + m[0].length + 12)
          .replace(/\n/g, ' '),
      })
    }
  }
  return hits
}

/** 文件中参与检查的文字：JSON 只取字符串值；MDX 去掉链接地址；其他文件原样 */
export function textOf(file, raw) {
  if (file.endsWith('.json')) {
    // 保持行号：只把键名换成等长空白
    return raw.replace(
      /"((?:[^"\\]|\\.)*)"(\s*:)/g,
      (_, key, colon) => `${' '.repeat(key.length + 2)}${colon}`,
    )
  }
  if (file.endsWith('.mdx') || file.endsWith('.md'))
    return raw.replace(/\]\(([^)]*)\)/g, (m) => `]${' '.repeat(m.length - 1)}`)
  return raw
}

/** MDX 链接锚文本白名单：目标页在 anchors 中登记时，锚文本必须是其中之一 */
export function checkAnchors(file, raw, glossary) {
  const entries = Object.entries(glossary.anchors ?? {}).map(([target, anchors]) => ({
    target,
    re: globToRegExp(target),
    anchors: anchors.map(
      (a) => new RegExp(`^${escapeRe(a).replace(/\\\{(?:card|n|name)\\\}/g, '.+')}$`, 'u'),
    ),
    labels: anchors,
  }))
  const out = []
  for (const m of raw.matchAll(/\[([^\]]+)\]\((\/[^)\s#?]*)/g)) {
    let target = m[2]
    try {
      target = decodeURIComponent(target)
    } catch {
      // 保留原样
    }
    const entry = entries.find((e) => e.re.test(target))
    if (!entry) continue
    if (entry.anchors.some((re) => re.test(m[1]))) continue
    const line = raw.slice(0, m.index).split('\n').length
    out.push({
      file,
      line,
      banned: `锚文本「${m[1]}」→ ${target}`,
      use: entry.labels.join(' / '),
      source: 'anchors',
    })
  }
  return out
}

/** 检查一种语言：返回 { errors（术语表结构）, findings（内容违规）, files, notes } */
export function checkLocale(glossary, { root = REPO_ROOT } = {}) {
  const locale = glossary.locale
  const errors = validateGlossary(glossary, locale)
  const compiled = compileGlossary(glossary)
  // 按站点区分的术语表（如东方站英文 en-east.json）只检查自己列出的文件：同一语言的默认位置属于另一站点
  const files = expandGlobs(
    [...(glossary.scanOnly ? [] : defaultScan(locale)), ...(glossary.scan ?? [])],
    root,
  )
  const findings = []
  const notes = []
  const corpus = []
  for (const file of files) {
    const raw = readFileSync(join(root, file), 'utf8')
    const text = textOf(file, raw)
    corpus.push({ file, text })
    findings.push(...scanText(text, compiled, { file }))
    if (file.endsWith('.mdx')) findings.push(...checkAnchors(file, raw, glossary))
  }
  const required = glossary.compliance?.required ?? []
  if (corpus.length === 0) notes.push(`${locale}：尚无文案与内容文件，只检查了术语表结构`)
  else
    for (const item of required) {
      // 不区分大小写：句首的「Solo como referencia」也算
      const has = (text) => item.phrases.some((p) => text.toLowerCase().includes(p.toLowerCase()))
      if (!corpus.some(({ text }) => has(text)))
        findings.push({
          file: '(全部内容)',
          line: 0,
          banned: `缺少合规表述 ${item.id}`,
          use: item.phrases.join(' / '),
          source: 'compliance',
        })
      for (const file of expandGlobs(item.requiredIn ?? [], root)) {
        const entry = corpus.find((c) => c.file === file) ?? {
          text: readFileSync(join(root, file), 'utf8'),
        }
        if (!has(entry.text))
          findings.push({
            file,
            line: 0,
            banned: `缺少合规表述 ${item.id}`,
            use: item.phrases.join(' / '),
            source: 'compliance',
          })
      }
    }
  return { locale, errors, findings, files, notes }
}

/**
 * 术语表文件名：`<语言>.json`；同一语言在两站各有页面时（东方站英文），按站点区分的术语表为
 * `<语言>-<站点>.json`，并带 `site` 与 `scanOnly`（项目扩展，openspec add-locales-eu-ja 5b）
 */
export function glossaryKey(glossary) {
  return glossary.scanOnly && glossary.site
    ? `${glossary.locale}-${glossary.site}`
    : glossary.locale
}

export function loadGlossaries(dir = GLOSSARY_DIR) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      file: join(dir, f),
      locale: f.replace(/\.json$/, ''),
      glossary: JSON.parse(readFileSync(join(dir, f), 'utf8')),
    }))
}

function main() {
  let failed = 0
  const glossaries = loadGlossaries()
  for (const { file, locale, glossary } of glossaries) {
    const result = checkLocale({ ...glossary, locale: glossary.locale ?? locale })
    if (glossaryKey(glossary) !== locale)
      result.errors.unshift(`${relative(REPO_ROOT, file)}：文件名与 locale 字段不一致`)
    for (const e of result.errors) console.error(`✗ ${locale} 术语表：${e}`)
    for (const f of result.findings)
      console.error(
        `✗ ${f.file}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''} 「${f.banned}」${f.use ? ` → 用「${f.use}」` : ''}${f.reason ? `（${f.reason}）` : ''}${f.excerpt ? `：…${f.excerpt}…` : ''}`,
      )
    for (const n of result.notes) console.log(`  ${n}`)
    failed += result.errors.length + result.findings.length
    console.log(
      `术语表 ${locale}（${glossary.status}）：${glossary.terms?.length ?? 0} 条术语，检查 ${result.files.length} 个文件，${result.errors.length + result.findings.length} 个问题`,
    )
  }
  if (failed) {
    console.error(`术语表检查失败：${failed} 个问题`)
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) main()
