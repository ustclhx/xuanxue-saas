import { createFileRoute } from '@tanstack/react-router'
import { SpacePage, SpacePanel } from '../../../features/app-shell/space-frame.tsx'
import { WorkspaceSettings } from '../../../features/workspace/components.tsx'
import { getWorkspacePage } from '../../../features/workspace/workspace.functions.ts'
import { m } from '../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/settings')({
  beforeLoad: async ({ params }) => ({
    workspacePage: await getWorkspacePage({ data: { slug: params.slug } }),
  }),
  loader: ({ context }) => context.workspacePage,
  staleTime: 0,
  component: WorkspaceSettingsPage,
})

function WorkspaceSettingsPage() {
  const page = Route.useLoaderData()
  return (
    <SpacePage title={m.app_workspace_settings()}>
      <WorkspaceSettings page={page} />
      {!page.workspace.isPersonal && !page.readOnly && page.role === 'owner' ? (
        <SpacePanel title={m.deletion_danger_zone()} className="border-destructive/40">
          <p className="m-0 text-ink-muted text-sm">{m.deletion_team_warning()}</p>
          <a
            className="inline-flex min-h-11 w-fit items-center rounded-lg border border-destructive px-4 font-semibold text-destructive"
            href={`/app/${page.workspace.slug}/delete`}
          >
            {m.deletion_team_title()}
          </a>
        </SpacePanel>
      ) : null}
    </SpacePage>
  )
}
