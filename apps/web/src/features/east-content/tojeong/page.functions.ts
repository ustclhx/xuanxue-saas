import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allTojeongs } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead } from '../../seo/metadata.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { TOJEONG_COPY } from './copy.ts'
import { TOJEONG_LOCALE, TOJEONG_PATH, TOJEONG_QUERY_ROBOTS } from './paths.ts'

/** 个人年度工具（第 7 组）的 ko 地址：注册表登记后正文才出现这条内链，未上线时不产生死链 */
const YEARLY_TOOL_PATH = '/2027-신년-사주'

/** 关联工具卡（设计稿 Tojeong「관련 도구」）：只列注册表中 ko 已发布的工具 */
const RELATED = [
  { path: YEARLY_TOOL_PATH, note: '사주로 보는 정미년' },
  { path: '/만세력', note: '사주팔자와 대운·세운' },
  { path: '/사주궁합', note: '두 사람의 일주 관계' },
  { path: '/띠', note: '출생 연도와 띠' },
] as const

const publishedTitle = (path: string) =>
  TOOL_ROUTES.find((route) => route.paths[TOJEONG_LOCALE] === path)?.titles[TOJEONG_LOCALE]

/**
 * 토정비결工具页数据（只在服务端执行）：说明长文、FAQ 与 head。页面构建期预渲染，不访问数据库。
 * 带分享参数（`?gwae=`、`?year=`）时 head 加 `noindex, follow`，canonical 仍为不带参数的工具页。
 */
export const getTojeongPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ share: z.boolean() }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const entry = allTojeongs.find((item) => item.locale === TOJEONG_LOCALE)
    if (!entry) throw notFound()
    const crumbs = [
      { name: TOJEONG_COPY.home, path: '/' },
      { name: TOJEONG_COPY.toolCrumb, path: TOJEONG_PATH },
    ]
    const head = pageHead(
      {
        path: TOJEONG_PATH,
        locale: TOJEONG_LOCALE,
        title: entry.title,
        description: entry.description,
      },
      '',
      [
        breadcrumbData(crumbs, TOJEONG_LOCALE),
        faqPageData(entry.faq.map(({ q, a }) => ({ question: q, answer: a }))),
      ],
    )
    const yearlyTitle = publishedTitle(YEARLY_TOOL_PATH)
    return {
      head: data.share
        ? { ...head, meta: [...head.meta, { name: 'robots', content: TOJEONG_QUERY_ROBOTS }] }
        : head,
      content: {
        heading: entry.heading,
        lede: entry.lede,
        html: entry.html,
        faq: entry.faq,
        yearlyLink: yearlyTitle ? YEARLY_TOOL_PATH : null,
        related: RELATED.flatMap(({ path, note }) => {
          const title = publishedTitle(path)
          return title ? [{ path, title, note }] : []
        }),
      },
    }
  })

export type TojeongPageData = Awaited<ReturnType<typeof getTojeongPage>>['content']
