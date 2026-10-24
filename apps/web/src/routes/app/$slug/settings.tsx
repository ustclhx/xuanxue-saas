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
        <SpacePanel title="Danger zone" className="border-destructive/40">
          <p className="m-0 text-ink-muted text-sm">
            Deleting a team workspace removes its content. This cannot be undone.
          </p>
          <a
            className="inline-flex min-h-11 w-fit items-center rounded-lg border border-destructive px-4 font-semibold text-destructive"
            href={`/app/${page.workspace.slug}/delete`}
          >
            Delete team workspace
          </a>
        </SpacePanel>
      ) : null}
    </SpacePage>
  )
}
