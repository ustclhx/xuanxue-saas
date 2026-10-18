import type { SiteId } from '@xuanxue/config'
import { allDocs, allLegalPages, allPosts } from 'content-collections'
import { templateConfig } from '../../server/template-config.ts'
import { publicPages } from './pages.ts'

export function getPublicPages(site?: SiteId) {
  return publicPages(
    { posts: allPosts, legal: allLegalPages, docs: allDocs },
    new Date(),
    templateConfig,
    site,
  )
}
