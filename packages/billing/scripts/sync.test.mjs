import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSyncProviders } from './sync.ts'

test('configured Stripe sync succeeds without reading disabled PayPal credentials', () => {
  const env = { BILLING_SYNC_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_offline' }
  const providers = createSyncProviders(
    (name) => {
      assert.ok(name in env, `Unexpected credential read: ${name}`)
      return env[name]
    },
    { enabled: true, providers: ['stripe'] },
  )
  assert.deepEqual(
    providers.map((provider) => provider.id),
    ['stripe'],
  )
})

test('PayPal-only sync requires sandbox credentials and does not read Stripe credentials', () => {
  const billing = { enabled: true, providers: ['paypal'] }
  const env = {
    BILLING_SYNC_MODE: 'test',
    PAYPAL_CLIENT_ID: 'offline-client',
    PAYPAL_CLIENT_SECRET: 'offline-secret',
  }
  assert.deepEqual(
    createSyncProviders((name) => {
      assert.ok(name in env, `Unexpected credential read: ${name}`)
      return env[name]
    }, billing).map((provider) => provider.id),
    ['paypal'],
  )
  assert.throws(
    () =>
      createSyncProviders(
        (name) => (name === 'PAYPAL_CLIENT_SECRET' ? undefined : env[name]),
        billing,
      ),
    /PayPal sandbox credentials are required/,
  )
})

test('sync rejects non-test modes and live or missing Stripe credentials', () => {
  for (const mode of [undefined, 'live', 'production']) {
    assert.throws(() => createSyncProviders(() => mode), /BILLING_SYNC_MODE=test is required/)
  }
  for (const key of [undefined, 'sk_live_offline']) {
    assert.throws(
      () =>
        createSyncProviders((name) => (name === 'BILLING_SYNC_MODE' ? 'test' : key), {
          enabled: true,
          providers: ['stripe'],
        }),
      /Stripe test credentials are required/,
    )
  }
})

test('live Stripe sync requires live credentials only to apply, a confirmed target database, and defaults to dry run', async () => {
  const { liveSyncConfig } = await import('./sync-stripe-live.ts')
  const base = {
    STRIPE_SECRET_KEY: 'rk_live_offline',
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: 'postgres://app@db.example/xuanxue',
    BILLING_SYNC_DATABASE_CONFIRM: 'xuanxue',
  }
  assert.equal(liveSyncConfig(base).apply, false)
  assert.equal(liveSyncConfig({ ...base, BILLING_SYNC_CONFIRM: 'stripe-live' }).apply, true)
  // 演练不调用 Stripe，不需要也不校验密钥
  assert.deepEqual(liveSyncConfig({ ...base, STRIPE_SECRET_KEY: undefined }), {
    apply: false,
    connectionString: base.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE,
  })
  for (const key of [undefined, 'sk_test_offline'])
    assert.throws(
      () =>
        liveSyncConfig({ ...base, STRIPE_SECRET_KEY: key, BILLING_SYNC_CONFIRM: 'stripe-live' }),
      /Stripe live credentials are required/,
    )
  assert.throws(
    () => liveSyncConfig({ ...base, BILLING_SYNC_DATABASE_CONFIRM: 'other' }),
    /must match the target database name/,
  )
})
