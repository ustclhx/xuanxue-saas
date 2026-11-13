import type { ToolRoute } from '../tools/registry.ts'
import type { DailyLocale } from './date.ts'

/**
 * 公开每日运势页的规范地址（daily-horoscope spec「公开每日运势页」，design D9 首选写法）。
 * 不引用运行时模块：工具注册表、缓存函数与站点地图都从这里读取。
 */
export const DAILY_PATHS = {
  'zh-Hant': '/每日運勢',
  'zh-Hans': '/每日运势',
  ko: '/오늘의-운세',
  en: '/daily-numerology',
} as const satisfies Record<DailyLocale, string>

const EAST_TITLES = { 'zh-Hant': '今日運勢', 'zh-Hans': '今日运势', ko: '오늘의 운세' } as const

/**
 * 注册表条目（features/tools/registry.ts）：页头导航、hreflang、站点地图与 llms.txt 沿用工具注册表，
 * `prerender: false` 让每日页留在 SSR + 边缘缓存（design D7），不进构建期预渲染。
 */
export const DAILY_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'daily',
    site: 'east',
    prerender: false,
    paths: {
      'zh-Hant': DAILY_PATHS['zh-Hant'],
      'zh-Hans': DAILY_PATHS['zh-Hans'],
      ko: DAILY_PATHS.ko,
    },
    titles: EAST_TITLES,
    descriptions: {
      'zh-Hant': '每天更新的今日干支、黃曆宜忌與建除，並依十種日主給出今日提示。',
      'zh-Hans': '每天更新的今日干支、黄历宜忌与建除，并依十种日主给出今日提示。',
      ko: '매일 바뀌는 오늘의 일진과 택일 의기·건제십이신, 열 가지 일간별 오늘의 힌트.',
    },
  },
  {
    id: 'daily-numerology',
    site: 'west',
    prerender: false,
    paths: { en: DAILY_PATHS.en },
    titles: { en: 'Number of the Day' },
    descriptions: {
      en: 'Today’s Universal Day number with its calculation, the meaning of Personal Day numbers 1–9, 11 and 22, and a private Personal Day calculator.',
    },
  },
]

/** 某语言的每日页路径（不含语言前缀） */
export function dailyPath(locale: string): string | undefined {
  return (DAILY_PATHS as Record<string, string>)[locale]
}

/** 路由参数或路径是否为该语言的每日页；路径可能保留百分号编码 */
export function isDailyPath(locale: string, path: string): boolean {
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    // 非法编码按原样比较
  }
  return dailyPath(locale) === decoded
}
