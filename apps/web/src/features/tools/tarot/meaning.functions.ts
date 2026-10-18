import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allTarots } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'

/** 只读取构建期可信正文；不存在的牌或语言不回退到另一语言。 */
export const getTarotMeaning = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(64), locale: z.enum(['en', 'zh-Hant', 'ko']) }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const page = allTarots.find((entry) => entry.slug === data.slug && entry.locale === data.locale)
    if (!page) throw notFound()
    return page
  })

export type TarotMeaningPage = Awaited<ReturnType<typeof getTarotMeaning>>
