import type { Check, CheckResult } from '@xuanxue/evals'
import { withDisclaimer } from '../../apps/web/src/features/readings/catalog.ts'
import { createReadingChecks } from '../readings/checks.ts'
import type { ReadingSampleInput } from '../readings/prompts.ts'
import { resolveReading } from './prompts.ts'

/**
 * 东方站英文的确定性检查：`readings` 的全部检查（章节、顺序、逐年年份与干支、合规替换、就医提示、长度）
 * 按本套件的版本分派运行，另加三项英文专属检查（design 决策 7「输出文字检测、术语表禁用词检查」）：
 * - `script`：汉字只作术语注释与逐年标题，占非空白字符 ≤ 2%；不得出现假名、谚文或中文标点。
 * - `wording`：交付正文（加上本语言声明后）包含「传统规则 / 仅供参考与自我反思 / 不预测未来」三类表述；
 *   模型原文不得出现 entertainment、guaranteed、always accurate 等定位词。
 * - `terminology`：八字须使用 Day Master，紫微须使用 Life Palace（提示词规定的英文术语）。
 * 东方站英文术语表（glossary/en-east.json）尚未建立；建立后可把禁用词改为读取术语表。
 */

/** 汉字占非空白字符的上限（标题干支与少量术语注释约 0.5–1%） */
export const MAX_HAN_RATIO = 0.02
/** 连续汉字超过此长度视为整句中文（注释如「庚午」「天乙貴人」不超过 4 字） */
export const MAX_HAN_RUN = 4

const HAN = /\p{Script=Han}/u
const KANA_HANGUL = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
// 中文全角标点（，。、；：「」『』《》）；英文正文不应出现
const CJK_PUNCTUATION = /[、。「-』《》，：；]/u

export function scriptStats(text: string) {
  const chars = [...text.replace(/\s/g, '')]
  const han = chars.filter((char) => HAN.test(char)).length
  const runs = [...text.matchAll(/\p{Script=Han}{2,}/gu)].map((m) => m[0])
  return {
    chars: chars.length,
    han,
    ratio: chars.length ? han / chars.length : 0,
    longRuns: [...new Set(runs.filter((run) => [...run].length > MAX_HAN_RUN))],
    kanaHangul: chars.filter((char) => KANA_HANGUL.test(char)).length,
    cjkPunctuation: chars.filter((char) => CJK_PUNCTUATION.test(char)).length,
  }
}

/** 交付正文必须包含的表述（任一写法即可），与 catalog 的英文声明对应 */
export const REQUIRED_WORDING: Readonly<Record<string, readonly RegExp[]>> = {
  'traditional-rules': [/traditional rules/i, /traditional methods?/i],
  'reference-only': [/for reference and self-reflection/i, /for reference only/i],
  'no-prediction': [/does not predict the future/i, /do(?:es)? not predict the future/i],
}

/** 定位与承诺类禁用词（「娱乐」定位与准确性承诺） */
export const BANNED_WORDING: readonly RegExp[] = [
  /\bentertainment\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\balways accurate\b/i,
  /\b100\s*%\s*accurate\b/i,
]

export function wordingIssues(delivered: string, raw: string) {
  const missing = Object.entries(REQUIRED_WORDING)
    .filter(([, patterns]) => !patterns.some((pattern) => pattern.test(delivered)))
    .map(([id]) => id)
  const banned = BANNED_WORDING.filter((pattern) => pattern.test(raw)).map((p) => p.source)
  return { missing, banned }
}

export const REQUIRED_TERMS: Readonly<Record<string, readonly string[]>> = {
  'bazi-full': ['Day Master'],
  'ziwei-full': ['Life Palace'],
}

const result = (pass: boolean, detail?: unknown): CheckResult =>
  detail === undefined ? { pass } : { pass, detail: JSON.stringify(detail) }

const inputOf = (sample: { input: unknown }) => sample.input as ReadingSampleInput

export const scriptCheck: Check = {
  id: 'script',
  run(ctx) {
    const stats = scriptStats(ctx.output)
    return result(
      stats.ratio <= MAX_HAN_RATIO && stats.kanaHangul === 0 && stats.cjkPunctuation === 0,
      { ...stats, ratio: Math.round(stats.ratio * 10000) / 10000 },
    )
  },
}

/** 连续汉字过长只提示（可能是整句中文，也可能是一串干支注释），由评委的 readability 判断 */
export const hanRunsCheck: Check = {
  id: 'hanRuns',
  severity: 'warn',
  run(ctx) {
    const { longRuns } = scriptStats(ctx.output)
    return result(longRuns.length === 0, longRuns)
  },
}

export const wordingCheck: Check = {
  id: 'wording',
  run(ctx) {
    const { definition } = resolveReading(ctx.prompt.promptVersion, inputOf(ctx.sample))
    const issues = wordingIssues(withDisclaimer(ctx.output, definition), ctx.output)
    return result(issues.missing.length === 0 && issues.banned.length === 0, issues)
  },
}

export const terminologyCheck: Check = {
  id: 'terminology',
  run(ctx) {
    const terms = REQUIRED_TERMS[inputOf(ctx.sample).kind] ?? []
    const missing = terms.filter((term) => !ctx.output.includes(term))
    return result(missing.length === 0, { missing })
  },
}

export const eastEnChecks: readonly Check[] = [
  // `readings` 的 script 检查要求拉丁语言正文零汉字；东方站英文保留干支标题与术语注释，改用下面按比例的同名检查
  ...createReadingChecks(resolveReading).filter((check) => check.id !== 'script'),
  scriptCheck,
  hanRunsCheck,
  wordingCheck,
  terminologyCheck,
]

/** warn 级（提示类）检查：门槛的「硬性检查」不含它们 */
export const EAST_EN_WARN_CHECK_IDS: ReadonlySet<string> = new Set(
  eastEnChecks.filter((check) => check.severity === 'warn').map((check) => check.id),
)
