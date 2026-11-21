import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { TEXT_ENV_KEYS } from './errors.ts'

/** 站点本地 Wrangler 读取的密钥文件（gitignore；Orca worktree 经 .worktreeinclude 复制） */
export const WEB_DEV_VARS = 'apps/web/.dev.vars'

// 出口选择不从 .dev.vars 继承：由命令行按「有无 Gateway、有无 DeepSeek 密钥」判断（models.ts evalTextModelEnv），
// 避免环境中已配置 Gateway 时被站点本地的 AI_TEXT_EGRESS 改走直连
const DEV_VARS_KEYS = TEXT_ENV_KEYS.filter((key) => key !== 'AI_TEXT_EGRESS')

export interface LocalEnv {
  readonly env: Readonly<Record<string, string | undefined>>
  /** 取自 apps/web/.dev.vars 的变量名（不含值），供终端说明密钥来源 */
  readonly fromDevVars: readonly string[]
}

/**
 * 命令行的本地密钥来源，优先级从高到低：进程环境、根 `.env.local`（入口已用 process.loadEnvFile 并入进程环境）、
 * `apps/web/.dev.vars`。最后一项与 packages/db/test-database.ts 回落读取同一文件的做法一致，
 * 只取文本模型出口变量，且不覆盖已有值；读取失败按不存在处理，任何值都不输出。
 */
export function withWebDevVars(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
): LocalEnv {
  const path = join(root, WEB_DEV_VARS)
  if (!existsSync(path)) return { env, fromDevVars: [] }
  let values: Record<string, string | undefined>
  try {
    values = parseEnv(readFileSync(path, 'utf8'))
  } catch {
    return { env, fromDevVars: [] }
  }
  const added: Record<string, string> = {}
  for (const key of DEV_VARS_KEYS) {
    const value = values[key]?.trim()
    if (value && !env[key]?.trim()) added[key] = value
  }
  const fromDevVars = Object.keys(added)
  return fromDevVars.length ? { env: { ...env, ...added }, fromDevVars } : { env, fromDevVars }
}
