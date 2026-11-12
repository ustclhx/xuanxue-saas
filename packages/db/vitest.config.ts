import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'
import { readTestDbUrls } from './worktree-env.ts'

// 集成测试连接的本地库：环境变量 → .env.worktree → 本机专用测试库 xuanxue_test，
// 不回退到开发库 xuanxue_dev；CI 中未显式提供连接串时跳过集成测试。见 readTestDbUrls。
const HYPERDRIVE_ENV = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE'
const urls = readTestDbUrls('@xuanxue/db')
const appUrl = urls?.appUrl
const migratorUrl = urls?.migratorUrl

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
          include: ['src/**/*.test.ts', 'lint/**/*.test.ts'],
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
