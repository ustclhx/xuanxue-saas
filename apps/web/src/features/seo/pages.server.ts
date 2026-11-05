import type { SiteId } from '@xuanxue/config'
import {
  allDocs,
  allGuides,
  allLegalPages,
  allNumerologies,
  allPosts,
  allTarots,
} from 'content-collections'
import { templateConfig } from '../../server/template-config.ts'
import { numerologySeoPages } from '../tools/numerology/routes.ts'
import { tarotMeaningSeoPages } from '../tools/tarot/meaning-routes.ts'
import { publicPages } from './pages.ts'

export function getPublicPages(site?: SiteId) {
  return publicPages(
    {
      posts: allPosts,
      legal: allLegalPages,
      docs: allDocs,
      guides: allGuides,
      toolPages: [...numerologySeoPages(allNumerologies), ...tarotMeaningSeoPages(allTarots)],
    },
    new Date(),
    templateConfig,
    site,
  )
}
