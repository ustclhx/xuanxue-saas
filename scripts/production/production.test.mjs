import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { checkRelease } from './check-release.mjs'
import { checkEnvs, parseJsonc } from './check-wrangler-envs.mjs'
import { buildChecks, keyTables, migrationCount, pgEnv, verifyRestore } from './verify-restore.mjs'

const wrangler = (app) =>
  parseJsonc(readFileSync(new URL(`../../apps/${app}/wrangler.jsonc`, import.meta.url), 'utf8'))

test('JSONC parser keeps // inside strings and drops comments and trailing commas', () => {
  assert.deepEqual(parseJsonc('{ "url": "https://a.b", // c\n "x": [1, 2,], /* d */ }'), {
    url: 'https://a.b',
    x: [1, 2],
  })
})

test('real web and jobs configs keep production aligned with staging', () => {
  for (const app of ['web', 'jobs']) assert.deepEqual(checkEnvs(app, wrangler(app)), [])
})

test('production drift, staging reuse and forbidden vars are reported', () => {
  const config = wrangler('web')
  const production = config.env.production
  production.kv_namespaces = []
  production.hyperdrive[0].id = config.env.staging.hyperdrive[0].id
  production.queues.producers[0].queue = 'email-staging'
  production.vars.PAYMENT_MODE = 'live'
  const problems = checkEnvs('web', config)
  assert.ok(problems.includes('web: production is missing binding kv:CACHE'))
  assert.ok(problems.some((line) => line.includes('reuses staging resource id')))
  assert.ok(problems.includes('web: production references staging value email-staging'))
  assert.ok(problems.includes('web: production must not set PAYMENT_MODE'))
})

test('production rejects template resources and wrong domain bindings', () => {
  const config = wrangler('web')
  const production = config.env.production
  production.name = 'saas-web-production'
  production.workers_dev = true
  production.r2_buckets[0].bucket_name = 'saas-files-production'
  production.queues.producers[0].queue = 'saas-email-production'
  production.vars.APP_URL = 'https://app.ezarouter.cc'
  production.vars.R2_FILES_BUCKET = 'saas-files-production'
  production.routes = [{ pattern: 'app.ezarouter.cc', custom_domain: true }]
  production.ratelimits[0].namespace_id = config.env.staging.ratelimits[0].namespace_id
  const problems = checkEnvs('web', config)
  for (const expected of [
    'unexpected production Worker name',
    'production workers.dev and preview URLs must be disabled',
    'unexpected production R2 bucket',
    'unexpected production queue for EMAIL_QUEUE',
    'production APP_URL must be the western origin',
    'production R2_FILES_BUCKET must match the FILES bucket',
    'production routes must bind both production custom domains',
    'production reuses staging ratelimit namespace RL_AUTH',
  ])
    assert.ok(
      problems.some((line) => line.includes(expected)),
      expected,
    )
})

test('release workflow builds with both origins and verifies both sites independently', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/deploy-production.yml', import.meta.url),
    'utf8',
  )
  assert.match(workflow, /EAST_URL: https:\/\/ganjiday\.com/)
  assert.match(workflow, /WEST_URL: https:\/\/arcanumber\.com/)
  assert.doesNotMatch(workflow, /ezarouter/)
  const build = workflow.split('- name: Build web\n')[1].split('\n      - name:')[0]
  assert.match(build, /EAST_URL: \$\{\{ env\.EAST_URL }}/)
  assert.match(build, /WEST_URL: \$\{\{ env\.WEST_URL }}/)
  assert.match(build, /APP_URL: \$\{\{ env\.WEST_URL }}/)
  for (const site of ['EAST', 'WEST']) {
    assert.ok(workflow.includes(`wait-healthy.mjs "$${site}_URL/api/health" "$DEPLOY_SHA"`))
    assert.ok(workflow.includes(`PRODUCTION_URL: \u0024{{ env.${site}_URL }}`))
  }
  assert.ok(workflow.includes('--project production --output test-results/east'))
  assert.ok(workflow.includes('--project production --output test-results/west'))
})

const sha = 'a'.repeat(40)

function run(overrides = {}) {
  const lines = []
  const deps = {
    isOnMain: async () => true,
    stagingRuns: async () => [{ head_sha: sha, conclusion: 'success' }],
    write: (line) => lines.push(line),
    ...overrides,
  }
  const target = 'sha' in overrides ? overrides.sha : sha
  return checkRelease(target, deps).then((code) => ({ code, lines }))
}

test('accepts a main commit with a successful staging deployment', async () => {
  const { code, lines } = await run()
  assert.equal(code, 0)
  assert.match(lines[0], /deployed to staging/)
})

test('rejects a commit that is not on main before querying staging runs', async () => {
  let queried = false
  const { code, lines } = await run({
    isOnMain: async () => false,
    stagingRuns: async () => {
      queried = true
      return []
    },
  })
  assert.equal(code, 1)
  assert.equal(queried, false)
  assert.match(lines[0], /not on main/)
})

test('rejects a commit without a successful staging deployment of the same SHA', async () => {
  const other = 'b'.repeat(40)
  for (const runs of [
    [],
    [{ head_sha: sha, conclusion: 'failure' }],
    [{ head_sha: other, conclusion: 'success' }],
  ]) {
    const { code, lines } = await run({ stagingRuns: async () => runs })
    assert.equal(code, 1)
    assert.match(lines[0], /no successful Deploy staging run/)
  }
})

test('rejects abbreviated or malformed SHAs', async () => {
  for (const value of [undefined, '', 'abc1234', 'z'.repeat(40)]) {
    const { code } = await run({ sha: value })
    assert.equal(code, 1)
  }
})

test('restore checks compare migrations with the journal and add role checks only on request', () => {
  assert.equal(migrationCount(JSON.stringify({ entries: [{}, {}, {}] })), 3)
  const base = buildChecks({ expectedMigrations: 16 })
  assert.deepEqual(
    base.map((check) => check.name),
    ['pg17', 'migrations', 'business_tables', 'constraints', 'credits_balance'],
  )
  assert.match(base[1].sql, /count\(\*\) = 16 FROM drizzle\.__drizzle_migrations/)
  assert.deepEqual(
    buildChecks({ expectedMigrations: 16, roles: true })
      .slice(-2)
      .map((check) => check.name),
    ['roles', 'role_permissions'],
  )
})

test('restore connection is split into PG env vars', () => {
  assert.deepEqual(pgEnv('postgresql://ro%40x:p%2Fw@db.example:6543/saas?sslmode=require'), {
    PGHOST: 'db.example',
    PGPORT: '6543',
    PGUSER: 'ro@x',
    PGPASSWORD: 'p/w',
    PGDATABASE: 'saas',
    PGSSLMODE: 'require',
  })
})

test('restore verification fails when any check is false and never prints credentials', () => {
  const lines = []
  const code = verifyRestore({
    url: 'postgresql://readonly:secret-pw@db.example/saas',
    write: (line) => lines.push(line),
    run: (sql) => {
      if (sql.startsWith('SELECT count(*) FROM public')) return { ok: true, value: '7' }
      if (sql.includes('credit_ledger')) return { ok: true, value: 'f' }
      return { ok: true, value: 't' }
    },
  })
  assert.equal(code, 1)
  assert.ok(lines.includes('{"check":"credits_balance","ok":false}'))
  assert.equal(lines.filter((line) => line.includes('"rows":7')).length, keyTables.length)
  assert.ok(lines.every((line) => !line.includes('secret-pw') && !line.includes('db.example')))
})
