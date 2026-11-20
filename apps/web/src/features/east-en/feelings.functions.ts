import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allTarotFeelings } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../server/template-config.ts'

/**
 * 东方站根路径英文的 as feelings 牌页正文（content/tarot-feelings/en，5b）：只读构建期正文，
 * 不存在的牌不回退到西方站英文牌义。
 */
export const getTarotFeelings = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(64) }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const page = allTarotFeelings.find((entry) => entry.slug === data.slug)
    if (!page) throw notFound()
    return page
  })

export type TarotFeelingsPage = Awaited<ReturnType<typeof getTarotFeelings>>
