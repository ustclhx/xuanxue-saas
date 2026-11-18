import { expect, test } from '@playwright/test'
import { encodeShareInput } from '../src/features/tools/share.ts'

// 旧首页链接兼容（openspec separate-landing-homepage design.md D4，specs/home-hub「旧首页链接迁移」）：
// 迁移前工具在语言首页，已分享的 `<语言首页>#r=…` 与已签发的 `<语言首页>?unlock=…` 仍须可用。
const BAZI = `/zh-hant/${encodeURI('八字排盤')}`
const LIFE_PATH = '/life-path-number'
const HYDRATED = { waitUntil: 'networkidle' } as const
const baziShare = { year: '1990', month: '5', day: '15', time: '10:30' }

/** 未签名的解锁令牌：只用于恢复输入（unlock-card.tsx 第 1 步），不会自动扣费 */
function unlockToken(payload: { kind: string; share: Record<string, string>; returnTo: string }) {
  const body = Buffer.from(JSON.stringify({ v: 1, ...payload, exp: Date.now() + 60_000 })).toString(
    'base64url',
  )
  return `${body}.forged`
}

test('旧首页 ?unlock= / ?checkout= 301 到主工具页并保留查询，UTM 不跳转', async ({ request }) => {
  for (const [from, to] of [
    ['/zh-hant?unlock=abc&checkout=success', `${BAZI}?unlock=abc&checkout=success`],
    ['/zh-hans?unlock=abc', `/zh-hans/${encodeURI('八字排盘')}?unlock=abc`],
    [
      '/ko?checkout=success&utm_source=x',
      `/ko/${encodeURI('만세력')}?checkout=success&utm_source=x`,
    ],
    ['/?unlock=abc', `${LIFE_PATH}?unlock=abc`],
  ] as const) {
    const response = await request.get(from, { maxRedirects: 0 })
    expect(response.status(), from).toBe(301)
    const location = new URL(response.headers().location ?? '', 'http://localhost')
    expect(`${location.pathname}${location.search}`, from).toBe(to)
  }
  for (const path of ['/ko?utm_source=newsletter', '/?gclid=abc', '/zh-hant']) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(200)
  }
})

test('/zh-hant?unlock=<令牌> 跳到八字排盤工具页并恢复输入', async ({ page }) => {
  const token = unlockToken({ kind: 'bazi-full', share: baziShare, returnTo: '/zh-hant' })
  await page.goto(`/zh-hant?unlock=${token}`, HYDRATED)
  await expect(page).toHaveURL((url) => url.pathname === BAZI)
  // 结果按令牌中的输入复现：1990-05-15 10:30 = 庚午 辛巳 庚辰 辛巳
  await expect(page.locator('#pillars [data-pillar="day"]')).toHaveText(/庚.*辰/s)
  await expect(page.locator('#weight [data-weight]')).toHaveText('4 兩 4 錢')
})

// 片段不发往服务器，由落地页 head 中的内联脚本（features/site/gate.ts 的 legacyHashRedirectScript）
// 在首帧前替换到主工具页；脚本随落地页挂在首页 head（routes/index.tsx，tasks.md 4.1）。
test.describe('旧 #r= 分享链接', () => {
  test('/zh-hant#r= 替换到八字排盤工具页并显示结果', async ({ page }) => {
    const hash = `#r=${encodeShareInput(baziShare)}`
    await page.goto(`/zh-hant${hash}`, HYDRATED)
    await expect(page).toHaveURL((url) => url.pathname === BAZI && url.hash === hash)
    await expect(page.locator('#weight [data-weight]')).toHaveText('4 兩 4 錢')
  })

  test('/#r= 替换到 Life Path 工具页并显示结果', async ({ page }) => {
    const hash = `#r=${encodeShareInput({ date: '1987-11-29' })}`
    await page.goto(`/${hash}`, HYDRATED)
    await expect(page).toHaveURL((url) => url.pathname === LIFE_PATH && url.hash === hash)
    await expect(page.locator('#life-path-result')).toContainText('Your life path number')
  })

  test('首页的页内锚点不跳转', async ({ page }) => {
    await page.goto('/zh-hant#sample', HYDRATED)
    await expect(page).toHaveURL((url) => url.pathname === '/zh-hant')
  })
})
