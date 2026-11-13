import { createFileRoute } from '@tanstack/react-router'
import { listBirthProfiles } from '../../../features/profiles/profiles.functions.ts'
import { ProfilesPage } from '../../../features/profiles/profiles-page.tsx'
import { useSiteId } from '../../../features/site/context.tsx'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'

// 出生档案管理（add-birth-profiles-daily-horoscope tasks 5.1）：只在个人空间可用，团队空间按不存在处理
export const Route = createFileRoute('/app/$slug/profiles')({
  loader: ({ params }) => listBirthProfiles({ data: { slug: params.slug } }),
  staleTime: 0,
  head: () => ({
    meta: [{ title: m.profiles_title() }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: ProfilesRoute,
})

function ProfilesRoute() {
  const profiles = Route.useLoaderData()
  const { slug } = Route.useParams()
  const site = useSiteId()
  return <ProfilesPage key={slug} slug={slug} site={site} locale={getLocale()} initial={profiles} />
}
