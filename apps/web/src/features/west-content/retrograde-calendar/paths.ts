import type { RegisteredToolRoute } from '../../tools/registry.ts'
import type { WestContentRoute } from '../routes.ts'

/**
 * 逆行日历的地址（openspec content-growth-v2-tools 决策 2、19，第 25.2 项）：只有 en，地址不带年份（设计稿 B7）。
 * 只放字面量：西方内容路由映射、注册表、站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 */
export const RETROGRADE_LOCALE = 'en'
export const RETROGRADE_PATH = '/retrograde-calendar'
export const RETROGRADE_PAGE_ID = 'index'

export const RETROGRADE_CONTENT_ROUTES: readonly WestContentRoute[] = [
  {
    locale: RETROGRADE_LOCALE,
    path: RETROGRADE_PATH,
    collection: 'retrograde-calendar',
    id: RETROGRADE_PAGE_ID,
  },
]

/** 「New」小标的显示期限（上线后约 60 天，registry.ts 取值规则） */
export const RETROGRADE_NEW_UNTIL = '2027-02-28'

/**
 * 注册表条目：「全部工具」占星分组（设计稿 HubWestB：Birth Chart、Rising Sign、Zodiac Signs 之后），
 * 构建期预渲染（数据为构建期预计算的停滞表，不查数据库）。页头下拉只列精选（设计稿 B13），不受 nav 影响。
 */
export const RETROGRADE_TOOL_ROUTES: readonly RegisteredToolRoute[] = [
  {
    id: 'retrograde-calendar',
    site: 'west',
    paths: { en: RETROGRADE_PATH },
    titles: { en: 'Retrograde Calendar' },
    descriptions: { en: 'Every planetary retrograde this year and next.' },
    directoryGroup: 'astrology',
    freeLabel: 'free_lookup',
    badge: { kind: 'new', until: RETROGRADE_NEW_UNTIL },
  },
]
