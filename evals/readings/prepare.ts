import type { PreparedOutput, PrepareOutput } from '@xuanxue/evals'
import {
  deliveredReadingText,
  guardApplies,
  readingGuardYears,
} from '../../apps/web/src/features/readings/guard.ts'
import { toTraditional } from '../../apps/web/src/features/readings/hant.ts'
import { type ReadingSampleInput, resolveReading } from './prompts.ts'

/**
 * 被评正文 = 线上保存的正文（readings-prompt-v4-yearly design 2026-11-14 决策记录）：
 * 与 finalizeReading 共用 `deliveredReadingText`——先做繁中字形补正（所有版本），再做 v4 兜底
 * （简中繁体字、年份干支 / 个人年数按数据改正）。v1–v3 的兜底不生效，只做字形补正。
 *
 * 只用样本输入：窗口起点取样本固定请求时间的 UTC 年（线上取报告创建时的 UTC 年），
 * 复算数据由样本输入按版本数据档得出；不读当前时间、不访问网络。
 * 合规整段替换与就医提示补写不在此做：它们会掩盖确定性检查要发现的问题，检查仍针对兜底后的正文。
 */

/** 转换逻辑或 guard.ts 的行为一变就改版本：旧评委录制随之判为过期 */
export const PREPARE_VERSION = 'guard.v4'

export function prepareReading(
  rawOutput: string,
  promptVersion: string,
  input: ReadingSampleInput,
): PreparedOutput {
  const { version, recomputed } = resolveReading(promptVersion, input)
  const requestYear = new Date(input.requestDate).getUTCFullYear()
  const years = guardApplies(version)
    ? readingGuardYears(input.kind, requestYear, recomputed.input)
    : []
  // deliveredReadingText 的报告不含繁中字形补正的字数；toTraditional 逐字替换，按码点比对计数
  const raw = [...rawOutput]
  const hant = [...toTraditional(rawOutput, input.locale)]
  const hantGlyphs = raw.filter((char, i) => char !== hant[i]).length
  const { text, report } = deliveredReadingText(rawOutput, {
    locale: input.locale,
    promptVersion: version,
    years,
  })
  return {
    output: text,
    annotations: {
      promptVersion: version,
      requestYear,
      /** zh-Hant：简体字换成繁体的个数（线上 generate.ts 原有的字形补正） */
      hantGlyphs,
      /** zh-Hans：繁体字换成简体的个数（v4 兜底） */
      glyphs: report.glyphs,
      ganzhi: report.ganzhi,
      personalYear: report.personalYear,
      unresolved: report.unresolved,
    },
  }
}

export const prepareOutput: PrepareOutput = {
  version: PREPARE_VERSION,
  run: ({ rawOutput, sample, prompt }) =>
    prepareReading(rawOutput, prompt.promptVersion, sample.input as unknown as ReadingSampleInput),
}
