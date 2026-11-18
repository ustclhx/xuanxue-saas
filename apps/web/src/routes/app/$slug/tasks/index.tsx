import { createFileRoute } from '@tanstack/react-router'
import { MediaTasksPage } from '../../../../features/ai-media/tasks-page.tsx'
import { siteTitle } from '../../../../features/seo/site-title.ts'
import { m } from '../../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/tasks/')({
  head: ({ matches }) => ({ meta: [{ title: siteTitle(m.media_tasks_title(), matches) }] }),
  component: TasksPage,
})

function TasksPage() {
  const { workspacePage } = Route.useRouteContext()
  return <MediaTasksPage key={workspacePage.workspace.id} page={workspacePage} />
}
