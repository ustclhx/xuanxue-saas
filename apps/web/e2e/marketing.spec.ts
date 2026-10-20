import { expect, test } from '@playwright/test'
import { supportEmail } from '@xuanxue/config'
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
    // 法律页只有英文一份；其他语言同一路径显示英文正文并标注、noindex、不进站点地图
    const titles = {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      refund: 'Refund Policy',
      disclaimer: 'Disclaimer',
    } as const
    const body = {
      privacy: ['18 and over', 'never sell', 'DeepSeek', 'Cloudflare Web Analytics'],
      terms: ['at least 18 years old', 'Limitation of liability'],
      refund: [
        'returned to your account automatically',
        'When we do not refund',
        '5 business days',
      ],
      disclaimer: [
        'Calculation and interpretation',
        'reflective, not predictive',
        'Not a substitute for professional advice',
        'No prediction of the future',
        'No guarantee of accuracy',
      ],
    }
    const localized = {
      en: { note: null, footer: 'Disclaimer' },
      'zh-Hant': { note: '僅提供英文版本', footer: '免責聲明（英文）' },
      ko: { note: '영어로만 제공', footer: '면책 고지 (영문)' },
    }[lang]
    const site = lang === 'en' ? 'west' : 'east'
    const origin = new URL(baseURL ?? 'http://localhost:3000')
    origin.hostname = `${site}.localhost`
    const slugs = ['privacy', 'terms', 'refund', 'disclaimer'] as const
    for (const slug of slugs) {
      const response = await page.goto(`${origin.origin}${prefix}/${slug}`)
      expect(response?.status(), slug).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles[slug])
      const article = page.locator('article')
      await expect(article).toHaveAttribute('lang', 'en')
      await expect(article).toContainText('Last updated:')
      // 联系邮箱按站点（东方站 support@ganjiday.com）
      await expect(article).toContainText(supportEmail(templateConfig, lang))
      for (const text of body[slug]) await expect(article).toContainText(text)
      // 只从页脚进入，页头不出现法律页链接
      await expect(page.locator(`header a[href="${prefix}/${slug}"]`)).toHaveCount(0)
      const footerLink = page.locator(`footer a[href="${prefix}/disclaimer"]`)
      await expect(footerLink).toHaveText(localized.footer)
      const robots = page.locator('meta[name="robots"]')
      if (localized.note) {
        await expect(page.getByRole('note')).toContainText(localized.note)
        await expect(robots).toHaveAttribute('content', /noindex/)
      } else {
        await expect(page.getByRole('note')).toHaveCount(0)
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `https://${templateConfig.sites[site].hosts[0]}/${slug}`,
        )
      }
    }
    // Cookie 条款并入隐私政策的一节
    await page.goto(`${origin.origin}${prefix}/privacy`)
    await expect(page.getByRole('heading', { name: 'Cookies', level: 2 })).toBeVisible()
    const sitemap = await request.get(`/sitemap/${lang === 'zh-Hant' ? 'zh-hant' : lang}.xml`, {
      headers: { host: origin.host },
    })
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    for (const slug of slugs) {
      const loc = `<loc>https://${templateConfig.sites[site].hosts[0]}${prefix}/${slug}</loc>`
      if (lang === 'en') expect(xml).toContain(loc)
      else expect(xml).not.toContain(loc)
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
