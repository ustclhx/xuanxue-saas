import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

/**
 * 读取本地连接配置：优先环境变量，其次 Orca worktree 的 .env.worktree（scripts/orca/setup.sh 生成）。
 * 供 drizzle.config.ts 与 vitest.config.ts 使用；都没有时返回 undefined，由调用方决定默认值。
 */
export function readLocalEnv(name: string): string | undefined {
  const fromEnv = process.env[name]
  if (fromEnv) return fromEnv
  const file = new URL('../../.env.worktree', import.meta.url)
  if (!existsSync(file)) return undefined
  const prefix = `${name}=`
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(prefix))
  return line?.slice(prefix.length).trim() || undefined
}

const TEST_DB = 'xuanxue_test'
const PG_CONTAINER = process.env.XUANXUE_PG_CONTAINER ?? 'xuanxue-pg'
const PG_PORT = process.env.XUANXUE_PG_PORT ?? '5433'

/**
 * 集成测试的连接串：环境变量 → .env.worktree → 本机专用测试库 xuanxue_test（不存在时创建）。
 * global-setup 会对目标库跑迁移，所以绝不回退到主 checkout 的开发库 xuanxue_dev，
 * 显式指向它也拒绝（模板 review #78）。CI 中未显式提供时返回 undefined，调用方跳过集成测试；
 * 本机没有 xuanxue-pg 容器时同样跳过。
 */
export function readTestDbUrls(pkg: string): { appUrl: string; migratorUrl: string } | undefined {
  const appUrl = readLocalEnv('CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE')
  const migratorUrl = readLocalEnv('MIGRATION_DATABASE_URL')
  if (appUrl && migratorUrl) {
    for (const url of [appUrl, migratorUrl]) {
      if (new URL(url).pathname === '/xuanxue_dev') {
        throw new Error(`[${pkg}] 集成测试会对目标库跑迁移，不能指向开发库 xuanxue_dev`)
      }
    }
    return { appUrl, migratorUrl }
  }
  if (appUrl || migratorUrl) throw new Error(`[${pkg}] 集成测试需要同时配置 app 与 migrator 连接串`)
  if (process.env.CI) return undefined
  if (!ensureLocalTestDb(pkg)) return undefined
  return {
    appUrl: `postgres://app:app@localhost:${PG_PORT}/${TEST_DB}`,
    migratorUrl: `postgres://migrator:migrator@localhost:${PG_PORT}/${TEST_DB}`,
  }
}

/** 与 scripts/orca/setup.sh 相同：超级用户建库后执行单库授权，可重复执行 */
function ensureLocalTestDb(pkg: string): boolean {
  const psql = (db: string, args: string[], input?: string) =>
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        PG_CONTAINER,
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-qtA',
        '-U',
        'postgres',
        '-d',
        db,
        ...args,
      ],
      { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim()
  try {
    const exists = psql('postgres', [
      '-c',
      `SELECT 1 FROM pg_database WHERE datname = '${TEST_DB}'`,
    ])
    if (exists !== '1') {
      psql('postgres', ['-c', `CREATE DATABASE "${TEST_DB}"`])
      const grants = new URL('../../infra/local/initdb/02-db-grants.sql', import.meta.url)
      psql(TEST_DB, [], readFileSync(grants, 'utf8'))
    }
    return true
  } catch (error) {
    console.warn(
      `[${pkg}] 无法准备本地测试库 ${TEST_DB}，跳过集成测试：${(error as Error).message}`,
    )
    return false
  }
}
