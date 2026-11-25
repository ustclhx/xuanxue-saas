import { defineConfig } from '@playwright/test'
import base from './playwright.config.ts'

if (process.env.STAGING_URL || process.env.E2E_REAL_TURNSTILE === '1' || process.env.CLOUDFLARE_ENV)
  throw new Error('Smoke e2e only supports the isolated local server and Turnstile stub')

export default defineConfig({
  ...base,
  // split-site-accounts 4.1：两站账户隔离的双 Host 流程同样只依赖本地服务与隔离库，随冒烟进入 CI；
  // 语言偏好用例（东方站应用区语言回退、页头语言菜单）也只依赖本地服务，一并进入。
  testMatch: ['smoke.spec.ts', 'split-site-accounts.spec.ts', 'i18n-preference.spec.ts'],
  testIgnore: '**/staging/**',
  globalSetup: './e2e/smoke-setup.ts',
  timeout: 60_000,
  // 含 split-site-accounts 双 Host 流程（本地约 25–60 秒），总时限相应放宽
  globalTimeout: 300_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { ...base.use, trace: 'off', video: 'off', screenshot: 'off', serviceWorkers: 'block' },
  webServer: {
    ...(Array.isArray(base.webServer) ? base.webServer[0] : base.webServer),
    command: 'pnpm exec vite dev --config e2e/smoke.vite.ts > /tmp/ci-e2e-smoke.log 2>&1',
    env: {
      ...(Array.isArray(base.webServer) ? base.webServer[0]?.env : base.webServer?.env),
      WRANGLER_SEND_METRICS: 'false',
      // 与 production 一致：不开启组件预览页，smoke.spec 断言 /dev/ui 返回 404
      UI_PREVIEW: 'false',
    },
    reuseExistingServer: false,
  },
})
