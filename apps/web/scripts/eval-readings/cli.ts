import { isAbsolute, join } from 'node:path'
import { EvalUsageError, parseArgs, USAGE } from './args.ts'
import { runEval } from './runner.ts'

/**
 * `pnpm eval:readings` 入口（不进入 `pnpm test`）。证据写入 EVIDENCE_DIR，未设置时为仓库根目录
 * 已忽略的 `test-results/evidence/`（AGENTS.md「验收/自测证据」）。
 */

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname

function evidenceDir(): string {
  const value = process.env.EVIDENCE_DIR
  if (!value) return join(REPO_ROOT, 'test-results/evidence')
  return isAbsolute(value) ? value : join(process.cwd(), value)
}

async function main() {
  let options: ReturnType<typeof parseArgs>
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    if (error instanceof EvalUsageError) {
      console.error(`${error.message}\n\n${USAGE}`)
      process.exit(2)
    }
    throw error
  }
  if (options.help) {
    console.log(USAGE)
    return
  }
  // 只有 --live 才加载模型工厂与密钥；离线模式不构造任何模型
  const live = options.live ? await import('./live.ts') : null
  const env = live?.loadTextEnv()
  await runEval(options, {
    evidenceDir: evidenceDir(),
    ...(live && env ? { createGenerator: (ref) => live.createLiveGenerator(ref, env) } : {}),
  })
}

await main()
