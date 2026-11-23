import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allCompats } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead } from '../../seo/metadata.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import {
  COMPAT_SCENARIO_KEYS,
  COMPAT_TOOL_PATHS,
  type CompatPageLocale,
  type CompatScenarioKey,
  compatScenarioPath,
  isCompatLocale,
  nextCompatScenario,
} from './paths.ts'

/** 面包屑首项（与各语言 marketing_nav_home 相同；server function 内不依赖请求语言） */
const HOME: Readonly<Record<CompatPageLocale, string>> = {
  'zh-Hans': '首页',
  'zh-Hant': '首頁',
  ko: '홈',
  ja: 'ホーム',
  en: 'Home',
}

const entryOf = (locale: string, page: string) =>
  allCompats.find((item) => item.locale === locale && item.page === page)

const published = (locale: CompatPageLocale, path: string) =>
  TOOL_ROUTES.some((route) => route.site === 'east' && route.paths[locale] === path)

const alternateZodiacPairTitle: Partial<Record<CompatPageLocale, string>> = {
  'zh-Hans': '生肖配对表',
  ko: '띠궁합 표',
  en: 'Chinese zodiac pairings',
}

/** 同组卡片：本语言其他场景页（data-link-zone="siblings"，不计入正文内链） */
function scenarioCards(locale: CompatPageLocale, except?: CompatScenarioKey) {
  return COMPAT_SCENARIO_KEYS.flatMap((key) => {
    const entry = entryOf(locale, key)
    const path = compatScenarioPath(locale, key)
    if (key === except || !entry || !published(locale, path)) return []
    return [{ key, path, title: entry.short, note: entry.note ?? '' }]
  })
}

/**
 * 合盘工具页正文与场景页数据（只在服务端执行；构建期预渲染，不访问数据库）。
 * 东方站所有语言的页面都声明 `site: 'east'`（根路径英文与西方站同语言，见 tools/bazi/head.ts）。
 */
export const getCompatPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale: z.string(), page: z.string() }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const { locale, page } = data
    if (!isCompatLocale(locale)) throw notFound()
    const entry = entryOf(locale, page)
    const toolPath = COMPAT_TOOL_PATHS[locale]
    const tool = entryOf(locale, 'index')
    if (!entry || !published(locale, toolPath)) throw notFound()
    const site = 'east' as const
    const faq = faqPageData(entry.faq.map(({ q, a }) => ({ question: q, answer: a })))
    const toolTitle =
      tool?.short ?? TOOL_ROUTES.find((route) => route.id === 'saju-gunghap')?.titles[locale] ?? ''

    if (page === 'index') {
      const head = pageHead(
        { path: toolPath, locale, site, title: entry.title, description: entry.description },
        '',
        [
          breadcrumbData(
            [
              { name: HOME[locale], path: '/' },
              { name: toolTitle, path: toolPath },
            ],
            locale,
            site,
          ),
          faq,
        ],
      )
      return {
        head,
        content: {
          kind: 'tool' as const,
          locale,
          html: entry.html,
          items: entry.items,
          faq: entry.faq,
          scenarios: scenarioCards(locale),
        },
      }
    }

    const key = page as CompatScenarioKey
    if (!COMPAT_SCENARIO_KEYS.includes(key)) throw notFound()
    const path = compatScenarioPath(locale, key)
    if (!published(locale, path)) throw notFound()
    const crumbs = [
      { name: HOME[locale], path: '/' },
      { name: toolTitle, path: toolPath },
      { name: entry.short, path },
    ]
    const nextKey = nextCompatScenario(key)
    const next = entryOf(locale, nextKey)
    const nextPath = compatScenarioPath(locale, nextKey)
    const zodiacPair = TOOL_ROUTES.find(
      (route) => route.site === 'east' && route.id === 'zodiac-pair',
    )
    const zodiacPairPath = zodiacPair?.paths[locale]
    const zodiacPairTitle = zodiacPair?.titles[locale]
    const zodiacPairAnchor =
      key === 'couple' || key === 'business'
        ? (alternateZodiacPairTitle[locale] ?? zodiacPairTitle)
        : zodiacPairTitle
    return {
      head: pageHead(
        { path, locale, site, title: entry.title, description: entry.description },
        '',
        [breadcrumbData(crumbs, locale, site), faq],
      ),
      content: {
        kind: 'scenario' as const,
        locale,
        scenario: key,
        heading: entry.heading ?? entry.short,
        lede: entry.lede ?? '',
        html: entry.html,
        items: entry.items,
        faq: entry.faq,
        crumbs,
        // 总表按语言分批上线，注册表有本语言的地址后才出链接。
        links: [
          { path: toolPath, title: entry.tool_anchor ?? toolTitle, target: 'saju-gunghap' },
          ...(next && published(locale, nextPath)
            ? [{ path: nextPath, title: next.short, target: `saju-gunghap-${nextKey}` }]
            : []),
          ...(zodiacPairPath && zodiacPairAnchor
            ? [{ path: zodiacPairPath, title: zodiacPairAnchor, target: 'zodiac-pair' }]
            : []),
        ],
        scenarios: scenarioCards(locale, key),
      },
    }
  })

export type CompatPageData = Awaited<ReturnType<typeof getCompatPage>>['content']
