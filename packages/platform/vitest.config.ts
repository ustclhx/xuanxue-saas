import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            remoteBindings: false,
            wrangler: { configPath: './test/wrangler.jsonc' },
          }),
        ],
        test: { name: 'cloudflare', include: ['test/cloudflare.test.ts'] },
      },
    ],
  },
})
