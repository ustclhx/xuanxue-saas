import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allConcepts } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { toolHref } from '../tool-href.ts'
import { conceptPageData, conceptPagePath } from './concepts.ts'

/** 与公开内容页一致：只下发本页正文，其他页面仅用于内链与语言对应关系。 */
export const getConceptPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale: z.string(), slug: z.string().min(1).max(100) }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const page = allConcepts.find(
      (entry) => entry.locale === data.locale && entry.slug === data.slug,
    )
    if (!page) {
      const alias =
        data.locale === 'zh-Hans'
          ? allConcepts.find(
              (entry) => entry.locale === data.locale && entry.aliases.includes(data.slug),
            )
          : undefined
      if (alias)
        throw redirect({ href: toolHref(conceptPagePath(alias), alias.locale), statusCode: 301 })
      throw notFound()
    }
    return conceptPageData(allConcepts, page)
  })
