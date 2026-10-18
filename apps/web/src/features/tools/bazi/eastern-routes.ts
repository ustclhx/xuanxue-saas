/**
 * 东方站排盘页面的 slug ↔ 页面映射（openspec add-bazi-saju-chart 决策 7）：
 * 路由文件用 `$slug` 参数，中文 / 韩文路径段直接使用 Unicode，生成链接时由 toolHref 统一 encodeURI。
 * 首页（`/`）不在这里，由 routes/index.tsx 按语言渲染。
 * 预渲染与注册表也会引用路径，因此不引用任何运行时模块。
 */
export type EasternPageId = 'ziwei' | 'mingpan' | 'gunghap'

export const EASTERN_PAGES: readonly {
  readonly id: EasternPageId
  readonly locale: 'zh-Hant' | 'ko'
  readonly slug: string
}[] = [
  { id: 'ziwei', locale: 'zh-Hant', slug: '紫微斗數排盤' },
  { id: 'mingpan', locale: 'zh-Hant', slug: '命盤查詢' },
  { id: 'gunghap', locale: 'ko', slug: '사주궁합' },
]

/** 路由参数可能是已解码的 Unicode，也可能保留百分号编码，两者都接受 */
export function easternPageOf(locale: string, slug: string): EasternPageId | undefined {
  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    // 非法编码按原样比较
  }
  return EASTERN_PAGES.find((page) => page.locale === locale && page.slug === decoded)?.id
}

/** 长尾概念页（tasks.md 4.1–4.2 实现）：结果区块链接到对应说明 */
export const CONCEPT_SLUGS = {
  'zh-Hant': {
    base: '八字',
    luck: '大運',
    'useful-god': '喜用神',
    elements: '五行',
    strength: '身強身弱',
    void: '空亡',
    shensha: '神煞',
    weight: '八字重量',
    'ten-gods': '十神',
  },
  ko: {
    base: '사주',
    luck: '대운',
    'useful-god': '용신',
    elements: '오행',
    strength: '신강신약',
    void: '공망',
    shensha: '신살',
    'day-pillar': '일주',
    'ten-gods': '십신',
  },
} as const

export type ConceptKey =
  | keyof (typeof CONCEPT_SLUGS)['zh-Hant']
  | keyof (typeof CONCEPT_SLUGS)['ko']

/** 概念页路径（不含语言前缀）；该语言没有此概念时返回 undefined */
export function conceptPath(locale: string, key: Exclude<ConceptKey, 'base'>): string | undefined {
  const slugs: Readonly<Record<string, string>> | undefined =
    CONCEPT_SLUGS[locale as keyof typeof CONCEPT_SLUGS]
  const slug = slugs?.[key]
  return slugs && slug ? `/${slugs.base}/${slug}` : undefined
}
