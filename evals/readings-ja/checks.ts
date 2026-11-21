import { readFileSync } from 'node:fs'
import type { Check, CheckResult } from '@xuanxue/evals'
import {
  compileGlossary,
  type GlossaryBannedHit,
  scanText,
} from '../../apps/web/scripts/check-locale-glossary.mjs'
import { readingChecks } from '../readings/checks.ts'
import type { ReadingSampleInput } from '../readings/prompts.ts'

/**
 * 日语详批的确定性检查（openspec add-locales-eu-ja design 决策 7、tasks 4.8）：
 * 沿用 readings 套件的全部检查（章节、顺序、年份、数据一致、合规、就医提示、长度、拉丁字母），
 * 另加四项 error 级的日语检查。术语与禁用写法以 apps/web/i18n/glossary/ja.json 为唯一来源，不在这里另列。
 */

export interface JaGlossary {
  readonly banned?: readonly { readonly regex?: string; readonly text?: string }[]
  readonly compliance?: {
    readonly required?: readonly { readonly id: string; readonly phrases: readonly string[] }[]
  }
}

export const JA_GLOSSARY = JSON.parse(
  readFileSync(new URL('../../apps/web/i18n/glossary/ja.json', import.meta.url), 'utf8'),
) as JaGlossary

const compiled = compileGlossary(JA_GLOSSARY)

/** 假名在「假名 + 汉字」中的最低占比：日语正文通常过半，中文混入或整段中文时远低于此 */
export const MIN_KANA_RATIO = 0.3

const KANA = /[ぁ-ゖァ-ヺー]/u
const KANJI = /[㐀-䶿一-鿿豈-﫿]/u

/** 假名占比（不含标点、数字与拉丁字母）；没有假名或汉字时为 0 */
export function kanaRatio(text: string): number {
  let kana = 0
  let kanji = 0
  for (const char of text) {
    if (KANA.test(char)) kana++
    else if (KANJI.test(char)) kanji++
  }
  return kana + kanji === 0 ? 0 : kana / (kana + kanji)
}

/** 简体专用字形：术语表顶层 `banned` 的正则（「簡体字のみの字形」） */
export function simplifiedGlyphs(text: string, glossary: JaGlossary = JA_GLOSSARY): string[] {
  const found = new Set<string>()
  for (const entry of glossary.banned ?? []) {
    if (!entry.regex) continue
    for (const match of text.matchAll(new RegExp(entry.regex, 'gu'))) found.add(match[0])
  }
  return [...found]
}

/**
 * 术语表禁用写法（术语的 banned 与合规禁用表述）。简体字形由 `simplifiedGlyphs` 单独报告，这里不重复。
 * 紫微斗数报告按 `ziwei.chart` 的例外处理（「命盤」是紫微的正式用语，只对四柱推命禁用）。
 */
export function glossaryHits(text: string, kind: string): GlossaryBannedHit[] {
  return scanText(text, compiled, {
    file: `evals/readings-ja/${kind}`,
    term: kind === 'ziwei-full' ? 'ziwei.chart' : null,
  }).filter((hit) => hit.source !== 'banned')
}

/** 术语表 `compliance.required` 中报告声明必须覆盖的两项 */
export const REQUIRED_STATEMENTS = ['reference-only', 'no-prediction'] as const

/**
 * 开头与结尾都有本语言合规声明（被评正文与线上保存的正文一样带声明，见 prepare.ts），
 * 且声明含术语表要求的「参考」与「不预言」表述。
 */
export function complianceStatementIssues(
  text: string,
  glossary: JaGlossary = JA_GLOSSARY,
): string[] {
  const issues: string[] = []
  const lines = text.trim().split('\n')
  const first = lines[0] ?? ''
  const last = lines.at(-1) ?? ''
  if (!first.startsWith('> ')) issues.push('missing opening statement')
  if (!last.startsWith('> ')) issues.push('missing closing statement')
  for (const id of REQUIRED_STATEMENTS) {
    const phrases = glossary.compliance?.required?.find((item) => item.id === id)?.phrases ?? []
    for (const [where, line] of [
      ['opening', first],
      ['closing', last],
    ] as const)
      if (!phrases.some((phrase) => line.includes(phrase))) issues.push(`${where} lacks ${id}`)
  }
  return issues
}

const result = (pass: boolean, detail: unknown): CheckResult => ({
  pass,
  detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
})

const kindOf = (input: unknown) => (input as ReadingSampleInput).kind

export const kanaCheck: Check = {
  id: 'kana',
  run(ctx) {
    const ratio = kanaRatio(ctx.output)
    return result(ratio >= MIN_KANA_RATIO, { ratio: Math.round(ratio * 1000) / 1000 })
  },
}

export const simplifiedGlyphsCheck: Check = {
  id: 'simplifiedGlyphs',
  run(ctx) {
    const glyphs = simplifiedGlyphs(ctx.output)
    return result(glyphs.length === 0, glyphs)
  },
}

export const glossaryCheck: Check = {
  id: 'glossary',
  run(ctx) {
    const hits = glossaryHits(ctx.output, kindOf(ctx.sample.input))
    return result(
      hits.length === 0,
      hits.map((hit) => ({ banned: hit.banned, use: hit.use, excerpt: hit.excerpt })),
    )
  },
}

export const complianceStatementCheck: Check = {
  id: 'complianceStatement',
  run(ctx) {
    const issues = complianceStatementIssues(ctx.output)
    return result(issues.length === 0, issues)
  },
}

export const JA_CHECKS: readonly Check[] = [
  kanaCheck,
  simplifiedGlyphsCheck,
  glossaryCheck,
  complianceStatementCheck,
]

/** readings 套件的全部检查 + 日语检查 */
export const readingJaChecks: readonly Check[] = [...readingChecks, ...JA_CHECKS]
