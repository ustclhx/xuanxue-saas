import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allNumerologies } from 'content-collections'
import { z } from 'zod'
import { NUMEROLOGY_LOCALE } from './routes.ts'

/**
 * 数字命理正文（content/numerology/en）：构建期生成，不访问数据库；页面预渲染为静态 HTML，
 * 客户端路由跳转时才调用。只有英语版本（西方站）。
 */
export const getNumerologyPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1).max(64) }))
  .handler(({ data }) => {
    const page = allNumerologies.find(
      (entry) => entry.slug === data.slug && entry.locale === NUMEROLOGY_LOCALE,
    )
    if (!page) throw notFound()
    return page
  })

export type NumerologyPage = Awaited<ReturnType<typeof getNumerologyPage>>
