import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allNumerologies } from 'content-collections'
import { z } from 'zod'
import { NUMEROLOGY_LOCALES } from './routes.ts'

/**
 * 数字命理正文（content/numerology/en）：构建期生成，不访问数据库；页面预渲染为静态 HTML，
 * 客户端路由跳转时才调用。西方站语言（英语、西班牙语），不回退到另一种语言。
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
    return page
  })

export type NumerologyPage = Awaited<ReturnType<typeof getNumerologyPage>>
