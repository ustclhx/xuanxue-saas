import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { activationDatabaseUrl } from './activate-credit-packs.ts'

const key = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE'
const url = 'postgresql://offline:private-password@localhost:1/xuanxue_wt_confirm'

test('activation requires an explicitly injected PostgreSQL URL and matching database confirmation', () => {
  assert.throws(() => activationDatabaseUrl({}), /Explicit billing database URL/)
  assert.throws(() => activationDatabaseUrl({ [key]: 'not-a-url' }), /Invalid billing database URL/)
  assert.throws(() => activationDatabaseUrl({ [key]: 'https://localhost/db' }), /PostgreSQL/)
  for (const confirmation of [undefined, '', 'another_database']) {
    assert.throws(
      () => activationDatabaseUrl({ [key]: url, BILLING_ACTIVATE_CONFIRM: confirmation }),
      /BILLING_ACTIVATE_CONFIRM/,
    )
  }
  assert.equal(
    activationDatabaseUrl({ [key]: url, BILLING_ACTIVATE_CONFIRM: 'xuanxue_wt_confirm' }),
    url,
  )
})

test('CLI rejects a mismatched confirmation before connecting and never prints the URL or credentials', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', new URL('./activate-credit-packs.ts', import.meta.url).pathname],
    {
      env: { ...process.env, [key]: url, BILLING_ACTIVATE_CONFIRM: 'wrong' },
      encoding: 'utf8',
      timeout: 10_000,
    },
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BILLING_ACTIVATE_CONFIRM must match the target database name/)
  assert.equal(result.stdout, '')
  assert.doesNotMatch(result.stderr, /postgresql:|private-password|offline@/)
})
