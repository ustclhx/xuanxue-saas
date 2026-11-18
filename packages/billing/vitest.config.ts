import { resolveTestDatabase } from '@xuanxue/db/test-database'
import { defineConfig } from 'vitest/config'

// 未配置数据库时只跑离线项目；配置了则必须是同一个隔离库（@xuanxue/db/test-database）。
const database = resolveTestDatabase('@xuanxue/billing')
const integration = Boolean(database)
if (database) {
  process.env.BILLING_TEST_DATABASE_URL = database.appUrl
  process.env.MIGRATION_DATABASE_URL = database.migratorUrl
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'offline',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/pipeline.test.ts', 'src/**/*.postgres.test.ts'],
        },
      },
      ...(integration
        ? [
            {
              test: {
                name: 'postgres',
                // Maintenance jobs scan all workspaces; serialize fixtures in the shared isolated database.
                fileParallelism: false,
                environment: 'node',
                include: ['src/pipeline.test.ts', 'src/**/*.postgres.test.ts'],
                globalSetup: ['@xuanxue/db/test/global-setup'],
              },
            },
          ]
        : []),
    ],
  },
})
