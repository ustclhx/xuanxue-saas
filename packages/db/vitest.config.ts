import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'
import { resolveLocalTestDatabase } from './test-database.local.ts'

// 集成测试连接的本地库：环境变量 → .env.worktree（必须是隔离库，见 @xuanxue/db/test-database）
// → 本机自动创建的专用测试库 xuanxue_test；不回退到开发库 xuanxue_dev。
// CI 中未显式提供连接串时跳过集成测试，只跑单元测试。见 @xuanxue/db/test-database.local。
const HYPERDRIVE_ENV = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE'
const database = resolveLocalTestDatabase('@xuanxue/db')
const appUrl = database?.appUrl
const migratorUrl = database?.migratorUrl

const integration = appUrl && migratorUrl
if (integration) {
  // wrangler 读取该变量作为 HYPERDRIVE 绑定的 localConnectionString
  process.env[HYPERDRIVE_ENV] = appUrl
  process.env.MIGRATION_DATABASE_URL = migratorUrl
} else {
  console.warn(`[@xuanxue/db] 未配置 ${HYPERDRIVE_ENV}，跳过集成测试`)
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'lint/**/*.test.ts', '*.test.ts'],
          environment: 'node',
        },
      },
      ...(integration
        ? [
            {
              plugins: [
                cloudflareTest({
                  wrangler: { configPath: './test/wrangler.jsonc' },
                  // audit_log 对 app 只追加（迁移 0009），清理审计行改用 migrator
                  miniflare: { hyperdrives: { HYPERDRIVE_MIGRATOR: migratorUrl } },
                }),
              ],
              test: {
                name: 'integration',
                include: ['test/**/*.test.ts'],
                globalSetup: ['./test/global-setup.ts'],
              },
            },
          ]
        : []),
    ],
  },
})
