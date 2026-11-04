// biome-ignore-all lint/suspicious/noTemplateCurlyInString: 测试输入是含 SQL 插值的源码。
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { checkSiteScope } from './check-site-scope.mjs'

function check(t, text, exceptions = [], path = 'apps/web/src/query.ts') {
  const root = mkdtempSync(join(tmpdir(), 'site-scope-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
  return checkSiteScope(root, [path], exceptions)
}

test('rejects added unscoped Drizzle email predicates including normalized and callback forms', (t) => {
  for (const predicate of [
    'eq(user.email, email)',
    'ilike(user.email, email)',
    'inArray(sql`lower(${user.email})`, emails)',
  ]) {
    assert.equal(check(t, `db.select().from(user).where(${predicate})`).length, 1)
  }
  assert.equal(
    check(t, 'db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email) })').length,
    1,
  )
  assert.equal(
    check(
      t,
      "import { user as accountUser } from '@xuanxue/db'; db.select().from(accountUser).where(eq(accountUser.email, email))",
    ).length,
    1,
  )
})

test('accepts site in the same Drizzle where and userId reads of email', (t) => {
  assert.deepEqual(
    check(t, 'db.select().from(user).where(and(eq(user.email, email), eq(user.site, site)))'),
    [],
  )
  assert.deepEqual(
    check(
      t,
      'db.query.user.findFirst({ where: (u, { and, eq }) => and(eq(u.email, email), eq(u.site, site)) })',
    ),
    [],
  )
  assert.deepEqual(
    check(t, 'db.select({ email: user.email }).from(user).where(eq(user.id, userId))'),
    [],
  )
})

test('another where, nested subquery, unrelated table site and selected site cannot supply Drizzle scope', (t) => {
  for (const text of [
    'db.select().from(user).where(eq(user.email, email)); db.select().from(user).where(eq(user.site, site))',
    'db.select().from(user).where(and(eq(user.email, email), exists(db.select().from(user).where(eq(user.site, site)))))',
    'db.select({ site: user.site }).from(user).where(eq(user.email, email))',
    'db.select().from(user).where(and(eq(user.email, email), eq(organization.site, site)))',
  ])
    assert.equal(check(t, text).length, 1)
})

test('rejects unscoped raw SQL and accepts same WHERE site in quoted, alias and SQL interpolation forms', (t) => {
  for (const email of ['"user"."email"', 'u.email', 'lower(u.email)']) {
    assert.equal(
      check(t, `db.$client\`select u.id from "user" u where ${email} = \${email}\``).length,
      1,
    )
    assert.deepEqual(
      check(
        t,
        `db.$client\`select u.id from "user" u where ${email} = \${email} and u.site = \${site}\``,
      ),
      [],
    )
  }
  assert.equal(
    check(t, 'db.execute(sql`select id from ${user} where ${user.email} = ${email}`)').length,
    1,
  )
  assert.deepEqual(
    check(
      t,
      'db.execute(sql`select id from ${user} where ${user.email} = ${email} and ${user.site} = ${site}`)',
    ),
    [],
  )
})

test('raw SQL scope must be a predicate of the same query, outside nested subqueries', (t) => {
  for (const sql of [
    'select id from "user" u where u.email=${email}; select id from "user" u where u.site=${site}',
    'select id from "user" u where u.email=${email} and exists(select 1 from "user" u where u.site=${site})',
    'select id from "user" u where u.email=${email} order by u.site',
    'select id from "user" u where u.email=${email} and other.site=${site}',
    'select id from "user" u where u.email=${email} and name=\'u.site=west\' /* u.site=west */',
    'select id from "user" u where u.site=${site} and exists(select 1 from "user" u where u.email=${email})',
  ])
    assert.equal(check(t, `db.$client\`${sql}\``).length, 1)
})

test('only exact file/query whitelist entries with a reason bypass the guard', (t) => {
  const text = 'db.select().from(user).where(eq(user.email, email))'
  const rule = {
    path: 'apps/web/src/query.ts',
    query: 'eq(user.email, email)',
    reason: '已审查的特定查询',
  }
  assert.deepEqual(check(t, text, [rule]), [])
  assert.equal(check(t, text, [{ ...rule, reason: '' }]).length, 1)
  assert.equal(check(t, text, [{ ...rule, path: 'apps/web/src/other.ts' }]).length, 1)
  assert.equal(
    check(t, `${text}; db.select().from(user).where(eq(user.email, anotherEmail))`, [rule]).length,
    1,
  )
})

test('tests, fixtures and probes are excluded; comments and email output do not trigger checks', (t) => {
  const text = 'db.select().from(user).where(eq(user.email, email))'
  for (const path of [
    'apps/web/test/query.ts',
    'packages/auth/probe/query.ts',
    'packages/auth/src/query.test.ts',
    'packages/auth/src/fixtures/query.ts',
  ])
    assert.deepEqual(check(t, text, [], path), [])
  assert.deepEqual(check(t, '// eq(user.email, email)\nconst message = { to: user.email }'), [])
})

test('Drizzle SQL predicate fragments share only the current WHERE site condition', (t) => {
  for (const text of [
    'db.select().from(user).where(sql`lower(${user.email}) = ${email}`)',
    'db.select().from(user).where(sql`lower(${user.email}) = ${email}`); db.select().from(user).where(eq(user.site, site))',
    'db.select().from(user).where(and(sql`lower(${user.email}) = ${email}`, exists(db.select().from(user).where(eq(user.site, site)))))',
    'db.select().from(user).where(sql`lower(${user.email}) = ${email} and exists(select 1 from "user" u where u.site = ${site})`)',
  ])
    assert.equal(check(t, text).length, 1)
  for (const text of [
    'db.select().from(user).where(sql`lower(${user.email}) = ${email} and ${user.site} = ${site}`)',
    'db.select().from(user).where(and(eq(user.site, site), sql`lower(${user.email}) = ${email}`))',
    'db.select().from(user).where(and(sql`${user.site} = ${site}`, eq(user.email, email)))',
    'db.query.user.findFirst({ where: (u) => sql`lower(${u.email}) = ${email} and ${u.site} = ${site}` })',
  ])
    assert.deepEqual(check(t, text), [])
})
