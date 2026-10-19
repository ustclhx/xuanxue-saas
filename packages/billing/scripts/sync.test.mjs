import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSyncProviders } from './sync.ts'

test('configured Stripe sync succeeds without reading disabled PayPal credentials', () => {
  const env = { BILLING_SYNC_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_offline' }
  const providers = createSyncProviders((name) => {
    assert.ok(name in env, `Unexpected credential read: ${name}`)
    return env[name]
  })
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
      () => createSyncProviders((name) => (name === 'BILLING_SYNC_MODE' ? 'test' : key)),
      /Stripe test credentials are required/,
    )
  }
})
