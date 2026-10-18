import type { SiteId } from '@xuanxue/config'
import { allDocs, allLegalPages, allNumerologies, allPosts } from 'content-collections'
import { templateConfig } from '../../server/template-config.ts'
import { numerologySeoPages } from '../tools/numerology/routes.ts'
import { publicPages } from './pages.ts'

export function getPublicPages(site?: SiteId) {
  return publicPages(
    {
      posts: allPosts,
      legal: allLegalPages,
      docs: allDocs,
      toolPages: numerologySeoPages(allNumerologies),
    },
    new Date(),
    templateConfig,
    site,
  )
}
