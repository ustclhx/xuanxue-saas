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
  // 用例依次注册、换会话登录、再注册陌生人，三次走真实 Turnstile 与认证流程，
  // 本地 vite dev 冷编译时总耗时约 1–1.5 分钟，默认 30 秒不够（group8 验收在 main 上同样超时）
  test.setTimeout(90_000)
  const email = `reader-${newId()}@example.com`
  await register(page, email, 'Reader')
  const slug = new URL(page.url()).pathname.split('/')[2] ?? ''
  const id = await seedReading(slug)

  // 第二会话在非 UTC 时区：服务端（workerd）为 UTC，报告时间若按运行时时区格式化会触发水合错误
  const other = await browser.newContext({ timezoneId: 'Asia/Taipei' })
  const second = await other.newPage()
  const hydrationErrors: string[] = []
  const isHydrationError = (text: string) => /hydrat|#418/i.test(text)
  second.on('pageerror', (error) => {
    if (isHydrationError(error.message)) hydrationErrors.push(error.message)
  })
  second.on('console', (message) => {
    if (message.type() === 'error' && isHydrationError(message.text()))
      hydrationErrors.push(message.text())
  })
  await login(second, email)
  await second.goto(`/app/${slug}/readings`)
  const list = second.getByTestId('readings-list')
  await expect(list.getByText('Your full numerology reading')).toBeVisible()
  await expect(list.locator('time')).not.toContainText('UTC')
  await list.getByRole('link', { name: 'Open' }).click()
  await expect(second).toHaveURL(new RegExp(`/app/${slug}/readings/${id}$`))
  const report = second.getByTestId('reading-report')
  await expect(report.getByRole('heading', { level: 2, name: 'Life Path' })).toBeVisible()
  await expect(report.getByText('<script>window.__xss = 1</script>')).toBeVisible()
  expect(await second.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
  await expect(second.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  // 直接加载报告页（SSR + 水合），水合后的时间应为本地时区
  await second.reload()
  await expect(report.getByText('Created')).not.toContainText('UTC')
  expect(hydrationErrors).toEqual([])
  // 打印只输出报告正文：站点页头、空间摘要（含帐户名与邮箱）与导航隐藏
  await second.emulateMedia({ media: 'print' })
  await expect(second.getByTestId('current-user')).toBeHidden()
  await expect(second.getByRole('navigation', { name: 'Space navigation' })).toBeHidden()
  await expect(second.getByRole('banner')).toBeHidden()
  await expect(report.getByRole('heading', { level: 2, name: 'Life Path' })).toBeVisible()
  await second.emulateMedia({ media: 'screen' })
  await expect(second.getByTestId('current-user')).toBeVisible()
  await expect(second.getByRole('banner')).toBeVisible()
  await other.close()

  const strangerContext = await browser.newContext()
  const stranger = await strangerContext.newPage()
  await register(stranger, `stranger-${newId()}@example.com`, 'Stranger')
  const response = await stranger.goto(`/app/${slug}/readings/${id}`)
  expect(response?.status()).toBe(404)
  await expect(stranger.getByText('Life Path')).toHaveCount(0)
  await strangerContext.close()
})
