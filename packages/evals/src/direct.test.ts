import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from './cli.ts'
import { WEB_DEV_VARS, withWebDevVars } from './local-env.ts'
import { egressFor, evalTextModelEnv } from './models.ts'
import { runEval } from './runner.ts'
import { GOOD, type TempSuite, tempSuite } from './test-support.ts'

/** DeepSeek 直连出口（gateway 未配置时用 DEEPSEEK_API_KEY）：选择、配置错误、记账与脱敏，全部模拟 fetch */
const SECRET = 'sk-deepseek-direct-test-secret'
const cleanups: (() => void)[] = []
let evidence: string
let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  evidence = mkdtempSync(join(tmpdir(), 'evals-direct-'))
  cleanups.push(() => rmSync(evidence, { recursive: true, force: true }))
  fetchSpy = vi.fn(() => Promise.reject(new Error('network is not allowed in tests')))
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
  for (const cleanup of cleanups.splice(0)) cleanup()
})

const deepseekSuite = (): TempSuite => {
  const created = tempSuite({
    judge: false,
    gen: { provider: 'deepseek' },
    samples: [{ id: 's1', input: { topic: 'tea' } }],
  })
  cleanups.push(created.cleanup)
  return created
}
const completion = () =>
  new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1,
      model: 'gpt-test',
      choices: [{ index: 0, message: { role: 'assistant', content: GOOD }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
const requestOf = (call: unknown[]) => {
  const [input, init] = call as [RequestInfo | URL, RequestInit | undefined]
  const url = input instanceof Request ? input.url : String(input)
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}))
  return { url, headers }
}
const filesText = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
        .join('\n')
    : ''
const capture = () => {
  const lines: string[] = []
  return {
    lines,
    out: { log: (text: string) => lines.push(text), error: (text: string) => lines.push(text) },
  }
}
// 估算上限：输入 (8+30+8+10) 个码点 + 最大输出 100，单价 $1000 / 百万 token
const RESERVATION =
  (8 + 'Write clearly about the topic.'.length + 8 + 'Topic: tea'.length + 100) / 1000

describe('出口选择', () => {
  it('未配置 Gateway 且有 DEEPSEEK_API_KEY 时补 direct；已配置 Gateway 或显式设置时原样保留', () => {
    expect(evalTextModelEnv({ DEEPSEEK_API_KEY: SECRET }).AI_TEXT_EGRESS).toBe('direct')
    expect(
      evalTextModelEnv({ DEEPSEEK_API_KEY: SECRET, AI_GATEWAY_ACCOUNT_ID: 'a', AI_GATEWAY_ID: 'g' })
        .AI_TEXT_EGRESS,
    ).toBeUndefined()
    expect(
      evalTextModelEnv({ DEEPSEEK_API_KEY: SECRET, AI_TEXT_EGRESS: 'gateway' }).AI_TEXT_EGRESS,
    ).toBe('gateway')
    expect(evalTextModelEnv({}).AI_TEXT_EGRESS).toBeUndefined()
    const deepseek = { provider: 'deepseek', providerModelId: 'deepseek-flash' }
    expect(egressFor(deepseek, evalTextModelEnv({ DEEPSEEK_API_KEY: SECRET }))).toBe('direct')
    expect(
      egressFor(deepseek, evalTextModelEnv({ AI_GATEWAY_ACCOUNT_ID: 'a', AI_GATEWAY_ID: 'g' })),
    ).toBe('gateway')
  })

  it('直连：请求发往 DeepSeek 官方端点、不带 cf-aig 头，按实际用量记账，报告与终端不含密钥', async () => {
    const s = deepseekSuite()
    fetchSpy.mockImplementation(async () => completion())
    const { lines, out } = capture()
    const code = await main(
      ['--suite', s.name, '--record', '--budget-usd', '1'],
      { root: s.root, gitCommit: null, env: { EVIDENCE_DIR: evidence, DEEPSEEK_API_KEY: SECRET } },
      out,
    )
    expect(code).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const { url, headers } = requestOf(fetchSpy.mock.calls[0] as unknown[])
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(headers.get('authorization')).toBe(`Bearer ${SECRET}`)
    expect([...headers.keys()].filter((name) => name.startsWith('cf-aig'))).toEqual([])
    const reportFile = readdirSync(evidence, { recursive: true, withFileTypes: true }).find(
      (entry) => entry.name === 'report.json',
    )
    const report = JSON.parse(
      readFileSync(join(reportFile?.parentPath ?? '', reportFile?.name ?? ''), 'utf8'),
    )
    expect(report.egress).toEqual({ generator: 'direct', judge: null })
    expect(report.summary.costUsd).toBeCloseTo(((12 + 8) * 1000) / 1e6)
    expect(lines.join('\n')).toContain('出口：生成 direct')
    for (const text of [filesText(evidence), filesText(join(s.dir, 'recordings')), lines.join()])
      expect(text).not.toContain(SECRET)
  })

  it('已配置 Gateway 时仍走 Gateway，报告记 gateway', async () => {
    const s = deepseekSuite()
    fetchSpy.mockImplementation(async () => completion())
    const result = await runEval(
      { suite: s.name, mode: 'live', budgetUsd: 1 },
      {
        root: s.root,
        gitCommit: null,
        env: {
          EVIDENCE_DIR: evidence,
          DEEPSEEK_API_KEY: SECRET,
          AI_GATEWAY_ACCOUNT_ID: 'acct',
          AI_GATEWAY_ID: 'gw',
        },
      },
    )
    expect(result.exitCode).toBe(0)
    expect(result.report.egress).toEqual({ generator: 'gateway', judge: null })
    expect(requestOf(fetchSpy.mock.calls[0] as unknown[]).url).toMatch(
      /^https:\/\/gateway\.ai\.cloudflare\.com\/v1\/acct\/gw\/deepseek\//,
    )
  })

  it('既无 Gateway 也无 DEEPSEEK_API_KEY：任何调用前以配置错误（2）退出，不写报告', async () => {
    const s = deepseekSuite()
    const { lines, out } = capture()
    const code = await main(
      ['--suite', s.name, '--live', '--budget-usd', '1'],
      { root: s.root, gitCommit: null, env: { EVIDENCE_DIR: evidence } },
      out,
    )
    expect(code).toBe(2)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(lines.join('\n')).toMatch(/no text egress configured.*DEEPSEEK_API_KEY/)
    expect(filesText(evidence)).toBe('')
  })

  it('CI 为真时即使有密钥也拒绝真实调用', async () => {
    const s = deepseekSuite()
    const { out } = capture()
    const code = await main(
      ['--suite', s.name, '--live', '--budget-usd', '1'],
      {
        root: s.root,
        gitCommit: null,
        env: { EVIDENCE_DIR: evidence, DEEPSEEK_API_KEY: SECRET, CI: 'true' },
      },
      out,
    )
    expect(code).toBe(2)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('失败调用的记账', () => {
  const live = (s: TempSuite, env: Record<string, string>) =>
    runEval(
      { suite: s.name, mode: 'live', budgetUsd: 1 },
      { root: s.root, gitCommit: null, env: { EVIDENCE_DIR: evidence, ...env } },
    )

  it('服务商以 HTTP 错误拒绝（回显密钥）时记 0，错误信息脱敏', async () => {
    const s = deepseekSuite()
    fetchSpy.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { message: `Authentication Fails, your api key: ${SECRET}` } }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    )
    const result = await live(s, { DEEPSEEK_API_KEY: SECRET })
    expect(result.report.samples[0]?.status).toBe('generation-error')
    expect(result.report.summary.costUsd).toBe(0)
    expect(result.report.budget.spentUsd).toBe(0)
    expect(filesText(evidence)).not.toContain(SECRET)
  })

  it('模型构造失败（请求未发出）时记 0', async () => {
    const s = deepseekSuite()
    const result = await runEval(
      { suite: s.name, mode: 'live', budgetUsd: 1 },
      {
        root: s.root,
        gitCommit: null,
        env: { EVIDENCE_DIR: evidence },
        modelFor: () => {
          throw new Error('AI Gateway is not configured')
        },
      },
    )
    expect(result.report.samples[0]?.status).toBe('generation-error')
    expect(result.report.summary.costUsd).toBe(0)
    expect(result.report.budget.spentUsd).toBe(0)
  })

  it('网络中断等无法确认是否计费的失败仍按预留额记账', async () => {
    const s = deepseekSuite()
    fetchSpy.mockImplementation(async () => {
      throw new TypeError('socket hang up')
    })
    const result = await live(s, { DEEPSEEK_API_KEY: SECRET })
    expect(result.report.samples[0]?.status).toBe('generation-error')
    expect(result.report.summary.costUsd).toBeCloseTo(RESERVATION)
  })
})

describe('apps/web/.dev.vars 回落', () => {
  it('只补环境中缺失的出口变量，不继承 AI_TEXT_EGRESS，不覆盖已有值，只返回变量名', () => {
    const root = mkdtempSync(join(tmpdir(), 'evals-devvars-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    expect(withWebDevVars(root, { A: '1' })).toEqual({ env: { A: '1' }, fromDevVars: [] })
    mkdirSync(join(root, 'apps/web'), { recursive: true })
    writeFileSync(
      join(root, WEB_DEV_VARS),
      `BETTER_AUTH_SECRET=unrelated\nDEEPSEEK_API_KEY=${SECRET}\nAI_TEXT_EGRESS=gateway\nANTHROPIC_API_KEY=from-file\n`,
    )
    const { env, fromDevVars } = withWebDevVars(root, { ANTHROPIC_API_KEY: 'from-env' })
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'from-env', DEEPSEEK_API_KEY: SECRET })
    expect(fromDevVars).toEqual(['DEEPSEEK_API_KEY'])
  })
})
