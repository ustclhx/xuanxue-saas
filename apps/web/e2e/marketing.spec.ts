import { expect, test } from '@playwright/test'
import templateConfig from '../../../template.config.ts'
import { localePrefix } from '../src/features/i18n/url-prefix.ts'

// 营销站（openspec add-marketing-i18n-seo tasks.md 3.1、3.3、3.4、3.5）：首页区块、博客、法律页与文档站，
// 默认语言与其他语言路径都可访问。数据库停止时的访问与草稿的生产构建检查见 PR 说明与 scripts/content.test.ts。
const { defaultLocale } = templateConfig.i18n
const otherLocales = templateConfig.i18n.locales.filter((locale) => locale !== defaultLocale)
const languages = [defaultLocale, ...otherLocales]
const EAST_TOOL_HOMES: readonly string[] = ['zh-Hant', 'ko']

for (const lang of languages) {
  const prefix = lang === defaultLocale ? '' : localePrefix(lang)

  test(`首页各区块（${lang}）`, async ({ page }) => {
    const response = await page.goto(prefix || '/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // 东方站语言首页是排盘工具页（openspec add-bazi-saju-chart，见 e2e/bazi.spec.ts）
    if (EAST_TOOL_HOMES.includes(lang)) await expect(page.locator('main form')).toBeVisible()
    else {
      // 西方站英语首页为 Life Path 计算器，原营销板块迁往 /pricing（openspec add-numerology-tools 决策 3）
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Life Path Number Calculator',
      )
      await page.goto('/pricing')
      for (const id of ['features', 'testimonials', 'faq']) {
        await expect(page.locator(`section#${id}`)).toBeVisible()
      }
    }
    // 页脚的法律页链接带当前语言前缀
    await expect(page.locator(`footer a[href="${prefix}/legal/refund"]`)).toBeVisible()
  })

  test(`博客列表、文章与标签（${lang}）`, async ({ page }) => {
    await page.goto(`${prefix}/blog`)
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    const post = page.locator(`a[href="${prefix}/blog/welcome"]`).first()
    await expect(post).toBeVisible()
    // 定时发布的文章到期前不出现在列表
    await expect(page.locator(`a[href="${prefix}/blog/scheduled-example"]`)).toHaveCount(0)
    await post.click()
    await expect(page).toHaveURL(new RegExp(`${prefix}/blog/welcome$`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto(`${prefix}/blog/tags/guide`)
    await expect(page.locator(`a[href="${prefix}/blog/welcome"]`).first()).toBeVisible()
    expect((await page.goto(`${prefix}/blog/scheduled-example`))?.status()).toBe(404)
  })

  test(`法律页（${lang}）`, async ({ page, request, baseURL }) => {
    const copy = {
      en: {
        titles: {
          privacy: 'Privacy Policy',
          terms: 'Terms of Service',
          refund: 'Refund Policy',
          disclaimer: 'Disclaimer',
        },
        refund: ['not refunded by default', 'Request refund'],
        privacy: [
          'locally in your browser',
          'saved in your account',
          'delete your saved reports',
          'unsubscribe at any time',
        ],
        disclaimer: [
          'entertainment',
          'do not predict the future',
          'healthcare',
          'legal',
          'financial',
        ],
      },
      'zh-Hant': {
        titles: {
          privacy: '隱私政策',
          terms: '服務條款',
          refund: '退款政策',
          disclaimer: '免責聲明',
        },
        refund: ['預設不退款', '申請退款'],
        privacy: [
          '瀏覽器本地計算',
          '保存在你的帳號中',
          '刪除已儲存的報告',
          '隨時透過訂閱郵件中的退訂連結',
        ],
        disclaimer: ['僅供娛樂', '不預測未來', '醫療', '法律', '財務'],
      },
      ko: {
        titles: {
          privacy: '개인정보처리방침',
          terms: '이용약관',
          refund: '환불 정책',
          disclaimer: '면책 고지',
        },
        refund: ['기본적으로 환불되지 않습니다', '환불 요청'],
        privacy: [
          '브라우저에서 로컬로 계산',
          '계정에 저장',
          '보고서는 삭제할 수',
          '언제든지 구독을 해지',
        ],
        disclaimer: ['오락', '미래를 예측하지 않습니다', '의료', '법률', '재무'],
      },
    }[lang]
    const site = lang === 'en' ? 'west' : 'east'
    const origin = new URL(baseURL ?? 'http://localhost:3000')
    origin.hostname = `${site}.localhost`
    const slugs = ['privacy', 'terms', 'refund', 'disclaimer'] as const
    for (const slug of slugs) {
      // 使用真实站点 Host 验证韩语正文，不把默认语言回退误当成翻译成功。
      const response = await page.goto(`${origin.origin}${prefix}/legal/${slug}`)
      expect(response?.status(), slug).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.titles[slug])
      const article = page.locator('article')
      await expect(article).toHaveAttribute('lang', lang)
      await expect(article).toContainText(templateConfig.app.supportEmail)
      await expect(article).toContainText('[公司名称]')
      await expect(article).toContainText('[联系地址]')
      if (slug !== 'terms') {
        for (const text of copy[slug]) await expect(article).toContainText(text)
      } else {
        await expect(article.locator(`a[href="${prefix}/legal/disclaimer"]`)).toBeVisible()
      }
      const footerLink = page.locator(`footer a[href="${prefix}/legal/disclaimer"]`)
      await expect(footerLink).toHaveText(copy.titles.disclaimer)
      await expect(footerLink).toBeVisible()
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://xuanxue-${site}.example${prefix}/legal/${slug}`,
      )
    }
    const sitemap = await request.get(`/sitemap/${lang === 'zh-Hant' ? 'zh-hant' : lang}.xml`, {
      headers: { host: origin.host },
    })
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    for (const slug of slugs) {
      expect(xml).toContain(`<loc>https://xuanxue-${site}.example${prefix}/legal/${slug}</loc>`)
    }
  })

  test(`文档站按 features.docs 开关（${lang}，当前 ${templateConfig.features.docs}）`, async ({
    page,
  }) => {
    for (const path of ['/docs', '/docs/getting-started']) {
      const response = await page.goto(`${prefix}${path}`)
      expect(response?.status(), path).toBe(templateConfig.features.docs ? 200 : 404)
    }
    if (!templateConfig.features.docs) {
      await page.goto(prefix || '/')
      await expect(page.locator(`a[href="${prefix}/docs"]`)).toHaveCount(0)
      return
    }
    await page.goto(`${prefix}/docs`)
    // 搜索在客户端执行：等水合完成（主题切换按钮在水合后才可用）再输入
    await expect(page.locator('[data-theme-option="system"]')).toBeEnabled()
    await page.getByRole('searchbox').fill('template.config')
    await expect(page.locator(`search a[href="${prefix}/docs/configuration"]`)).toBeVisible()
  })
}
