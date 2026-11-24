import type { TopicSpreadId } from '@xuanxue/tarot'
import type { ToolRoute } from '../../tools/registry.ts'
import type { WestContentRoute } from '../routes.ts'

/**
 * 主题牌阵页的地址（openspec content-growth-v2-tools 第 28 组，design「塔罗牌阵」）：只有 en，
 * `/tarot/love`、`/tarot/career`、`/tarot/full-moon`。只放字面量：西方内容路由映射、注册表、站点地图与预渲染
 * 都从这里读取，本文件随入口包加载，不得引用运行时模块。
 */
export const TAROT_SPREAD_LOCALE = 'en'
export const TAROT_TOPIC_SPREADS = [
  'love',
  'career',
  'full-moon',
] as const satisfies readonly TopicSpreadId[]

/** 「New」小标显示至此日（含；上线后约 60 天，规则见 registry.ts） */
export const TAROT_SPREAD_NEW_UNTIL = '2027-02-28'

export function tarotTopicPath(id: TopicSpreadId): `/${string}` {
  return `/tarot/${id}`
}

/** 导航名与面包屑（主词），Title、H1 在内容集合（content/tarot-spreads/en） */
export const TAROT_TOPIC_TITLES: Readonly<Record<TopicSpreadId, string>> = {
  love: 'Love Tarot Spread',
  career: 'Career Tarot Spread',
  'full-moon': 'Full Moon Tarot Spread',
}

/** 「More spreads」区块与工具卡的一句话说明（设计稿 Spread「More spreads」、HubWestB） */
export const TAROT_TOPIC_SUMMARIES: Readonly<Record<TopicSpreadId, string>> = {
  love: 'Five cards for a relationship question.',
  career: 'Four cards for a question about work.',
  'full-moon': 'Four cards for the end of a lunar cycle.',
}

export const TAROT_SPREAD_CONTENT_ROUTES: readonly WestContentRoute[] = TAROT_TOPIC_SPREADS.map(
  (id) => ({
    locale: TAROT_SPREAD_LOCALE,
    path: tarotTopicPath(id),
    collection: 'tarot-spreads',
    id,
  }),
)

/**
 * 注册表条目（features/tools/registry.ts）：构建期预渲染；不进页头下拉（页头保持 5 项，设计稿 B13），
 * 由「全部工具」枢纽页的塔罗分组（directory.ts HUB_EXTRA_IDS）、牌阵页之间的区块与正文链接到达。
 * 描述是 llms.txt 与注册表口径的说明；页面 head 取内容集合的 description。
 */
export const TAROT_SPREAD_TOOL_ROUTES: readonly ToolRoute[] = TAROT_TOPIC_SPREADS.map(
  (id): ToolRoute => ({
    id: `tarot-${id}`,
    site: 'west',
    nav: false,
    paths: { en: tarotTopicPath(id) },
    titles: { en: TAROT_TOPIC_TITLES[id] },
    descriptions: { en: TAROT_TOPIC_SUMMARIES[id] },
    directoryGroup: 'tarot',
    freeLabel: 'free_draw',
    badge: { kind: 'new', until: TAROT_SPREAD_NEW_UNTIL },
  }),
)
