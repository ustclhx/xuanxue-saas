import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolveTestDatabase, type TestDatabase } from './test-database.ts'

/**
 * 项目扩展：db、auth、jobs、web 的集成测试连接串。
 * 先按模板的 resolveTestDatabase 解析环境变量与 .env.worktree（显式配置时必须是隔离库）；
 * 都未配置时，本机改用自动创建的专用测试库 xuanxue_test（属于模板认可的 `<项目>_test` 隔离库），
 * 使主 checkout 无需 .env.worktree 也能运行 pnpm test，且绝不触碰开发库 xuanxue_dev（#140）。
 * 不用 scripts/orca/setup.sh 的提示做法：它会在主 checkout 写入 .env.worktree，dev 服务随之改连 wt 库。
 * CI 中未显式提供时返回 undefined，调用方跳过集成测试；本机没有 xuanxue-pg 容器时同样跳过。
 */
const TEST_DB = 'xuanxue_test'
// 与 scripts/orca/lib.sh 相同，只在本机覆盖容器名与端口时设置（CI 不走这条路径，无需经 turbo 传入）
const PG_CONTAINER = process.env.XUANXUE_PG_CONTAINER ?? 'xuanxue-pg'
const PG_PORT = process.env.XUANXUE_PG_PORT ?? '5433'

export function resolveLocalTestDatabase(label: string): TestDatabase | undefined {
  const configured = resolveTestDatabase(label)
  if (configured) return configured
  if (process.env.CI) return undefined
  if (!ensureLocalTestDb(label)) return undefined
  return {
    appUrl: `postgres://app:app@localhost:${PG_PORT}/${TEST_DB}`,
    migratorUrl: `postgres://migrator:migrator@localhost:${PG_PORT}/${TEST_DB}`,
  }
}

/** 与 scripts/orca/setup.sh 相同：超级用户建库后执行单库授权，可重复执行 */
function ensureLocalTestDb(label: string): boolean {
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
      `[${label}] 无法准备本地测试库 ${TEST_DB}，跳过集成测试：${(error as Error).message}`,
    )
    return false
  }
}
