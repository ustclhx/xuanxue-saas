import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { compare, inScope, rawSizes, scan } from './check-type-roles.mjs'

test('命中原始字号类（含变体前缀），不命中角色类与相近的类名', () => {
  assert.deepEqual(
    rawSizes('text-sm sm:text-lg hover:text-2xl [&_h2]:text-xl "text-base" text-xs'),
    ['text-sm', 'text-lg', 'text-2xl', 'text-xl', 'text-base', 'text-xs'],
  )
  assert.deepEqual(
    rawSizes(
      'text-body text-caption text-title text-display text-subtitle text-lead text-micro text-ink text-center text-balance context-xl text-smooth text-base-foo',
    ),
    [],
  )
})

test('检查范围：src 下的 ts / tsx，不含测试与 routes/dev', () => {
  assert.equal(inScope('src/features/a/page.tsx'), true)
  assert.equal(inScope('src/features/a/classes.ts'), true)
  assert.equal(inScope('src/features/a/page.test.tsx'), false)
  assert.equal(inScope('src/routes/dev/ui.tsx'), false)
  assert.equal(inScope('src/styles/app.css'), false)
  assert.equal(inScope('e2e/home.spec.ts'), false)
})

test('扫描目录并对照允许名单：未登记、超额、可收紧与可删除都报出', () => {
  const root = mkdtempSync(join(tmpdir(), 'type-roles-'))
  const write = (file, text) => {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  write('src/a.tsx', '<p className="text-sm">a</p>')
  write('src/b.tsx', '<p className="text-sm text-lg">b</p>')
  write('src/c.tsx', '<p className="text-body">c</p>')
  write('src/d.tsx', '<p className="text-xs">d</p>')
  write('src/routes/dev/x.tsx', '<p className="text-sm">dev</p>')
  write('src/e.test.tsx', '<p className="text-sm">test</p>')
  const counts = scan(root)
  assert.deepEqual(counts, { 'src/a.tsx': 1, 'src/b.tsx': 2, 'src/d.tsx': 1 })
  assert.deepEqual(compare(counts, { 'src/a.tsx': 1, 'src/b.tsx': 2, 'src/d.tsx': 1 }), [])
  const errors = compare(counts, { 'src/b.tsx': 1, 'src/c.tsx': 3, 'src/d.tsx': 4 })
  assert.equal(errors.length, 4)
  assert.match(errors.join('\n'), /src\/a\.tsx: 1 处原始字号类，请改用字号角色类/)
  assert.match(errors.join('\n'), /src\/b\.tsx: 2 处原始字号类，超过允许名单登记的 1 处/)
  assert.match(errors.join('\n'), /src\/c\.tsx: 已没有原始字号类/)
  assert.match(errors.join('\n'), /src\/d\.tsx: 原始字号类已减少到 1 处/)
})
