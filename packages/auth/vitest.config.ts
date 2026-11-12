import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { isPostgresSocketRejection } from '@xuanxue/db/test/postgres-socket-rejection'
import { readTestDbUrls } from '@xuanxue/db/worktree-env'
import { defineConfig } from 'vitest/config'

// 集成测试连接的本地库：环境变量 → .env.worktree → 本机专用测试库 xuanxue_test，
// 不回退到开发库 xuanxue_dev；CI 中未显式提供连接串时跳过集成测试。见 readTestDbUrls。
const HYPERDRIVE_ENV = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE'
const urls = readTestDbUrls('@xuanxue/auth')
const appUrl = urls?.appUrl
const migratorUrl = urls?.migratorUrl

const integration = appUrl && migratorUrl
if (integration) {
  process.env[HYPERDRIVE_ENV] = appUrl
  process.env.MIGRATION_DATABASE_URL = migratorUrl
} else {
  console.warn(`[@xuanxue/auth] 未配置 ${HYPERDRIVE_ENV}，跳过集成测试`)
}

/** 集成测试与 probe 共用的 workerd 环境（test/wrangler.jsonc） */
const workers = () =>
  cloudflareTest({
    wrangler: { configPath: './test/wrangler.jsonc' },
    // 端口 1 上没有服务：连接立即被拒绝
    // audit_log 对 app 只追加（@xuanxue/db 迁移 0009），清理审计行改用 migrator
    miniflare: {
      hyperdrives: {
        HYPERDRIVE_REFUSED: 'postgres://app:app@127.0.0.1:1/db',
        ...(migratorUrl ? { HYPERDRIVE_MIGRATOR: migratorUrl } : {}),
      },
    },
  })

export default defineConfig({
  test: {
    // 未配置数据库时只有空的 unit 项目；配置数据库后仍要求找到测试。
    passWithNoTests: !integration,
    // postgres.js 在 workerd 中连接失败 / 断开时内部未处理的 rejection，见该函数注释
    onUnhandledError: (error) => !isPostgresSocketRejection(error),
    projects: [
      {
        test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      ...(integration
        ? [
            {
              plugins: [workers()],
              test: {
                name: 'integration',
                include: ['test/**/*.test.ts'],
                globalSetup: ['@xuanxue/db/test/global-setup'],
              },
            },
          ]
        : []),
      // 2.4 的 CPU 时间测量（probe/README.md），只在 `pnpm probe:cpu` 时运行
      ...(integration && process.env.AUTH_CPU_PROBE
        ? [
            {
              plugins: [workers()],
              test: {
                name: 'probe',
                include: ['probe/**/*.probe.ts'],
                globalSetup: ['@xuanxue/db/test/global-setup'],
              },
            },
          ]
        : []),
    ],
  },
})
