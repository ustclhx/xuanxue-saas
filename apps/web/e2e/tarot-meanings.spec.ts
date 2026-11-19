import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

for (const [locale, host, path, title, orientation, draw, anchors, disclaimer] of [
  [
    'en',
    'west',
    '/tarot/cards/ace-of-wands',
    'Ace of Wands',
    'Upright',
    'Draw one card',
    [
      'King of Wands tarot card meaning',
      'Two of Wands tarot card meaning',
      'Three of Wands tarot card meaning',
      'Ace of Swords tarot card meaning',
    ],
    'drafted with AI and reviewed by a person',
  ],
  [
    'zh-Hant',
    'east',
    '/zh-hant/塔羅/牌義/ace-of-wands',
    '權杖王牌',
    '正位',
    '抽一張牌',
    ['權杖國王塔羅牌義', '權杖二塔羅牌義', '權杖三塔羅牌義', '寶劍王牌塔羅牌義'],
    '本篇由 AI 起草、經人工審定',
  ],
  [
    'ko',
    'east',
    '/ko/타로/카드/ace-of-wands',
    '완드 에이스',
    '정방향',
    '한 장 뽑기',
    [
      '완드 왕 타로 카드 의미',
      '완드 2 타로 카드 의미',
      '완드 3 타로 카드 의미',
      '소드 에이스 타로 카드 의미',
    ],
    'AI가 초안을 작성하고 사람이 검토한',
  ],
] as const) {
  test(`${locale} 牌义正文、跨站 SEO、4 条延伸牌义与键盘单张抽牌`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost:3000')
    origin.hostname = `${host}.localhost`
    await page.goto(`${origin.origin}${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title)
    // 单栏：长文 9 个 H2（FAQ 移到长文之后的折叠列表），正逆位牌面在长文之前，文末声明在页尾
    await expect(page.locator('aside')).toHaveCount(0)
    await expect(page.locator('article h2')).toHaveCount(9)
    await expect(page.locator('main figure img')).toHaveCount(2)
    await expect(page.locator('main figure img').first()).toHaveAttribute(
      'alt',
      new RegExp(`${title}.*${orientation}`),
    )
    await expect(page.locator('main figure img').first()).toHaveAttribute('srcset', /240w, .*480w$/)
    await expect(page.locator('main details')).toHaveCount(3)
    await expect(page.locator('main p').filter({ hasText: disclaimer })).toHaveCount(1)
    // 两站分开经营（D5）：hreflang 只在同站内互指
    for (const lang of host === 'west' ? ['en', 'x-default'] : ['zh-Hant', 'ko', 'x-default'])
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1)
    await expect(
      page.locator(`link[rel="alternate"][hreflang="${host === 'west' ? 'ko' : 'en'}"]`),
    ).toHaveCount(0)
    // 延伸牌义：正文里的 H2 区块，固定 4 条（同花色前 1 张、后 2 张与另一花色的同序号牌）
    const related = page.locator('section[aria-labelledby="tarot-related-title"] a')
    await expect(related).toHaveText([...anchors])
    for (const [index, slug] of [
      'king-of-wands',
      'two-of-wands',
      'three-of-wands',
      'ace-of-swords',
    ].entries())
      await expect(related.nth(index)).toHaveAttribute('href', new RegExp(`/${slug}$`))
    // 正文内链合计 5 条：4 条延伸牌义加页尾一条转化条；长文里不再有链接
    await expect(page.locator('article a')).toHaveCount(0)
    await expect(page.getByTestId('link-band').getByRole('link')).toHaveCount(1)
    await expect(page.locator('main a:not(nav a)')).toHaveCount(5)
    await expect(page.getByTestId('tarot-meaning-draw')).toHaveAttribute('data-hydrated', 'true')
    await page.getByRole('button', { name: draw, exact: true }).click()
    await expect(page.locator('[data-slot-index="0"]')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('tarot-meaning-draw').locator('img')).toHaveCount(1)
    // 翻开后给出这张牌的牌义链接，锚文本是牌名加主关键词
    const drawn = page.locator('section[aria-labelledby="tarot-try-title"] [aria-live] a')
    await expect(drawn).toHaveText(
      new RegExp(anchors[0].replace(/^.*?(?=\s?(tarot|塔羅|타로))/, '')),
    )
    await drawn.click()
    await expect(page.locator('article h2')).toHaveCount(9)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow).toBe(false)
  })
}

// 牌义索引页（新页，设计稿 warm-refresh/TarotIndex.dc.html、TarotIndexEast.dc.html）与内链规则：
// 只有服务端输出的真实 <a href> 才算链接，因此在禁用脚本的上下文里检查。
test('禁用脚本：牌义索引 78 条链接、牌义页 4 条延伸牌义、抽牌页到索引的链接都在 HTML 里', async ({
  browser,
  baseURL,
}) => {
  const origin = (host: string) => {
    const url = new URL(baseURL ?? 'http://localhost:3000')
    url.hostname = `${host}.localhost`
    return url.origin
  }
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  try {
    // 西方站索引：5 个分组、78 张牌，锚文本「<牌名> Tarot」，罗马数字在链接之外
    await page.goto(`${origin('west')}/tarot/cards`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Tarot Card Meanings: All 78 Cards',
    )
    await expect(page.locator('main section h2')).toHaveText([
      'Major Arcana',
      'Suit of Wands',
      'Suit of Cups',
      'Suit of Swords',
      'Suit of Pentacles',
    ])
    const cards = page.locator('main section li a')
    await expect(cards).toHaveCount(78)
    await expect(cards.nth(18)).toHaveText('The Moon Tarot')
    await expect(cards.nth(18)).toHaveAttribute('href', '/tarot/cards/the-moon')
    await expect(page.locator('main section li').nth(18)).toHaveText('XVIIIThe Moon Tarot')
    await expect(cards.nth(22)).toHaveText('Ace of Wands Tarot')
    await expect(page.locator('main header p a')).toHaveText([
      'three-card tarot',
      'card of the day',
    ])
    await expect(page.locator('main img')).toHaveCount(0)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /arcanumber\.com\/tarot\/cards$/,
    )
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(2)

    // 牌义页：太阳 → 月亮、审判、世界（同序列）与力量（主题对应）
    await page.goto(`${origin('west')}/tarot/cards/the-sun`)
    const related = page.locator('section[aria-labelledby="tarot-related-title"] a')
    await expect(related).toHaveText([
      'The Moon tarot card meaning',
      'Judgement tarot card meaning',
      'The World tarot card meaning',
      'Strength tarot card meaning',
    ])
    await expect(related.nth(3)).toHaveAttribute('href', '/tarot/cards/strength')
    await expect(
      page
        .getByRole('navigation', { name: 'Breadcrumb' })
        .getByRole('link', { name: 'Tarot Card Meanings' }),
    ).toHaveAttribute('href', '/tarot/cards')

    // 东方站索引（简中、繁中、韩语同一版式）：锚文本「<牌名>塔罗牌」，链接不跨站
    for (const [path, anchor, draw] of [
      ['/zh-hans/塔罗/牌义', '月亮塔罗牌', '/zh-hans/塔罗'],
      ['/zh-hant/塔羅/牌義', '月亮塔羅牌', '/zh-hant/塔羅'],
      ['/ko/타로/카드', '달 타로 카드', '/ko/타로'],
    ] as const) {
      await page.goto(`${origin('east')}${encodeURI(path)}`)
      const eastCards = page.locator('main section li a')
      await expect(eastCards).toHaveCount(78)
      await expect(eastCards.nth(18)).toHaveText(anchor)
      await expect(eastCards.nth(18)).toHaveAttribute('href', `${encodeURI(path)}/the-moon`)
      await expect(page.locator('main a[href*="arcanumber"]')).toHaveCount(0)
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(4)
      // 抽牌页导语链接本站的牌义索引
      await page.goto(`${origin('east')}${encodeURI(draw)}`)
      await expect(page.locator('main header p a')).toHaveAttribute('href', encodeURI(path))
    }
  } finally {
    await context.close()
  }
})
