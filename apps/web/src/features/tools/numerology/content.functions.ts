import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allNumerologies } from 'content-collections'
import { z } from 'zod'
import type { PageCardLink } from '../../seo/page-links.ts'
import { getPageLinks } from '../../seo/pages.server.ts'
import { NUMEROLOGY_LOCALES, numerologyContentPath } from './routes.ts'

/**
 * 数字命理正文（content/numerology/en）：构建期生成，不访问数据库；页面预渲染为静态 HTML，
 * 客户端路由跳转时才调用。西方站语言（英语、西班牙语），不回退到另一种语言。
 * 入门页另带「相关」区块的链接（openspec content-growth-phase1 决策 7）：由公开页面清单按 related 声明计算，
 * 锚文本为目标页 titleMain、说明为目标页 description；清单只在服务端读取，不进客户端包。
 */
export const getNumerologyPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      slug: z.string().min(1).max(64),
      locale: z.enum(NUMEROLOGY_LOCALES).default('en'),
    }),
  )
  .handler(({ data }) => {
    const page = allNumerologies.find(
      (entry) => entry.slug === data.slug && entry.locale === data.locale,
    )
    if (!page) throw notFound()
    const related: PageCardLink[] =
      data.slug === 'numerology'
        ? getPageLinks(numerologyContentPath(data.slug, data.locale), data.locale).related
        : []
    return { ...page, related }
  })

export type NumerologyPage = Awaited<ReturnType<typeof getNumerologyPage>>
