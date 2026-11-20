// 新语言的内容完整性与文字检测（openspec add-locales-eu-ja design 决策 5「内容回退」，tasks 1.5）。
// 本文件归项目所有（不是模板文件），template-sync 不覆盖。在 `vite build` 之前运行（apps/web package.json build）。
//
// 对已写入 template.config.ts 的严格语言（features/i18n/rollout.ts STRICT_MESSAGE_LOCALES，即 v1 之后的新语言）：
//   - 塔罗：content/tarot/<locale>/ 必须有与英文相同的 78 个条目；
//   - 数字命理（只对西方站语言）：content/numerology/<locale>/ 必须有与英文相同的条目；
//   - 法律页：content/legal/<site>/<locale>/ 与 content/legal/shared/<locale>/ 必须有与本站原文语言
//     （西方站 en、东方站 zh-Hant）相同的条目；
//   - 东方站 ja：每个内容文件的正文必须含假名，拉丁字母占字母总数的比例低于阈值（不允许以英文或中文正文回退）。
// 新语言内容不依赖模板 0.7.4 的回退页规则：缺条目即构建失败。
// 用法：node scripts/check-locale-content.mjs [--root <apps/web 目录>]
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const WEB_ROOT = new URL('..', import.meta.url).pathname

/** 各站点法律页的原文语言 */
export const LEGAL_SOURCE_LOCALES = { west: 'en', east: 'zh-Hant' }

/** ja 正文中拉丁字母占全部字母（拉丁 + 假名 + 汉字）的比例上限；品牌名、牌名英文 slug 等少量拉丁字母允许 */
export const JA_LATIN_RATIO_MAX = 0.2
/** ja 正文中假名占日文字符（假名 + 汉字）的比例下限：中文正文为 0，日文正文通常在 0.3 以上 */
export const JA_KANA_RATIO_MIN = 0.1

function entries(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.mdx') || name.endsWith('.md'))
    .map((name) => name.replace(/\.mdx?$/, ''))
    .sort()
}

/** `expected` 中缺少的条目 */
function missingEntries(expected, actual) {
  const have = new Set(actual)
  return expected.filter((name) => !have.has(name))
}

/**
 * ja 正文的文字统计：去掉 frontmatter 之外的 MDX/HTML 标记、链接地址与代码后，统计假名、汉字与拉丁字母。
 * 返回问题描述；没有问题时返回 null。
 */
export function japaneseTextIssue(source) {
  const body = source
    .replace(/^---\n[\s\S]*?\n---\n/, (front) =>
      // frontmatter 只看 title / description / faq 的文字值，不看 slug、cardId 等标识
      front
        .split('\n')
        .filter((line) => /^\s*(title|description|q|a|-\s*q|-\s*a)\s*:/.test(line))
        .map((line) => line.replace(/^[^:]*:\s*/, ''))
        .join('\n'),
    )
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<[^>]+>/g, '')
    .replace(/https?:\/\/\S+/g, '')
  const kana = (body.match(/[぀-ヿㇰ-ㇿｦ-ﾟ]/g) ?? []).length
  const kanji = (body.match(/[㐀-䶿一-鿿豈-﫿]/g) ?? []).length
  const latin = (body.match(/[A-Za-zÀ-ɏ]/g) ?? []).length
  const letters = kana + kanji + latin
  if (letters === 0) return '正文为空'
  if (kana === 0) return '正文不含假名'
  if (kana / (kana + kanji) < JA_KANA_RATIO_MIN)
    return `假名比例 ${(kana / (kana + kanji)).toFixed(2)} 低于 ${JA_KANA_RATIO_MIN}（疑似中文正文）`
  if (latin / letters > JA_LATIN_RATIO_MAX)
    return `拉丁字母比例 ${(latin / letters).toFixed(2)} 高于 ${JA_LATIN_RATIO_MAX}（疑似英文正文）`
  return null
}

/**
 * 检查 `locales` 中各语言的内容完整性。`sites` 为 template.config.ts 的站点注册表（只用 locales）。
 * 返回问题列表（字符串），没有问题时为空数组。
 */
export function checkLocaleContent({ root = WEB_ROOT, locales, sites }) {
  const content = join(root, 'content')
  const problems = []
  for (const locale of locales) {
    const site = ['west', 'east'].find((id) => sites[id].locales.includes(locale))
    if (!site) continue
    const files = []
    const require = (collection, expected, dir) => {
      const actual = entries(dir)
      for (const name of missingEntries(expected, actual))
        problems.push(`${locale}: 缺少 ${collection} 条目 ${name}（${dir}）`)
      for (const name of actual) files.push(join(dir, `${name}.mdx`))
    }
    require('tarot', entries(join(content, 'tarot', 'en')), join(content, 'tarot', locale))
    if (site === 'west')
      require('numerology', entries(join(content, 'numerology', 'en')), join(
        content,
        'numerology',
        locale,
      ))
    const source = LEGAL_SOURCE_LOCALES[site]
    require('legal', entries(join(content, 'legal', site, source)), join(
      content,
      'legal',
      site,
      locale,
    ))
    require('legal/shared', entries(join(content, 'legal', 'shared', source)), join(
      content,
      'legal',
      'shared',
      locale,
    ))
    if (locale === 'ja')
      for (const file of files) {
        if (!existsSync(file)) continue
        const issue = japaneseTextIssue(readFileSync(file, 'utf8'))
        if (issue) problems.push(`${locale}: ${file.slice(root.length + 1)} ${issue}`)
      }
  }
  return problems
}

async function main() {
  const { values } = parseArgs({ options: { root: { type: 'string' } } })
  const root = values.root ? resolve(values.root) : WEB_ROOT
  const { default: config } = await import(
    new URL('../../../template.config.ts', import.meta.url).href
  )
  const { STRICT_MESSAGE_LOCALES } = await import('../src/features/i18n/rollout.ts')
  const enabled = config.i18n.enabled ? config.i18n.locales : [config.i18n.defaultLocale]
  const locales = enabled.filter((locale) => STRICT_MESSAGE_LOCALES.includes(locale))
  const problems = checkLocaleContent({ root, locales, sites: config.sites })
  if (problems.length > 0) {
    console.error(
      `新语言内容检查失败（${problems.length} 项）：\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    )
    process.exit(1)
  }
  console.log(
    `新语言内容检查通过：${locales.length ? locales.join(', ') : '当前没有已配置的新语言'}`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) await main()
