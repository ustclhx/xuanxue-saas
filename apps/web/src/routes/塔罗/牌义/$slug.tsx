import { createFileRoute } from '@tanstack/react-router'
import { getTarotMeaning } from '../../../features/tools/tarot/meaning.functions.ts'
import { TarotMeaningArticle } from '../../../features/tools/tarot/meaning-page.tsx'
import {
  requireMeaningLocale,
  tarotMeaningHead,
} from '../../../features/tools/tarot/meaning-route.tsx'

export const Route = createFileRoute('/塔罗/牌义/$slug')({
  beforeLoad: () => requireMeaningLocale('zh-Hans'),
  loader: ({ params }) => getTarotMeaning({ data: { slug: params.slug, locale: 'zh-Hans' } }),
  head: ({ loaderData, matches }) => (loaderData ? tarotMeaningHead(loaderData, matches) : {}),
  component: () => <TarotMeaningArticle content={Route.useLoaderData()} />,
})
