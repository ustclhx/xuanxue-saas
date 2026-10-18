import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { checkWorkspace, importsOf } from './check-deps.mjs'

const emptyRules = () => ({ compositionEntries: [], targetFixtures: {} })

function workspace(t, files, rules = emptyRules()) {
  const root = mkdtempSync(join(tmpdir(), 'check-deps-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const [file, text] of Object.entries(files)) {
    const path = join(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, typeof text === 'string' ? text : JSON.stringify(text))
  }
  return () => checkWorkspace(root, rules).violations
}

const manifest = (name, dependencies = {}) => ({ name, dependencies })

test('AST covers import/export/require/type and dynamic syntax without matching comments or strings', () => {
  const source = [
    "// import 'cloudflare:fake'",
    'const example = "require(\'cloudflare:fake\')"',
    "import type { Env } from 'cloudflare:workers'",
    "import 'cloudflare:workers'",
    "export { env } from 'cloudflare:workers'",
    "export * from 'cloudflare:workers'",
    "import /* comment */ ( /* comment */ 'cloudflare:workers', { with: { type: 'json' } })",
    'import(`cloudflare:workers`)',
    "require /* comment */ ('cloudflare:workers')",
    "import workers = require('cloudflare:workers')",
    "type Step = import('cloudflare:workers').WorkflowStep",
    "import('cloudflare:' + 'workers')",
    "import('cloudflare\\x3aworkers')",
  ].join('\n')
  const imports = importsOf(source)
  assert.equal(imports.length, 11)
  assert.ok(imports.every(({ specifier }) => specifier === 'cloudflare:workers'))
  assert.equal(imports[0].line, 3)
})

test('apps routes/features and packages reject Cloudflare imports, even outside src', (t) => {
  const check = workspace(t, {
    'apps/web/package.json': manifest('@xuanxue/web'),
    'apps/web/src/routes/api.ts': "export * from 'cloudflare:workers'",
    'apps/web/src/features/auth.ts': "import /* comment */ ('cloudflare:workflows')",
    'apps/web/test/unregistered.test.ts': "import 'cloudflare:test'",
    'packages/auth/package.json': manifest('@xuanxue/auth'),
    'packages/auth/src/auth.ts': "require('cloudflare:workers')",
    'packages/auth/probe/new.ts': "import 'cloudflare:workers'",
  })
  const violations = check()
  assert.equal(violations.length, 5)
  for (const file of [
    'routes/api.ts',
    'features/auth.ts',
    'unregistered.test.ts',
    'src/auth.ts',
    'probe/new.ts',
  ]) {
    assert.ok(violations.some((message) => message.includes(`${file}:1`)))
  }
})

test('only platform Cloudflare adapters, exact composition entries and exact target fixtures are exempt', (t) => {
  const rules = emptyRules()
  rules.compositionEntries = ['apps/web/src/server.ts']
  rules.targetFixtures = {
    'packages/platform/test/cloudflare.test.ts': ['cloudflare:test', 'cloudflare:workers'],
  }
  const check = workspace(
    t,
    {
      'apps/web/package.json': manifest('@xuanxue/web'),
      'apps/web/src/server.ts': "import 'cloudflare:workers'",
      'packages/platform/package.json': manifest('@xuanxue/platform'),
      'packages/platform/src/cloudflare/index.ts':
        "import 'cloudflare:workers'; import 'cloudflare:workflows'",
      'packages/platform/test/cloudflare.test.ts':
        "import 'cloudflare:test'; import type { WorkflowStep } from 'cloudflare:workers'",
      'packages/platform/src/node/index.ts': "import 'cloudflare:workers'",
      'packages/platform/src/index.ts': "export * from 'cloudflare:workers'",
      'packages/platform/src/cloudflare/test.ts': "import 'cloudflare:test'",
      'apps/web/src/server.node.ts': "import 'cloudflare:workers'",
      'apps/web/src/server-helper.ts': "import 'cloudflare:workers'",
    },
    rules,
  )
  assert.equal(check().length, 5)
})

test('former transition entries cannot exempt business imports', (t) => {
  const file = 'apps/web/src/routes/old.ts'
  const rules = { ...emptyRules(), transition: { [file]: { 'cloudflare:workers': 1 } } }
  const check = workspace(
    t,
    {
      'apps/web/package.json': manifest('@xuanxue/web'),
      [file]: "import 'cloudflare:workers'",
    },
    rules,
  )
  assert.equal(check().length, 1)
  assert.match(check()[0], /仅允许平台 Cloudflare 适配器/)
})

test('platform depends only on shared/config/db; config/db cannot reverse that direction; business packages may depend on each other', (t) => {
  const check = workspace(t, {
    'packages/platform/package.json': manifest('@xuanxue/platform', {
      '@xuanxue/shared': '*',
      '@xuanxue/config': '*',
      '@xuanxue/db': '*',
    }),
    'packages/platform/src/index.ts': "import '@xuanxue/auth'",
    'packages/config/package.json': manifest('@xuanxue/config', { '@xuanxue/platform': '*' }),
    'packages/db/package.json': manifest('@xuanxue/db'),
    'packages/db/src/client.ts': "import '@xuanxue/platform'",
    'packages/ai/package.json': manifest('@xuanxue/ai', {
      '@xuanxue/credits': '*',
      '@xuanxue/platform': '*',
    }),
    'packages/credits/package.json': manifest('@xuanxue/credits', { '@xuanxue/billing': '*' }),
  })
  assert.equal(check().length, 3)
})

test('target adapters are restricted for named and relative imports, with exact target entries and fixtures allowed', (t) => {
  const rules = emptyRules()
  rules.compositionEntries = ['apps/web/src/server.ts']
  rules.targetFixtures = { 'apps/web/test/cloudflare.test.ts': ['cloudflare:workers'] }
  rules.targetAdapterFixtures = {
    'packages/platform/test/cloudflare.test.ts': ['cloudflare'],
    'packages/platform/test/node.test.ts': ['node'],
  }
  const check = workspace(
    t,
    {
      'apps/web/package.json': manifest('@xuanxue/web'),
      'apps/web/src/server.ts': "import '@xuanxue/platform/cloudflare'",
      'apps/web/src/routes/neutral.ts': "import '@xuanxue/platform'",
      'apps/web/src/routes/adapter.ts':
        "import '@xuanxue/platform/cloudflare'; import '@xuanxue/platform/node'; import '../../../../packages/platform/src/cloudflare/index.ts'",
      'apps/web/test/cloudflare.test.ts': "import '@xuanxue/platform/cloudflare'",
      'apps/web/test/unknown.test.ts': "import '@xuanxue/platform/cloudflare'",
      'apps/web/src/server.node.ts': "import '@xuanxue/platform/node'",
      'packages/platform/package.json': manifest('@xuanxue/platform'),
      'packages/platform/src/cloudflare/index.ts': "export * from './runtime'",
      'packages/platform/src/cloudflare/runtime.ts': "import '@xuanxue/platform/cloudflare'",
      'packages/platform/src/node/index.ts': "import '@xuanxue/platform/node'",
      'packages/platform/src/index.ts':
        "export * from './cloudflare/index'; export * from './node/index'",
      'packages/platform/test/cloudflare.test.ts': "import '../src/cloudflare/index'",
      'packages/platform/test/node.test.ts': "import '../src/node/index'",
    },
    rules,
  )
  const violations = check()
  assert.equal(violations.length, 7)
  assert.ok(violations.every((message) => message.includes('业务仅可依赖 platform 中立入口')))
})

test('relative cross-package imports enforce foundation layers and packages cannot reference apps', (t) => {
  const check = workspace(t, {
    'apps/web/package.json': manifest('@xuanxue/web'),
    'apps/web/src/index.ts': '',
    'packages/platform/package.json': manifest('@xuanxue/platform'),
    'packages/platform/src/index.ts': "import '../../db/src/client'",
    'packages/config/package.json': manifest('@xuanxue/config'),
    'packages/config/src/index.ts': "import '../../platform/src/index.ts'",
    'packages/db/package.json': manifest('@xuanxue/db'),
    'packages/db/src/client.ts':
      "import '../../platform/src/index.ts'; import '../../config/src/index'",
    'packages/ai/package.json': manifest('@xuanxue/ai'),
    'packages/ai/src/index.ts':
      "import '../../platform/src/index.ts'; import '../../../apps/web/src/index'",
  })
  const violations = check()
  assert.equal(violations.length, 3)
  assert.ok(violations.some((message) => message.includes('@xuanxue/config → @xuanxue/platform')))
  assert.ok(violations.some((message) => message.includes('@xuanxue/db → @xuanxue/platform')))
  assert.ok(violations.some((message) => message.includes('packages 不得引用 apps')))
})

test('configured pure packages reject business imports in manifests and source', (t) => {
  const check = workspace(
    t,
    {
      'packages/numerology/package.json': manifest('@xuanxue/numerology', {
        '@xuanxue/db': '*',
        '@xuanxue/shared': '*',
      }),
      'packages/tarot/package.json': manifest('@xuanxue/tarot', { '@xuanxue/shared': '*' }),
      'packages/tarot/src/index.ts': "import '@xuanxue/ai'; import '@xuanxue/shared'",
    },
    {
      ...emptyRules(),
      packageLayers: {
        '@xuanxue/numerology': ['@xuanxue/shared'],
        '@xuanxue/tarot': ['@xuanxue/shared'],
      },
    },
  )
  const violations = check()
  assert.equal(violations.length, 2)
  assert.ok(violations.some((message) => message.includes('@xuanxue/numerology → @xuanxue/db')))
  assert.ok(violations.some((message) => message.includes('@xuanxue/tarot → @xuanxue/ai')))
})

test('packageLayers in rules restrict pure packages to listed internal deps', (t) => {
  const run = workspace(
    t,
    {
      'packages/bazi/package.json': manifest('@xuanxue/bazi', { '@xuanxue/db': 'workspace:*' }),
      'packages/bazi/src/index.ts': "import { x } from '@xuanxue/shared'\n",
      'packages/db/package.json': manifest('@xuanxue/db'),
      'packages/shared/package.json': manifest('@xuanxue/shared'),
    },
    { ...emptyRules(), packageLayers: { '@xuanxue/bazi': [] } },
  )
  const violations = run()
  assert.equal(violations.length, 2)
  assert.ok(violations.every((v) => v.includes('@xuanxue/bazi 不得依赖其他内部包')))
})
