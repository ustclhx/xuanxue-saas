#!/usr/bin/env -S node --experimental-strip-types
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TemplateConfig } from '@xuanxue/config'
import { createDb } from '@xuanxue/db'
import { readLocalEnv } from '@xuanxue/db/worktree-env'
import templateConfig from '../../../template.config.ts'
import { syncCatalog } from '../src/catalog.ts'
import { createPayPalProvider } from '../src/paypal/index.ts'
import { createStripeProvider } from '../src/stripe/adapter.ts'

// 此 CLI 只允许测试同步，关闭的 provider 不读取凭据、不构建实例。
export function createSyncProviders(
  readEnv: (name: string) => string | undefined = readLocalEnv,
  billing: Pick<TemplateConfig['billing'], 'enabled' | 'providers'> = templateConfig.billing,
) {
  if (readEnv('BILLING_SYNC_MODE') !== 'test')
    throw new Error('BILLING_SYNC_MODE=test is required; live/production sync is forbidden')
  return (billing.enabled ? billing.providers : []).map((provider) => {
    if (provider === 'stripe') {
      const secretKey = readEnv('STRIPE_SECRET_KEY')
      if (!secretKey?.startsWith('sk_test_'))
        throw new Error('Explicit Stripe test credentials are required')
      return createStripeProvider({ secretKey, webhookSecret: '' })
    }
    const clientId = readEnv('PAYPAL_CLIENT_ID')
    const clientSecret = readEnv('PAYPAL_CLIENT_SECRET')
    if (!clientId || !clientSecret)
      throw new Error('Explicit PayPal sandbox credentials are required')
    const tokens = new Map<string, { value: string; expiresAt: number }>()
    return createPayPalProvider({
      environment: 'sandbox',
      clientId,
      clientSecret,
      fetch,
      cache: {
        async get(key) {
          const token = tokens.get(key)
          return token && token.expiresAt > Date.now() ? token.value : null
        },
        async put(key, value, options) {
          tokens.set(key, { value, expiresAt: Date.now() + options.expirationTtl * 1000 })
        },
      },
    })
  })
}

async function sync() {
  const providers = createSyncProviders()
  const url = readLocalEnv('CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE')
  if (!url) throw new Error('Missing local billing database URL')
  const db = createDb({ connectionString: url })
  try {
    console.log(
      `Synced ${await syncCatalog(db, providers)} template example price mappings in test/sandbox mode.`,
    )
  } finally {
    await db.$client.end()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await sync()
}
