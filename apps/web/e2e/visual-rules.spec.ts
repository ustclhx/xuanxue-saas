/// <reference lib="dom" />
import { expect, type Page, test } from '@playwright/test'

// 版式规则的度量测试（openspec refresh-visual-system-warm design.md D5，specs/site-visual-system）：
// 把「每屏一个任务、六个字号角色、区块节奏、单行页头」写成可测的数字。
// 页头规则对全部页面生效（第 4 组已改版）；其余规则按页面登记，尚未改版的页面以 test.fixme 占位，
// 各页面组完成时把对应页面的 `restyled` 改为 true（本 change 结束时不应再有 fixme）。

type Site = 'east' | 'west'
interface RulePage {
  readonly name: string
  readonly site: Site
  readonly path: string
  /** 落地页：另查首屏按钮数、首屏文字元素数与区块间距 */
  readonly landing?: boolean
  /** 页面已按新视觉改版：启用字号、正文字号等规则 */
  readonly restyled: boolean
  /** 出生信息表单的字段名前缀：提供时另查提交后（已出结果）的字号种数；合盘为两个人 */
  readonly birthForm?: readonly string[]
}

// 出结果状态的样例（与 e2e/bazi.spec.ts 相同）
const PEOPLE = [
  { year: '1990', month: '5', day: '15', hour: '10', minute: '30' },
  { year: '1992', month: '8', day: '3', hour: '07', minute: '00' },
] as const

/** 填出生信息并提交，等结果区出现 */
async function submitBirthForm(page: Page, prefixes: readonly string[]) {
  // 提交按钮在水合后才可用
  const submit = page.locator('main form button[type="submit"]')
  await expect(submit).toBeEnabled()
  for (const [index, prefix] of prefixes.entries()) {
    const person = PEOPLE[index] ?? PEOPLE[0]
    for (const key of ['year', 'month', 'day'] as const)
      await page.locator(`input[name="${prefix}${key}"]`).fill(person[key])
    const time = page.locator(`[data-field="${prefix}time"]`)
    await time.locator('[data-part="hour"]').fill(person.hour)
    await time.locator('[data-part="minute"]').fill(person.minute)
  }
  await submit.click()
  await expect(page.locator('#result section').first()).toBeVisible()
}

const PAGES: readonly RulePage[] = [
  { name: '东方站首页', site: 'east', path: '/zh-hant', landing: true, restyled: true },
  { name: '西方站首页', site: 'west', path: '/', landing: true, restyled: true },
  // 主工具页（openspec separate-landing-homepage tasks 5.1，specs/tool-pages「工具页紧凑布局」）
  { name: '八字排盤', site: 'east', path: '/zh-hant/八字排盤', restyled: true, birthForm: [''] },
  { name: '만세력', site: 'east', path: '/ko/만세력', restyled: true, birthForm: [''] },
  { name: 'Life Path Number', site: 'west', path: '/life-path-number', restyled: true },
  // 东方站其余工具页与概念页（openspec refresh-visual-system-warm tasks 6.1）
  {
    name: '紫微斗數排盤',
    site: 'east',
    path: '/zh-hant/紫微斗數排盤',
    restyled: true,
    birthForm: [''],
  },
  { name: '紫微斗数排盘', site: 'east', path: '/zh-hans/紫微斗数排盘', restyled: true },
  { name: '命盤查詢', site: 'east', path: '/zh-hant/命盤查詢', restyled: true, birthForm: [''] },
  {
    name: '사주궁합',
    site: 'east',
    path: '/ko/사주궁합',
    restyled: true,
    birthForm: ['a_', 'b_'],
  },
  { name: '八字概念页（十神）', site: 'east', path: '/zh-hant/八字/十神', restyled: true },
  { name: '사주 개념 페이지（공망）', site: 'east', path: '/ko/사주/공망', restyled: true },
  { name: 'Numerology Calculator', site: 'west', path: '/numerology-calculator', restyled: true },
  // 第 7 组：西方站数字页与枢纽页、两站塔罗抽牌 / 牌义 / 牌义索引页、两站每日页（tasks 7.1）
  { name: '数字页 Life Path 7', site: 'west', path: '/life-path-number/7', restyled: true },
  { name: '枢纽页 Destiny Number', site: 'west', path: '/destiny-number', restyled: true },
  { name: 'Three-Card Tarot', site: 'west', path: '/tarot', restyled: true },
  { name: '牌义页 The Sun', site: 'west', path: '/tarot/cards/the-sun', restyled: true },
  { name: '牌义索引（西方站）', site: 'west', path: '/tarot/cards', restyled: true },
  { name: '三张牌塔罗（简中）', site: 'east', path: '/zh-hans/塔罗', restyled: true },
  { name: '牌义索引（简中）', site: 'east', path: '/zh-hans/塔罗/牌义', restyled: true },
  { name: 'Daily Numerology', site: 'west', path: '/daily-numerology', restyled: true },
  { name: '每日运势（简中）', site: 'east', path: '/zh-hans/每日运势', restyled: true },
  { name: '东方站定价页', site: 'east', path: '/zh-hant/pricing', restyled: true },
  { name: '西方站定价页', site: 'west', path: '/pricing', restyled: true },
  // 内容页（refresh-visual-system-warm 9.1）：法律页与博客文章，正文用 Prose 的排版规则
  { name: '西方站隐私政策', site: 'west', path: '/privacy', restyled: true },
  { name: '东方站服務條款', site: 'east', path: '/zh-hant/terms', restyled: true },
  { name: '西方站博客文章', site: 'west', path: '/blog/writing-posts', restyled: true },
  { name: '东方站博客文章', site: 'east', path: '/zh-hant/blog/welcome', restyled: true },
]

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

function pageUrl(page: RulePage) {
  const url = new URL(page.path, test.info().project.use.baseURL)
  // `east.localhost` 由浏览器解析到本机，站点识别见 features/site/site.ts
  if (page.site === 'east') url.hostname = 'east.localhost'
  return url.href
}

async function open(page: Page, target: RulePage, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(pageUrl(target))
  await page.evaluate(() => document.fonts.ready)
}

/** 可见文字节点的计算字号（去重后升序）；只统计 <main>，页头页脚另有规则 */
const fontSizes = (page: Page) =>
  page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return (
        rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && +style.opacity > 0
      )
    }
    const sizes = new Set<number>()
    for (const element of document.querySelectorAll('main *')) {
      // 图形内的文字（SVG）与对读屏隐藏的装饰不计入
      if (element.closest('svg, [aria-hidden="true"]')) continue
      const hasText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 1,
      )
      if (hasText && visible(element))
        sizes.add(Number.parseFloat(getComputedStyle(element).fontSize))
    }
    return [...sizes].sort((a, b) => a - b)
  })

/** 首屏内的按钮与按钮样式链接：有底色或边框、高 ≥ 32px、宽 ≥ 64px；`filled` 为主按钮（文字色填充） */
const foldActions = (page: Page) =>
  page.evaluate(() => {
    const fold = window.innerHeight
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    const probe = document.createElement('i')
    probe.style.color = ink
    document.body.append(probe)
    const primary = getComputedStyle(probe).color
    probe.remove()
    return [...document.querySelectorAll('main a, main button, main input[type=submit]')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const filled =
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent'
        const bordered = Number.parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== 'none'
        return (
          rect.top < fold &&
          rect.bottom > 0 &&
          rect.height >= 32 &&
          rect.width >= 64 &&
          (filled || bordered) &&
          style.visibility !== 'hidden' &&
          // 带标题的整卡链接（工具卡）是内容卡片，不是按钮
          !element.querySelector('h2, h3')
        )
      })
      .map((element) => ({
        text: (element.textContent ?? '').trim().slice(0, 30),
        filled: getComputedStyle(element).backgroundColor === primary,
      }))
  })

/** 首屏内的文字元素数（标题、段落、列表项、按钮与链接；不含包着这些元素的容器） */
const foldTextElements = (page: Page) =>
  page.evaluate(() => {
    const fold = window.innerHeight
    return [...document.querySelectorAll('main :is(h1, h2, h3, p, li, button, a)')].filter(
      (element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.top < fold &&
          rect.bottom > 0 &&
          (element.textContent ?? '').trim().length > 2 &&
          // 带标题的整卡链接（工具卡）算一个元素：计卡片本身，不计卡内的标题与说明
          (element.matches('a:has(h2, h3)') ||
            (!element.querySelector('p, li, h1, h2, h3') && !element.closest('a:has(h2, h3)')))
        )
      },
    ).length
  })

/** 相邻顶层区块之间的间距（px）：<main> 下第一层容器里的各 <section> */
const sectionGaps = (page: Page) =>
  page.evaluate(() => {
    const sections = [...document.querySelectorAll('main section')].filter(
      (section) => !section.parentElement?.closest('section'),
    )
    const gaps: number[] = []
    for (let index = 1; index < sections.length; index += 1) {
      const previous = sections[index - 1]?.getBoundingClientRect()
      const current = sections[index]?.getBoundingClientRect()
      if (previous && current) gaps.push(Math.round(current.top - previous.bottom))
    }
    return gaps
  })

/** 段落正文的最小字号 */
const minParagraphSize = (page: Page) =>
  page.evaluate(() => {
    // 合规声明与证明行等附注（role="note"）按设计用 caption，不是正文
    const sizes = [...document.querySelectorAll('main p:not([role="note"])')]
      .filter((p) => {
        const rect = p.getBoundingClientRect()
        // 小字说明（声明、元信息、提示）用 caption，不算正文：只看较长的段落；表单内的字段提示（如真太阳时说明）同样是 caption
        return rect.width > 0 && !p.closest('form') && (p.textContent ?? '').trim().length >= 40
      })
      .map((p) => Number.parseFloat(getComputedStyle(p).fontSize))
    return sizes.length > 0 ? Math.min(...sizes) : null
  })

for (const target of PAGES) {
  test.describe(target.name, () => {
    // ---- 页头：对全部页面生效 ----
    test('手机页头为单行，高度不超过 64px，页面没有横向滚动', async ({ page }) => {
      await open(page, target, MOBILE)
      const header = page.locator('header').first()
      const box = await header.boundingBox()
      expect(box?.height ?? 0).toBeLessThanOrEqual(64)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        MOBILE.width,
      )
      // 导航收进面板：手机页头里看不到桌面导航的链接
      await expect(header.locator('nav').first()).toBeHidden()
      const menu = header.locator('details').last().locator('summary')
      await expect(menu).toBeVisible()
    })

    test('手机导航面板：点击展开，Esc 关闭并把焦点还给按钮', async ({ page }) => {
      await open(page, target, MOBILE)
      const details = page.locator('header details').last()
      const summary = details.locator('summary')
      await summary.click()
      await expect(details.locator('[data-slot="theme-toggle"]')).toBeVisible()
      await expect(details.locator('nav a').first()).toBeVisible()
      // 展开不依赖水合；Esc 关闭与焦点返回由水合后的监听提供，主题按钮可用即表示已水合
      await expect(details.locator('[data-theme-option="system"]')).toBeEnabled()
      await page.keyboard.press('Escape')
      await expect(details.locator('nav a').first()).toBeHidden()
      await expect(summary).toBeFocused()
    })

    test('桌面页头导航不超过 5 项', async ({ page }) => {
      await open(page, target, DESKTOP)
      const header = page.locator('header').first()
      // 一级项：导航里的下拉按钮与直接链接，加语言与账户控件
      const nav = header.locator('nav').first()
      const navItems =
        (await nav.locator(':scope > details > summary').count()) +
        (await nav.locator(':scope > a').count())
      const controls = await header
        .locator('details > summary:visible, a[rel="nofollow"]:visible')
        .count()
      // controls 含导航里的工具下拉；减去它，避免重复计数
      const toolsMenus = await nav.locator(':scope > details > summary').count()
      expect(navItems + controls - toolsMenus).toBeLessThanOrEqual(5)
      expect((await header.boundingBox())?.height ?? 0).toBeLessThanOrEqual(80)
    })

    // ---- 页面内容：改版后启用 ----
    const content = target.restyled ? test : test.fixme

    content('页面只用六种字号', async ({ page }) => {
      for (const viewport of [MOBILE, DESKTOP]) {
        await open(page, target, viewport)
        const sizes = await fontSizes(page)
        expect(sizes.length, `${viewport.width}px: ${sizes.join(', ')}`).toBeLessThanOrEqual(6)
      }
    })

    if (target.birthForm) {
      const { birthForm } = target
      content('出结果后页面仍只用六种字号', async ({ page }) => {
        for (const viewport of [MOBILE, DESKTOP]) {
          await open(page, target, viewport)
          await submitBirthForm(page, birthForm)
          const sizes = await fontSizes(page)
          expect(sizes.length, `${viewport.width}px: ${sizes.join(', ')}`).toBeLessThanOrEqual(6)
        }
      })
    }

    content('段落正文不小于 16px', async ({ page }) => {
      await open(page, target, MOBILE)
      const size = await minParagraphSize(page)
      if (size !== null) expect(size).toBeGreaterThanOrEqual(16)
    })

    if (target.landing) {
      content('首屏不超过 3 个按钮、恰好 1 个主按钮，文字元素不超过 12 个', async ({ page }) => {
        for (const viewport of [MOBILE, DESKTOP]) {
          await open(page, target, viewport)
          const actions = await foldActions(page)
          const label = `${viewport.width}px: ${actions.map((action) => action.text).join(' | ')}`
          expect(actions.length, label).toBeLessThanOrEqual(3)
          expect(actions.filter((action) => action.filled).length, label).toBe(1)
          expect(await foldTextElements(page)).toBeLessThanOrEqual(12)
        }
      })

      content('区块间距：桌面 96–128px，手机 64–72px', async ({ page }) => {
        await open(page, target, DESKTOP)
        for (const gap of await sectionGaps(page)) {
          expect(gap).toBeGreaterThanOrEqual(96)
          expect(gap).toBeLessThanOrEqual(128)
        }
        await open(page, target, MOBILE)
        for (const gap of await sectionGaps(page)) {
          expect(gap).toBeGreaterThanOrEqual(64)
          expect(gap).toBeLessThanOrEqual(72)
        }
      })
    }
  })
}
