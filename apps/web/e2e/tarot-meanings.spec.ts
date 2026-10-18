import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

for (const [locale, host, path, title, orientation, draw, read, disclaimer] of [
  [
    'en',
    'west',
    '/tarot/cards/ace-of-wands',
    'Ace of Wands',
    'Upright',
    'Draw one card',
    'Read the full card meaning',
    'AI-assisted interpretation',
  ],
  [
    'zh-Hant',
    'east',
    '/zh-hant/塔羅/牌義/ace-of-wands',
    '權杖王牌',
    '正位',
    '抽一張牌',
    '閱讀完整牌義',
    '本篇為 AI 輔助解讀',
  ],
  [
    'ko',
    'east',
    '/ko/타로/카드/ace-of-wands',
    '완드 에이스',
    '정방향',
    '한 장 뽑기',
    '카드 의미 자세히 읽기',
    '이 글은 AI의 도움',
  ],
] as const) {
  test(`${locale} 牌义正文、跨站 SEO、相邻王牌与键盘单张抽牌`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost:3000')
    origin.hostname = `${host}.localhost`
    await page.goto(`${origin.origin}${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title)
    await expect(page.locator('article h2')).toHaveCount(10)
    await expect(page.locator('article img')).toHaveCount(2)
    await expect(page.locator('article img').first()).toHaveAttribute(
      'alt',
      new RegExp(`${title}.*${orientation}`),
    )
    await expect(page.locator('article img').first()).toHaveAttribute('srcset', /240w, .*480w$/)
    await expect(page.locator('article p').filter({ hasText: disclaimer })).toHaveCount(1)
    for (const lang of ['en', 'zh-Hant', 'ko', 'x-default'])
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1)
    for (const slug of ['two-of-wands', 'ace-of-cups', 'ace-of-swords', 'ace-of-pentacles'])
      await expect(page.locator(`aside a[href$="/${slug}"]`)).toHaveCount(1)
    await expect(page.getByTestId('tarot-meaning-draw')).toHaveAttribute('data-hydrated', 'true')
    await page.getByRole('button', { name: draw, exact: true }).click()
    await expect(page.locator('[data-slot-index="0"]')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('tarot-meaning-draw').locator('img')).toHaveCount(1)
    await page.getByRole('link', { name: read, exact: true }).click()
    await expect(page.locator('article h2')).toHaveCount(10)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow).toBe(false)
  })
}
