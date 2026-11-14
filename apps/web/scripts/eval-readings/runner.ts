import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type ReadingDefinition,
  readingDefinition,
  readingMessages,
} from '../../src/features/readings/catalog.ts'
import { Budget, type EvalOptions, type ModelRef } from './args.ts'
import { checkReading } from './checks.ts'
import { type JudgeScore, judgeMessages, loadRubric, parseJudge } from './judge.ts'
import { renderSummary, type SampleOutcome, summarize } from './stats.ts'

/**
 * 评测运行器（readings-prompt-v4-yearly design 决策 6）：读取套件 → 与线上相同的
 * `readingDefinition` + `recompute` + `readingMessages` 组装消息 → 录制或真实调用 → 确定性检查 /
 * 评委 → 写入 EVIDENCE_DIR。默认离线，只读录制输出，不构造任何模型。
 */

export interface SuiteSample {
  /** 文件名安全的唯一 id，也是录制文件名 */
  readonly id: string
  readonly note?: string
  /** 模拟请求时间（UTC），决定流年窗口起点 */
  readonly requestDate: string
  /** 与前台提交相同的原始输入（虚构） */
  readonly input: unknown
  readonly length?: { readonly min?: number; readonly max?: number }
}

export interface Suite {
  readonly kind: string
  readonly locale: string
  readonly samples: readonly SuiteSample[]
}

export const SUITES_DIR = new URL('./suites/', import.meta.url).pathname

export function loadSuites(
  dir: string,
  filter: Pick<EvalOptions, 'kinds' | 'locales'> & Partial<Pick<EvalOptions, 'samples'>>,
): Suite[] {
  const ids = new Set<string>()
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as Suite)
    .filter(
      (suite) =>
        (filter.kinds.length === 0 || filter.kinds.includes(suite.kind)) &&
        (filter.locales.length === 0 || filter.locales.includes(suite.locale)),
    )
    .map((suite) => {
      for (const sample of suite.samples) {
        if (!/^[a-z0-9-]+$/.test(sample.id) || ids.has(sample.id))
          throw new Error(`Invalid or duplicate sample id ${sample.id}`)
        ids.add(sample.id)
      }
      const wanted = filter.samples ?? []
      if (wanted.length === 0) return suite
      return { ...suite, samples: suite.samples.filter((sample) => wanted.includes(sample.id)) }
    })
    .filter((suite) => suite.samples.length > 0)
}

/** `default` → 代码默认版本；`vN` → `<kind>.vN`；完整版本号只对同一详批生效 */
export function resolveVersion(kind: string, spec: string): string | null {
  if (spec === 'default') return ''
  if (/^v\d+$/.test(spec)) return `${kind}.${spec}`
  return spec.startsWith(`${kind}.`) ? spec : null
}

export interface ChatMessage {
  readonly role: 'system' | 'user'
  readonly content: string
  readonly providerOptions?: Record<string, Record<string, unknown>>
}

export interface Generation {
  readonly text: string
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly durationMs: number
}

/** 真实调用的模型；只在 `--live` 下由 CLI 构造 */
export interface TextGenerator {
  generate(messages: readonly ChatMessage[], maxOutputTokens: number): Promise<Generation>
}

export interface RunnerDeps {
  readonly evidenceDir: string
  readonly suitesDir?: string
  readonly createGenerator?: (model: ModelRef) => TextGenerator
  readonly now?: () => Date
  readonly log?: (message: string) => void
}

interface RecordingMeta {
  readonly inputTokens?: number | null
  readonly outputTokens?: number | null
  readonly durationMs?: number | null
  readonly model?: string
}

const toChat = (messages: ReturnType<typeof readingMessages>): ChatMessage[] =>
  messages.map((m) => ({
    role: m.role,
    content: m.text,
    ...('providerOptions' in m ? { providerOptions: m.providerOptions } : {}),
  }))

/** 1 字符约 1 token 的保守估算（与 @xuanxue/ai 的默认系数一致），只用于预算判断 */
const estimateTokens = (messages: readonly ChatMessage[]) =>
  messages.reduce((sum, m) => sum + m.content.length, 0)

export async function runEval(options: EvalOptions, deps: RunnerDeps) {
  const log = deps.log ?? ((message: string) => console.log(message))
  const root = join(deps.evidenceDir, 'eval-readings')
  const recordings = join(root, 'recordings')
  const stamp = (deps.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-')
  const outDir = join(root, stamp)
  const live = options.live
  const generator = live ? deps.createGenerator?.(live.model) : undefined
  const judgeModel = live?.judge ? deps.createGenerator?.(live.judge) : undefined
  if (live && !generator) throw new Error('Live mode requires a model generator')
  const budget = live ? new Budget(live) : null
  const outcomes: SampleOutcome[] = []
  const notes: string[] = []

  const roles: { role: SampleOutcome['role']; spec: string }[] = [
    { role: 'baseline', spec: options.baseline },
    ...(options.candidate ? [{ role: 'candidate' as const, spec: options.candidate }] : []),
  ]

  for (const suite of loadSuites(deps.suitesDir ?? SUITES_DIR, options)) {
    for (const sample of suite.samples) {
      for (const { role, spec } of roles) {
        const promptVersion = resolveVersion(suite.kind, spec)
        if (promptVersion === null) continue
        const definition: ReadingDefinition | undefined = readingDefinition(
          suite.kind,
          suite.locale,
          { promptVersion },
        )
        const base = {
          sampleId: sample.id,
          kind: suite.kind,
          locale: suite.locale,
          role,
          version: definition?.prompt.version ?? (promptVersion || spec),
        }
        if (!definition) {
          outcomes.push({ ...base, status: 'skipped', skipReason: '该语言未注册此版本' })
          continue
        }
        // 与线上完全相同的组装：服务端复算 + 固定 system 前缀 + 结构化 JSON
        const recomputed = definition.recompute(sample.input, new Date(sample.requestDate))
        const messages = toChat(readingMessages(definition, recomputed))
        const recordingFile = join(recordings, definition.prompt.version, `${sample.id}.md`)
        const metaFile = join(recordings, definition.prompt.version, `${sample.id}.meta.json`)
        let text: string
        let meta: RecordingMeta = {}
        if (!live || !generator || !budget) {
          if (!existsSync(recordingFile)) {
            outcomes.push({ ...base, status: 'skipped', skipReason: '缺少录制' })
            continue
          }
          text = readFileSync(recordingFile, 'utf8')
          if (existsSync(metaFile)) meta = JSON.parse(readFileSync(metaFile, 'utf8'))
        } else {
          if (!budget.allows(estimateTokens(messages), live.maxOutputTokens)) {
            outcomes.push({ ...base, status: 'skipped', skipReason: '达到预算上限，未运行' })
            continue
          }
          const generation = await generator.generate(messages, live.maxOutputTokens)
          budget.record(
            generation.inputTokens ?? estimateTokens(messages),
            generation.outputTokens ?? live.maxOutputTokens,
          )
          text = generation.text
          meta = {
            inputTokens: generation.inputTokens,
            outputTokens: generation.outputTokens,
            durationMs: generation.durationMs,
            model: `${live.model.provider}:${live.model.providerModelId}`,
          }
          if (live.record) {
            mkdirSync(join(recordings, definition.prompt.version), { recursive: true })
            writeFileSync(recordingFile, text)
            writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`)
          }
        }
        const report = checkReading({
          text,
          definition,
          locale: suite.locale,
          result: recomputed.result,
          length: sample.length,
        })
        let judge: JudgeScore | null = null
        let judgeMeta: RecordingMeta | null = null
        if (judgeModel && budget && live) {
          const judgeInput = judgeMessages(loadRubric(suite.locale), recomputed.result, text)
          if (budget.allows(estimateTokens(judgeInput), live.judgeMaxOutputTokens)) {
            const generation = await judgeModel.generate(judgeInput, live.judgeMaxOutputTokens)
            budget.record(
              generation.inputTokens ?? estimateTokens(judgeInput),
              generation.outputTokens ?? live.judgeMaxOutputTokens,
            )
            // 评委用量单独记下，便于按评委模型的单价核算实际费用
            judgeMeta = {
              inputTokens: generation.inputTokens,
              outputTokens: generation.outputTokens,
              durationMs: generation.durationMs,
              ...(live.judge
                ? { model: `${live.judge.provider}:${live.judge.providerModelId}` }
                : {}),
            }
            try {
              judge = parseJudge(generation.text)
            } catch (error) {
              notes.push(`${sample.id}（${definition.prompt.version}）评委输出无法解析：${error}`)
            }
          } else notes.push(`${sample.id}（${definition.prompt.version}）达到预算上限，未评分`)
        }
        const versionDir = join(outDir, definition.prompt.version)
        mkdirSync(versionDir, { recursive: true })
        writeFileSync(join(versionDir, `${sample.id}.md`), text)
        writeFileSync(
          join(versionDir, `${sample.id}.check.json`),
          `${JSON.stringify({ report, judge, meta, judgeMeta }, null, 2)}\n`,
        )
        outcomes.push({
          ...base,
          status: 'checked',
          report,
          outputTokens: meta.outputTokens ?? null,
          durationMs: meta.durationMs ?? null,
          judge,
        })
      }
    }
  }

  if (budget) notes.push(`真实调用 ${budget.calls} 次，估算费用 ${budget.spentUsd.toFixed(4)} USD`)
  const checked = outcomes.filter((o) => o.status === 'checked').length
  if (!live && checked === 0)
    notes.push(
      `没有可用的录制：先用 --live --record 录制到 ${recordings}/<版本>/<样本 id>.md（需批准预算）`,
    )
  mkdirSync(outDir, { recursive: true })
  const meta = {
    mode: live ? 'live' : 'recorded',
    baseline: options.baseline,
    candidate: options.candidate,
  }
  writeFileSync(join(outDir, 'summary.md'), renderSummary(meta, outcomes, notes))
  writeFileSync(
    join(outDir, 'summary.json'),
    `${JSON.stringify({ ...meta, summary: summarize(outcomes), outcomes, notes }, null, 2)}\n`,
  )
  for (const note of notes) log(note)
  log(`评测结果：${join(outDir, 'summary.md')}`)
  return { outDir, outcomes, notes }
}
