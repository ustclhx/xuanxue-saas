import { createFileRoute } from '@tanstack/react-router'
import { siteTitle } from '@web/features/seo/site-title.ts'
import { m } from '@web/paraglide/messages.js'
import { MediaTasksPage } from '../../../../src/web/ai-media/tasks-page.tsx'

export const Route = createFileRoute('/app/$slug/tasks/')({
  head: ({ matches }) => ({ meta: [{ title: siteTitle(m.media_tasks_title(), matches) }] }),
  component: TasksPage,
})

function TasksPage() {
  const { workspacePage } = Route.useRouteContext()
  return <MediaTasksPage key={workspacePage.workspace.id} page={workspacePage} />
}
