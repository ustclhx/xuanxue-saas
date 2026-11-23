// 合盘工具正文与关系场景页（content/compat/<locale>）的内容校验（openspec content-growth-v2-tools 任务 13.1、
// design 决策 7、14、16）：
// - 页面齐全：zh-Hans、zh-Hant、ja、en 各有工具页 index 与 5 个场景页；ko 只有场景页（`/사주궁합` 正文不改）；
// - frontmatter：七个分项解释齐全；场景页的 `short` 与 compat/paths.ts 的导航名一致，`tool_anchor` 在决策 13
//   允许的两种锚文本之内；
// - 引擎事实复算：正文中「两字 + 关系」的写法（甲己合、子午冲、子卯刑、辰辰自刑、申子辰三合等）逐条用
//   @xuanxue/bazi 的关系判定复算；带正负号的分值只能是引擎的分值（+15、+12、+8、−15、−8、+10）。
// 运行：node scripts/check-content-compat.mjs [--report <文件>]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import {
  COMPAT_LOCALES,
  COMPAT_SCENARIO_KEYS,
  COMPAT_SCENARIO_TITLES,
  COMPAT_TOOL_BODY_LOCALES,
} from '../apps/web/src/features/east-content/compat/paths.ts'
import { BRANCHES as BRANCH_KEYS, STEMS as STEM_KEYS } from '../packages/bazi/src/constants.ts'
import {
  isClash,
  isPunish,
  isSixCombine,
  isStemCombine,
  isTriad,
} from '../packages/bazi/src/relations.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parse } = coreRequire('yaml')

const ROOT = new URL('../apps/web/content/compat/', import.meta.url)
const ITEM_KEYS = [
  'stemCombine',
  'branchSixCombine',
  'branchTriad',
  'branchClash',
  'branchPunish',
  'elementComplementAB',
  'elementComplementBA',
]
/** 决策 13 与术语表（i18n/glossary）登记的工具页锚文本：每种语言两种 */
const TOOL_ANCHORS = {
  'zh-Hans': ['八字合盘', '合盘'],
  'zh-Hant': ['八字合盤', '合盤'],
  ko: ['사주궁합', '무료 사주궁합'],
  ja: ['四柱推命の相性', '四柱推命 相性'],
  en: ['BaZi compatibility', 'BaZi chart compatibility'],
}
const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
// 汉字与引擎序号一一对应（甲=0、子=0，同 packages/bazi/src/constants.ts）
if (STEM_KEYS.length !== STEMS.length || BRANCH_KEYS.length !== BRANCHES.length)
  throw new Error('干支表与引擎不一致')
const stem = (char) => STEMS.indexOf(char)
const branch = (char) => BRANCHES.indexOf(char)
/** 引擎分值（packages/bazi/src/compat.ts）：基础 60，五行互补每向最多 10 */
const SIGNED_POINTS = new Set(['15', '12', '8', '10'])

function read(locale, page) {
  const file = new URL(`${locale}/${page}.mdx`, ROOT)
  if (!existsSync(file)) return null
  const source = readFileSync(file, 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source)
  if (!match) throw new Error(`${locale}/${page}.mdx 缺少 frontmatter`)
  return { data: parse(match[1]), body: match[2] }
}

/** 正文中的干支关系写法，逐条复算；返回违例说明 */
export function relationErrors(text) {
  const errors = []
  const stemPair = new RegExp(`([${STEMS}])([${STEMS}])(?:相)?(?:合|五合|干合)`, 'gu')
  for (const [found, a, b] of text.matchAll(stemPair))
    if (!isStemCombine(stem(a), stem(b))) errors.push(`${found}：不是天干五合`)
  const branchPair = new RegExp(
    `(?<![${BRANCHES}])([${BRANCHES}])([${BRANCHES}])(?![${BRANCHES}])(?:相|の|이|가)?\\s?(六合|支合|육합|半合|三合|삼합|相?[冲沖]|충|自?刑|형|자형)`,
    'gu',
  )
  for (const [found, a, b, relation] of text.matchAll(branchPair)) {
    const x = branch(a)
    const y = branch(b)
    const ok = /六合|支合|육합/.test(relation)
      ? isSixCombine(x, y)
      : /半合|三合|삼합/.test(relation)
        ? isTriad(x, y)
        : /[冲沖충]/.test(relation)
          ? isClash(x, y)
          : isPunish(x, y)
    if (!ok) errors.push(`${found}：引擎不认定为「${relation}」`)
  }
  const triad = new RegExp(`(?<![${BRANCHES}])([${BRANCHES}]{3})(?:三合|삼합)`, 'gu')
  for (const [found, group] of text.matchAll(triad)) {
    const [x, y, z] = [...group].map(branch)
    if (!(isTriad(x, y) && isTriad(y, z))) errors.push(`${found}：不是同一组三合`)
  }
  for (const [found, value] of text.matchAll(/[+＋−\-–](\d+)\s*(?:分|点|점|points?)/gu))
    if (!SIGNED_POINTS.has(value)) errors.push(`${found}：引擎没有这个分值`)
  return errors
}

export function checkCompatContent() {
  const errors = []
  const report = []
  for (const locale of COMPAT_LOCALES) {
    const pages = [
      ...(COMPAT_TOOL_BODY_LOCALES.includes(locale) ? ['index'] : []),
      ...COMPAT_SCENARIO_KEYS,
    ]
    if (locale === 'ko' && existsSync(new URL('ko/index.mdx', ROOT)))
      errors.push('ko/index.mdx：ko 工具页正文不改，不应有 index')
    for (const page of pages) {
      const entry = read(locale, page)
      const where = `${locale}/${page}.mdx`
      if (!entry) {
        errors.push(`${where}：缺少`)
        continue
      }
      const { data, body } = entry
      for (const key of ITEM_KEYS)
        if (typeof data.items?.[key] !== 'string' || !data.items[key].trim())
          errors.push(`${where}：缺少分项解释 ${key}`)
      if (page !== 'index') {
        if (data.short !== COMPAT_SCENARIO_TITLES[locale][page])
          errors.push(`${where}：short「${data.short}」与 compat/paths.ts 的导航名不一致`)
        if (!TOOL_ANCHORS[locale].includes(data.tool_anchor))
          errors.push(`${where}：tool_anchor「${data.tool_anchor}」不在允许的锚文本内`)
      }
      const text = [
        data.heading,
        data.lede,
        body,
        ...Object.values(data.items ?? {}),
        ...(data.faq ?? []).flatMap(({ q, a }) => [q, a]),
      ].join('\n')
      for (const error of relationErrors(text)) errors.push(`${where}：${error}`)
      report.push({ locale, page, faq: data.faq?.length ?? 0 })
    }
  }
  return { errors, report }
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]
if (isMain) {
  const { values } = parseArgs({ options: { report: { type: 'string' } } })
  const { errors, report } = checkCompatContent()
  if (values.report) writeFileSync(values.report, JSON.stringify({ errors, report }, null, 2))
  if (errors.length > 0) {
    console.error(`合盘内容校验失败（${errors.length} 处）：\n${errors.join('\n')}`)
    process.exit(1)
  }
  console.log(`合盘内容校验通过：${report.length} 页`)
}
