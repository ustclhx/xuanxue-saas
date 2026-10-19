import { expect, test } from '@playwright/test'
import { newId } from '@xuanxue/shared'
import { fixtureDb, login, register } from './fixtures.ts'

// add-reading-monetization tasks.md 3.2：换会话后在列表中打开报告；报告 noindex；非成员访问返回 404。
// 报告行直接写入数据库（生成管线由 test/readings.test.ts 覆盖），不调用模型。

const REPORT = `> This report is based on traditional numerology.

## Overview

Your life path **11** is a master number.

## Life Path

- Sensitive to atmosphere

<script>window.__xss = 1</script>`

async function seedReading(slug: string) {
  const sql = fixtureDb()
  try {
    const [ws] = await sql<{ id: string }[]>`select id from organization where slug = ${slug}`
    if (!ws) throw new Error('workspace missing')
    const id = newId()
    await sql`insert into reading (id, workspace_id, user_id, kind, input_hash, input, locale,
      engine_version, prompt_version, model_key, credits, status, content)
      values (${id}, ${ws.id}, ${ws.id}, 'numerology-full', ${newId()}, '{}'::jsonb, 'en',
        'numerology@1', 'numerology-full.v1', 'e2e-model', 100, 'ready', ${REPORT})`
    return id
  } finally {
    await sql.end()
  }
}

test('换会话后在列表中打开报告，报告页 noindex，非成员访问返回 404', async ({ page, browser }) => {
  const email = `reader-${newId()}@example.com`
  await register(page, email, 'Reader')
  const slug = new URL(page.url()).pathname.split('/')[2] ?? ''
  const id = await seedReading(slug)

  const other = await browser.newContext()
  const second = await other.newPage()
  await login(second, email)
  await second.goto(`/app/${slug}/readings`)
  const list = second.getByTestId('readings-list')
  await expect(list.getByText('Your full numerology reading')).toBeVisible()
  await list.getByRole('link', { name: 'Open' }).click()
  await expect(second).toHaveURL(new RegExp(`/app/${slug}/readings/${id}$`))
  const report = second.getByTestId('reading-report')
  await expect(report.getByRole('heading', { level: 2, name: 'Life Path' })).toBeVisible()
  await expect(report.getByText('<script>window.__xss = 1</script>')).toBeVisible()
  expect(await second.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
  await expect(second.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await other.close()

  const strangerContext = await browser.newContext()
  const stranger = await strangerContext.newPage()
  await register(stranger, `stranger-${newId()}@example.com`, 'Stranger')
  const response = await stranger.goto(`/app/${slug}/readings/${id}`)
  expect(response?.status()).toBe(404)
  await expect(stranger.getByText('Life Path')).toHaveCount(0)
  await strangerContext.close()
})
