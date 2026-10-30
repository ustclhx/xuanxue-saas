import { expect, test } from '@playwright/test'
import { supportEmail } from '@xuanxue/config'
import templateConfig from '../../../template.config.ts'
import { localePrefix } from '../src/features/i18n/url-prefix.ts'
import { seedBillingCatalog } from './fixtures.ts'

// 营销站（openspec add-marketing-i18n-seo tasks.md 3.1、3.3、3.4、3.5）：首页区块、博客、法律页与文档站，
// 默认语言与其他语言路径都可访问。数据库停止时的访问与草稿的生产构建检查见 PR 说明与 scripts/content.test.ts。
const { defaultLocale } = templateConfig.i18n
const otherLocales = templateConfig.i18n.locales.filter((locale) => locale !== defaultLocale)
const languages = [defaultLocale, ...otherLocales]
const EAST_TOOL_HOMES: readonly string[] = ['zh-Hant', 'zh-Hans', 'ko']

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
      // 定价页只卖积分包，不再有模板的功能/评价区块（Stripe 审核不接受虚构评价）
      await seedBillingCatalog()
      await page.goto('/pricing')
      await expect(page.getByTestId('pricing-pack')).toHaveCount(2)
      await expect(page.getByText('Loved by builders')).toHaveCount(0)
      await expect(page.locator('section#testimonials')).toHaveCount(0)
    }
    // 页脚的法律页链接带当前语言前缀
    await expect(page.locator(`footer a[href="${prefix}/refund"]`)).toBeVisible()
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
    // 法律页按站点分开（product-improve-ai-content D4）：东方站三种语言、西方站英文各有原文，
    // 隐私、条款与退款页含两站共用的运营主体段落；有原文的页面可索引并进入本语言站点地图
    const copy = {
      en: {
        titles: ['Privacy Policy', 'Terms of Service', 'Refund Policy', 'Disclaimer'],
        footer: 'Disclaimer',
        cookies: 'Cookies',
        operator: 'operated by the same independent developer',
        body: {
          privacy: ['18 and over', 'never sell', 'DeepSeek', 'numerology and tarot'],
          terms: ['at least 18 years old', 'Limitation of liability'],
          refund: ['returned to your account automatically', 'When we do not refund'],
          disclaimer: ['reflective, not predictive', 'No prediction of the future'],
        },
      },
      'zh-Hant': {
        titles: ['隱私政策', '服務條款', '退款政策', '免責聲明'],
        footer: '免責聲明',
        cookies: 'Cookie',
        operator: '由同一位獨立開發者',
        body: {
          privacy: ['18 歲以上', '絕不出售', 'DeepSeek', '紫微斗數'],
          terms: ['年滿 18 歲', '責任限制'],
          refund: ['自動退回你的帳戶', '不予退款的情況'],
          disclaimer: ['反思性的，而非預測性的', '不預測未來'],
        },
      },
      'zh-Hans': {
        titles: ['隐私政策', '服务条款', '退款政策', '免责声明'],
        footer: '免责声明',
        cookies: 'Cookie',
        operator: '由同一位独立开发者',
        body: {
          privacy: ['18 岁以上', '绝不出售', 'DeepSeek', '紫微斗数'],
          terms: ['年满 18 岁', '责任限制'],
          refund: ['自动退回你的账户', '不予退款的情况'],
          disclaimer: ['反思性的，而非预测性的', '不预测未来'],
        },
      },
      ko: {
        titles: ['개인정보처리방침', '이용약관', '환불 정책', '면책 고지'],
        footer: '면책 고지',
        cookies: '쿠키',
        operator: '동일한 개인 개발자',
        body: {
          privacy: ['만 18세 이상', '절대 판매하지 않습니다', 'DeepSeek', '자미두수'],
          terms: ['만 18세 이상', '책임의 제한'],
          refund: ['자동으로 계정에 반환', '환불하지 않는 경우'],
          disclaimer: ['예측이 아니라 성찰', '미래를 예측하지 않음'],
        },
      },
    }[lang]
    if (!copy) throw new Error(`Missing legal copy for ${lang}`)
    const site = lang === 'en' ? 'west' : 'east'
    const origin = new URL(baseURL ?? 'http://localhost:3000')
    origin.hostname = `${site}.localhost`
    const slugs = ['privacy', 'terms', 'refund', 'disclaimer'] as const
    for (const [index, slug] of slugs.entries()) {
      const response = await page.goto(`${origin.origin}${prefix}/${slug}`)
      expect(response?.status(), slug).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.titles[index] ?? '')
      const article = page.locator('article')
      await expect(article).toHaveAttribute('lang', lang)
      // 联系邮箱按站点（东方站 support@ganjiday.com）
      await expect(article).toContainText(supportEmail(templateConfig, lang))
      for (const text of copy.body[slug]) await expect(article).toContainText(text)
      if (slug !== 'disclaimer') await expect(article).toContainText(copy.operator)
      // 西方站只描述数字命理与塔罗
      if (site === 'west') await expect(article).not.toContainText(/Bazi|Saju|Ziwei/)
      // 只从页脚进入，页头不出现法律页链接
      await expect(page.locator(`header a[href="${prefix}/${slug}"]`)).toHaveCount(0)
      const footerLink = page.locator(`footer a[href="${prefix}/disclaimer"]`)
      await expect(footerLink).toHaveText(copy.footer)
      await expect(page.getByRole('note')).toHaveCount(0)
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://${templateConfig.sites[site].hosts[0]}${prefix}/${slug}`,
      )
    }
    // Cookie 条款并入隐私政策的一节
    await page.goto(`${origin.origin}${prefix}/privacy`)
    await expect(page.getByRole('heading', { name: copy.cookies, level: 2 })).toBeVisible()
    const sitemap = await request.get(`/sitemap/${lang === 'en' ? 'en' : lang.toLowerCase()}.xml`, {
      headers: { host: origin.host },
    })
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    for (const slug of slugs)
      expect(xml).toContain(
        `<loc>https://${templateConfig.sites[site].hosts[0]}${prefix}/${slug}</loc>`,
      )
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
