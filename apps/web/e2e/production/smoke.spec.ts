import { expect, test } from '@playwright/test'

// 生产只读冒烟（production-deployment spec「生产冒烟只读」）：只发 GET，
// 不注册、不登录、不支付，也不提交任何表单，生产库中不会留下冒烟数据。

// 西方站首页为 Life Path 计算器（openspec add-numerology-tools 2.1），只检查标题与日期输入，不提交表单
test('首页渲染', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Life Path Number Calculator')
  await expect(page.getByLabel('Date of birth')).toBeVisible()
})

// 定价页只展示积分包（launch-v1-production 任务 1.3）
test('定价页渲染', async ({ page }) => {
  const response = await page.goto('/pricing')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Credit packs', exact: true })).toBeVisible()
})

test('健康接口返回本次版本且数据库可用', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.db?.status).toBe('up')
  // 发布流水线传入完整 SHA；本地对其他环境试跑时可不设
  if (process.env.APP_VERSION) expect(body.version).toBe(process.env.APP_VERSION)
})
